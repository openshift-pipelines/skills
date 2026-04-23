#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Fetch and cache upstream GitHub data for backlog triage.

Fetches merged PRs, closed issues, and open issues for all upstream repos
and caches them locally. The agent can then search cached JSON instead of
hammering the GitHub API per-issue.

Usage:
    ./fetch-upstream.py --config backlog-triage.toml
    ./fetch-upstream.py --config backlog-triage.toml --fresh
    ./fetch-upstream.py --config backlog-triage.toml --since 2024-01-01
"""

import argparse
import json
import subprocess
import sys
import time
import tomllib
from datetime import datetime, timezone
from pathlib import Path


def load_config(config_path: str) -> dict:
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def get_workdir(config: dict) -> Path:
    project = config["project"]["jira_project"].lower()
    return Path(f"/tmp/backlog-triage-{project}")


def gh_json(args: list[str], timeout=120) -> list[dict]:
    """Run gh CLI and return parsed JSON. Returns [] on error."""
    try:
        r = subprocess.run(
            ["gh", *args],
            capture_output=True, text=True, timeout=timeout,
        )
        if r.returncode != 0:
            print(f"    ⚠ gh {' '.join(args[:4])}...: {r.stderr.strip()[:100]}", file=sys.stderr)
            return []
        return json.loads(r.stdout) if r.stdout.strip() else []
    except subprocess.TimeoutExpired:
        print(f"    ⚠ timeout: gh {' '.join(args[:4])}...", file=sys.stderr)
        return []
    except json.JSONDecodeError:
        return []


def fetch_paginated(repo: str, kind: str, state: str, since: str | None,
                    fields: str, limit: int = 500) -> list[dict]:
    """Fetch all items of a kind (pr/issue) with pagination."""
    all_items = []
    page_size = 100
    # gh uses --limit for total, not per-page; we paginate with multiple calls
    # using --search with date ranges if needed

    args = [kind, "list", "-R", repo, "--state", state,
            "--json", fields, "--limit", str(min(page_size, limit))]

    if since and kind == "pr":
        args.extend(["--search", f"merged:>={since}"])
    elif since and kind == "issue" and state == "closed":
        args.extend(["--search", f"closed:>={since}"])

    # First page
    items = gh_json(args)
    all_items.extend(items)

    # gh doesn't have great cursor pagination for list commands,
    # so we fetch up to limit in one shot
    if len(items) >= page_size and len(all_items) < limit:
        # Fetch more with higher limit
        args_big = [kind, "list", "-R", repo, "--state", state,
                    "--json", fields, "--limit", str(limit)]
        if since and kind == "pr":
            args_big.extend(["--search", f"merged:>={since}"])
        elif since and kind == "issue" and state == "closed":
            args_big.extend(["--search", f"closed:>={since}"])
        items = gh_json(args_big, timeout=300)
        if items:
            all_items = items  # replace with full fetch

    return all_items[:limit]


def fetch_repo(org: str, repo_name: str, cache_dir: Path, since: str | None,
               fresh: bool) -> dict:
    """Fetch all GitHub data for a single repo."""
    full_repo = f"{org}/{repo_name}"
    repo_cache = cache_dir / repo_name
    repo_cache.mkdir(parents=True, exist_ok=True)

    stats = {"repo": repo_name, "merged_prs": 0, "closed_issues": 0, "open_issues": 0}

    # Merged PRs
    pr_file = repo_cache / "merged-prs.json"
    if not fresh and pr_file.exists():
        existing = json.loads(pr_file.read_text())
        print(f"    Merged PRs: {len(existing)} (cached)", file=sys.stderr)
        stats["merged_prs"] = len(existing)
    else:
        print(f"    Fetching merged PRs...", file=sys.stderr)
        prs = fetch_paginated(full_repo, "pr", "merged", since,
                              "number,title,mergedAt,url,labels")
        pr_file.write_text(json.dumps(prs, indent=2))
        print(f"    Merged PRs: {len(prs)}", file=sys.stderr)
        stats["merged_prs"] = len(prs)
        time.sleep(0.5)  # rate limit courtesy

    # Closed issues
    ci_file = repo_cache / "closed-issues.json"
    if not fresh and ci_file.exists():
        existing = json.loads(ci_file.read_text())
        print(f"    Closed issues: {len(existing)} (cached)", file=sys.stderr)
        stats["closed_issues"] = len(existing)
    else:
        print(f"    Fetching closed issues...", file=sys.stderr)
        issues = fetch_paginated(full_repo, "issue", "closed", since,
                                 "number,title,closedAt,url,labels")
        ci_file.write_text(json.dumps(issues, indent=2))
        print(f"    Closed issues: {len(issues)}", file=sys.stderr)
        stats["closed_issues"] = len(issues)
        time.sleep(0.5)

    # Open issues
    oi_file = repo_cache / "open-issues.json"
    if not fresh and oi_file.exists():
        existing = json.loads(oi_file.read_text())
        print(f"    Open issues: {len(existing)} (cached)", file=sys.stderr)
        stats["open_issues"] = len(existing)
    else:
        print(f"    Fetching open issues...", file=sys.stderr)
        issues = fetch_paginated(full_repo, "issue", "open", None,
                                 "number,title,createdAt,url,labels")
        oi_file.write_text(json.dumps(issues, indent=2))
        print(f"    Open issues: {len(issues)}", file=sys.stderr)
        stats["open_issues"] = len(issues)
        time.sleep(0.5)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Fetch and cache upstream GitHub data")
    parser.add_argument("--config", "-c", required=True, help="Path to backlog-triage.toml")
    parser.add_argument("--fresh", action="store_true", help="Ignore cache, re-fetch everything")
    parser.add_argument("--since", default=None,
                        help="Only fetch PRs/issues since date (YYYY-MM-DD). Default: fetch all.")
    parser.add_argument("--repos", nargs="*", default=None,
                        help="Only fetch specific repos (default: all from config)")
    args = parser.parse_args()

    config = load_config(args.config)
    workdir = get_workdir(config)
    cache_dir = workdir / "upstream-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    org = config["upstream"]["org"]
    component_map = config["upstream"]["component_map"]
    all_repos = sorted(set(component_map.values()))

    if args.repos:
        all_repos = [r for r in all_repos if r in args.repos]

    print(f"Organization: {org}", file=sys.stderr)
    print(f"Cache dir: {cache_dir}", file=sys.stderr)
    print(f"Repos: {', '.join(all_repos)}", file=sys.stderr)
    if args.since:
        print(f"Since: {args.since}", file=sys.stderr)
    print(file=sys.stderr)

    all_stats = []
    for repo_name in all_repos:
        print(f"  {org}/{repo_name}:", file=sys.stderr)
        stats = fetch_repo(org, repo_name, cache_dir, args.since, args.fresh)
        all_stats.append(stats)

    # Write metadata
    meta = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "org": org,
        "since": args.since,
        "repos": all_stats,
    }
    (cache_dir / "metadata.json").write_text(json.dumps(meta, indent=2))

    # Summary
    total_prs = sum(s["merged_prs"] for s in all_stats)
    total_closed = sum(s["closed_issues"] for s in all_stats)
    total_open = sum(s["open_issues"] for s in all_stats)
    print(f"\n✅ Done: {total_prs} merged PRs, {total_closed} closed issues, "
          f"{total_open} open issues across {len(all_repos)} repos", file=sys.stderr)
    print(f"Cache: {cache_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()

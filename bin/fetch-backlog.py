#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Fetch all Jira backlog issues with full details and comments.

Uses `jrc` (jayrat CLI) for API access. Supports resuming from a previous
checkpoint — already-fetched issues are skipped.

Usage:
    ./fetch-backlog.py --config backlog-triage.toml
    ./fetch-backlog.py --config backlog-triage.toml --fresh
    ./fetch-backlog.py --config backlog-triage.toml --workers 5
"""

import argparse
import json
import os
import subprocess
import sys
import tomllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def load_config(config_path: str) -> dict:
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def get_workdir(config: dict) -> Path:
    project = config["project"]["jira_project"].lower()
    workdir = Path(f"/tmp/backlog-triage-{project}")
    workdir.mkdir(parents=True, exist_ok=True)
    return workdir


def jrc(*args, timeout=30):
    """Run a jrc command and return parsed JSON."""
    r = subprocess.run(
        ["jrc", *args, "-o", "json"],
        capture_output=True, text=True, timeout=timeout,
    )
    if r.returncode != 0:
        raise RuntimeError(f"jrc failed: {r.stderr}")
    return json.loads(r.stdout)


def list_all_keys(jira_project: str):
    """Paginate through all backlog issues using key cursor."""
    jql_base = f"project = {jira_project} AND sprint is EMPTY AND resolution = Unresolved"
    fields = "key,summary,status,issuetype,priority,assignee,created,updated,labels,components,fixVersions,reporter"

    all_issues = []
    last_key = None
    while True:
        jql = jql_base
        if last_key:
            num = int(last_key.split("-")[1])
            jql += f" AND key < {jira_project}-{num}"
        jql += " ORDER BY key DESC"
        batch = jrc("issue", "list", "-j", jql, "-m", "100", "--fields", fields)
        if not batch:
            break
        all_issues.extend(batch)
        last_key = batch[-1]["key"]
        print(f"  Listed {len(all_issues)} issues (last: {last_key})", file=sys.stderr)
    return all_issues


def fetch_issue(key: str):
    """Fetch full issue details + comments."""
    try:
        issue = jrc("issue", "get", key)
        try:
            issue["comments"] = jrc("issue", "comment", "list", key)
        except Exception:
            issue["comments"] = []
        return key, issue, None
    except Exception as e:
        return key, None, str(e)


def main():
    parser = argparse.ArgumentParser(description="Fetch Jira backlog issues")
    parser.add_argument("--config", "-c", required=True, help="Path to backlog-triage.toml")
    parser.add_argument("--output", "-o", type=Path, default=None, help="Output JSON file (default: /tmp/backlog-triage-{project}/backlog.json)")
    parser.add_argument("--workers", "-w", type=int, default=8, help="Concurrent workers (default: 8)")
    parser.add_argument("--fresh", action="store_true", help="Ignore existing data, re-fetch everything")
    args = parser.parse_args()

    config = load_config(args.config)
    jira_project = config["project"]["jira_project"]
    workdir = get_workdir(config)
    outfile = args.output or (workdir / "backlog.json")

    print(f"Project: {jira_project}", file=sys.stderr)
    print(f"Output: {outfile}", file=sys.stderr)

    # Phase 1: list all backlog issue keys
    print("\nPhase 1: Listing all backlog issues...", file=sys.stderr)
    issue_list = list_all_keys(jira_project)
    keys = [i["key"] for i in issue_list]
    print(f"Found {len(keys)} issues in backlog\n", file=sys.stderr)

    # Phase 2: load existing checkpoint (resume support)
    existing = {}
    if not args.fresh and outfile.exists() and outfile.stat().st_size > 10:
        try:
            existing = {i["key"]: i for i in json.load(outfile.open())}
            print(f"Loaded {len(existing)} issues from checkpoint", file=sys.stderr)
        except Exception:
            pass

    remaining = [k for k in keys if k not in existing]
    print(f"To fetch: {len(remaining)} (skipping {len(existing)} already fetched)\n", file=sys.stderr)

    if not remaining:
        print("Nothing to fetch, all issues already present.", file=sys.stderr)
        return

    # Phase 3: fetch full details + comments
    results = dict(existing)
    done = 0
    errors = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_issue, k): k for k in remaining}
        for f in as_completed(futures):
            key, issue, err = f.result()
            done += 1
            if err:
                errors.append((key, err))
            else:
                results[key] = issue

            if done % 100 == 0:
                print(f"  {done}/{len(remaining)} done, saving checkpoint...", file=sys.stderr)
                ordered = [results[k] for k in keys if k in results]
                with outfile.open("w") as out:
                    json.dump(ordered, out, indent=2)

    # Final save
    ordered = [results[k] for k in keys if k in results]
    with outfile.open("w") as out:
        json.dump(ordered, out, indent=2)

    # Summary
    comments_total = sum(len(i.get("comments", [])) for i in ordered)
    print(f"\nDone: {len(ordered)} issues, {comments_total} comments", file=sys.stderr)
    print(f"Saved to {outfile} ({outfile.stat().st_size / 1024 / 1024:.1f} MB)", file=sys.stderr)
    if errors:
        print(f"Errors ({len(errors)}):", file=sys.stderr)
        for k, e in errors[:20]:
            print(f"  {k}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()

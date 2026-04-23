#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Generate interactive HTML report from backlog triage analysis.

Reads the analysis JSON (produced by the agent's investigation phase) and
the original backlog JSON, then generates a self-contained dark-themed HTML
report with filters, component sections, and per-issue detail cards.

Usage:
    ./gen-backlog-report.py --config backlog-triage.toml
    ./gen-backlog-report.py --config backlog-triage.toml --open
"""

import argparse
import json
import re
import sys
import tomllib
from collections import Counter, defaultdict
from html import escape
from pathlib import Path


def load_config(config_path: str) -> dict:
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def get_workdir(config: dict) -> Path:
    project = config["project"]["jira_project"].lower()
    return Path(f"/tmp/backlog-triage-{project}")


REC_COLORS = {
    "CLOSE": "#dc3545",
    "REVIEW_TO_CLOSE": "#fd7e14",
    "NEEDS_TRIAGE": "#ffc107",
    "KEEP": "#28a745",
    "HIGH_PRIORITY": "#6f42c1",
}
REC_ICONS = {
    "CLOSE": "🗑️",
    "REVIEW_TO_CLOSE": "⚠️",
    "NEEDS_TRIAGE": "🔍",
    "KEEP": "✅",
    "HIGH_PRIORITY": "🔥",
}
TYPE_COLORS = {
    "Bug": "#dc3545", "Story": "#0d6efd", "Epic": "#6f42c1",
    "Task": "#198754", "Feature": "#0dcaf0", "Vulnerability": "#e85d04",
    "Sub-task": "#6c757d", "Service Request": "#d63384",
}
PRIORITY_COLORS = {
    "Blocker": "#dc3545", "Critical": "#e85d04", "Major": "#fd7e14",
    "Normal": "#6c757d", "Minor": "#adb5bd", "Undefined": "#dee2e6",
}
REC_ORDER = {"CLOSE": 0, "REVIEW_TO_CLOSE": 1, "HIGH_PRIORITY": 2, "NEEDS_TRIAGE": 3, "KEEP": 4}


def e(text):
    return escape(str(text))


def badge(text, color, dark=False):
    tc = "#000" if dark else "#fff"
    return f'<span class="badge" style="background:{color};color:{tc}">{e(text)}</span>'


def main():
    parser = argparse.ArgumentParser(description="Generate backlog triage HTML report")
    parser.add_argument("--config", "-c", required=True, help="Path to backlog-triage.toml")
    parser.add_argument("--analysis", type=Path, default=None, help="Analysis JSON (default: workdir/analysis.json)")
    parser.add_argument("--backlog", type=Path, default=None, help="Backlog JSON (default: workdir/backlog.json)")
    parser.add_argument("--output", "-o", type=Path, default=None, help="Output HTML (default: workdir/report.html)")
    parser.add_argument("--open", action="store_true", help="Open report in browser after generating")
    args = parser.parse_args()

    config = load_config(args.config)
    workdir = get_workdir(config)
    jira_base = config["project"]["jira_base"]
    project_name = config["project"]["name"]

    analysis_file = args.analysis or (workdir / "analysis.json")
    backlog_file = args.backlog or (workdir / "backlog.json")
    output_file = args.output or (workdir / "report.html")

    if not analysis_file.exists():
        print(f"Error: Analysis file not found: {analysis_file}", file=sys.stderr)
        print("Run the analyze phase first.", file=sys.stderr)
        sys.exit(1)

    analysis = json.loads(analysis_file.read_text())
    analyzed = analysis["issues"]

    # Enrich with original backlog metadata if available
    originals = {}
    if backlog_file.exists():
        for i in json.loads(backlog_file.read_text()):
            originals[i["key"]] = i

    for item in analyzed:
        key = item.get("key", "")
        orig = originals.get(key, {})
        item.setdefault("type", orig.get("type", "?"))
        item.setdefault("priority", orig.get("priority", "?"))
        item.setdefault("status", orig.get("status", "?"))
        item.setdefault("assignee", orig.get("assignee", ""))
        item.setdefault("summary", orig.get("summary", key))
        item.setdefault("created", (orig.get("created") or "")[:10])
        item.setdefault("updated", (orig.get("updated") or "")[:10])
        comps = orig.get("components", [])
        item.setdefault("components", [c if isinstance(c, str) else c.get("name", "") for c in comps])
        item.setdefault("labels", orig.get("labels", []))

    # Group by component
    by_component = defaultdict(list)
    for i in analyzed:
        comps = i.get("components") or ["(no component)"]
        for c in comps:
            by_component[c].append(i)

    def comp_closable(comp):
        return sum(1 for i in by_component[comp] if i.get("recommendation") in ("CLOSE", "REVIEW_TO_CLOSE"))

    sorted_components = sorted(by_component.keys(), key=lambda c: -comp_closable(c))

    # Counts
    rec_counts = Counter(i.get("recommendation", "?") for i in analyzed)
    confidence_counts = Counter(i.get("confidence", "?") for i in analyzed)
    bands = {r: rec_counts.get(r, 0) for r in REC_ORDER}

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(project_name)} Backlog Triage Report</title>
<style>
  :root {{ --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #e6edf3;
           --text2: #8b949e; --link: #58a6ff; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: var(--bg); color: var(--text); line-height: 1.6; padding: 1rem; max-width: 1600px; margin: 0 auto; }}
  a {{ color: var(--link); text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  h1 {{ font-size: 1.8rem; margin-bottom: 0.3rem; }}
  h2 {{ font-size: 1.3rem; margin: 2rem 0 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }}
  .subtitle {{ color: var(--text2); margin-bottom: 1.5rem; }}
  .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 1.5rem 0; }}
  .stat {{ background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; text-align: center; }}
  .stat-value {{ font-size: 2rem; font-weight: 700; }}
  .stat-label {{ color: var(--text2); font-size: 0.85rem; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin: 1px; white-space: nowrap; }}
  .component-section {{ background: var(--card); border: 1px solid var(--border); border-radius: 8px; margin: 1rem 0; overflow: hidden; }}
  .component-header {{ padding: 0.8rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }}
  .component-header:hover {{ background: #1c2129; }}
  .component-header h3 {{ font-size: 1.1rem; margin: 0; }}
  .component-stats {{ display: flex; gap: 0.5rem; flex-wrap: wrap; }}
  .issue {{ border-bottom: 1px solid #21262d; padding: 0.8rem 1rem; }}
  .issue:hover {{ background: #1c2129; }}
  .issue.close {{ border-left: 3px solid #dc3545; }}
  .issue.review {{ border-left: 3px solid #fd7e14; }}
  .issue.high {{ border-left: 3px solid #6f42c1; }}
  .issue.keep {{ border-left: 3px solid #28a745; }}
  .issue.triage {{ border-left: 3px solid #ffc107; }}
  .issue-header {{ display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }}
  .issue-key {{ font-weight: 700; font-size: 0.9rem; }}
  .issue-summary {{ flex: 1; min-width: 200px; }}
  .issue-meta {{ color: var(--text2); font-size: 0.8rem; }}
  .issue-reason {{ margin-top: 0.4rem; font-size: 0.88rem; line-height: 1.5; color: #c9d1d9; }}
  .issue-evidence {{ margin-top: 0.3rem; font-size: 0.82rem; color: var(--link); }}
  .issue-comment {{ margin-top: 0.3rem; font-size: 0.82rem; color: #7ee787; font-style: italic; }}
  .issue-tags {{ margin-top: 0.3rem; }}
  .tag {{ display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 0.7rem;
          background: #21262d; color: var(--text2); margin: 1px; }}
  .score-bar {{ width: 50px; height: 16px; background: #21262d; border-radius: 8px; overflow: hidden; position: relative; display: inline-block; vertical-align: middle; }}
  .score-fill {{ height: 100%; border-radius: 8px; }}
  .score-text {{ position: absolute; top: 0; left: 0; right: 0; text-align: center; font-size: 0.65rem; font-weight: 700; line-height: 16px; }}
  .confidence {{ font-size: 0.7rem; padding: 1px 5px; border-radius: 6px; }}
  .confidence-high {{ background: #238636; color: #fff; }}
  .confidence-medium {{ background: #9e6a03; color: #fff; }}
  .confidence-low {{ background: #da3633; color: #fff; }}
  .toc {{ background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin: 1rem 0; columns: 3; column-gap: 1rem; }}
  .toc a {{ display: block; padding: 2px 0; font-size: 0.85rem; break-inside: avoid; }}
  .filter-bar {{ margin: 1rem 0; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }}
  .filter-btn {{ padding: 4px 12px; border-radius: 16px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 0.8rem; }}
  .filter-btn:hover, .filter-btn.active {{ border-color: var(--link); color: var(--link); }}
  .collapse-content {{ max-height: 0; overflow: hidden; transition: max-height 0.3s; }}
  .collapse-content.open {{ max-height: none; }}
  .chevron {{ transition: transform 0.2s; display: inline-block; }}
  .chevron.open {{ transform: rotate(90deg); }}
  .search-box {{ padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.85rem; width: 250px; }}
  @media (max-width: 768px) {{ .toc {{ columns: 1; }} .summary {{ grid-template-columns: 1fr 1fr; }} }}
</style>
</head>
<body>

<h1>🧠 {e(project_name)} Backlog Triage Report</h1>
<p class="subtitle">Generated {analysis.get("generated", "?")[:10]} · {len(analyzed)} issues ·
   Confidence: {confidence_counts.get("high", 0)} high, {confidence_counts.get("medium", 0)} medium, {confidence_counts.get("low", 0)} low</p>

<div class="summary">
  <div class="stat"><div class="stat-value" style="color:#dc3545">{bands.get("CLOSE",0)}</div><div class="stat-label">🗑️ Close</div></div>
  <div class="stat"><div class="stat-value" style="color:#fd7e14">{bands.get("REVIEW_TO_CLOSE",0)}</div><div class="stat-label">⚠️ Review to Close</div></div>
  <div class="stat"><div class="stat-value" style="color:#ffc107">{bands.get("NEEDS_TRIAGE",0)}</div><div class="stat-label">🔍 Needs Triage</div></div>
  <div class="stat"><div class="stat-value" style="color:#28a745">{bands.get("KEEP",0)}</div><div class="stat-label">✅ Keep</div></div>
  <div class="stat"><div class="stat-value" style="color:#6f42c1">{bands.get("HIGH_PRIORITY",0)}</div><div class="stat-label">🔥 High Priority</div></div>
</div>

<div class="filter-bar">
  <span style="color:var(--text2)">Filter:</span>
  <button class="filter-btn active" onclick="filterRec('all')">All</button>
  <button class="filter-btn" onclick="filterRec('CLOSE')">🗑️ Close ({bands.get("CLOSE",0)})</button>
  <button class="filter-btn" onclick="filterRec('REVIEW_TO_CLOSE')">⚠️ Review ({bands.get("REVIEW_TO_CLOSE",0)})</button>
  <button class="filter-btn" onclick="filterRec('NEEDS_TRIAGE')">🔍 Triage ({bands.get("NEEDS_TRIAGE",0)})</button>
  <button class="filter-btn" onclick="filterRec('KEEP')">✅ Keep ({bands.get("KEEP",0)})</button>
  <button class="filter-btn" onclick="filterRec('HIGH_PRIORITY')">🔥 High ({bands.get("HIGH_PRIORITY",0)})</button>
  <input type="text" class="search-box" placeholder="Search issues..." oninput="searchIssues(this.value)">
</div>

<h2>Components</h2>
<div class="toc">
"""

    for comp in sorted_components:
        items = by_component[comp]
        closable = sum(1 for i in items if i.get("recommendation") in ("CLOSE", "REVIEW_TO_CLOSE"))
        anchor = re.sub(r"[^a-z0-9-]", "", comp.lower().replace(" ", "-"))
        html += f'  <a href="#{anchor}">{e(comp)} ({len(items)}, {closable} closable)</a>\n'

    html += "</div>\n"

    for comp in sorted_components:
        items = by_component[comp]
        anchor = re.sub(r"[^a-z0-9-]", "", comp.lower().replace(" ", "-"))
        items_sorted = sorted(items, key=lambda x: (REC_ORDER.get(x.get("recommendation", ""), 3), x.get("relevance_score", 50)))

        comp_rec_counts = Counter(i.get("recommendation", "?") for i in items)
        stats_html = " ".join(
            badge(f"{REC_ICONS.get(r, '')} {c}", REC_COLORS.get(r, "#6c757d"))
            for r, c in sorted(comp_rec_counts.items(), key=lambda x: REC_ORDER.get(x[0], 3))
        )

        html += f"""
<div class="component-section" id="{anchor}">
  <div class="component-header" onclick="toggleSection(this)">
    <h3><span class="chevron">▶</span> {e(comp)} ({len(items)})</h3>
    <div class="component-stats">{stats_html}</div>
  </div>
  <div class="collapse-content">
"""
        for item in items_sorted:
            rec = item.get("recommendation", "?")
            score = item.get("relevance_score", 50)
            row_class = {"CLOSE": "close", "REVIEW_TO_CLOSE": "review", "HIGH_PRIORITY": "high", "KEEP": "keep", "NEEDS_TRIAGE": "triage"}.get(rec, "")

            scolor = "#dc3545" if score <= 20 else "#fd7e14" if score <= 35 else "#ffc107" if score <= 50 else "#28a745" if score <= 75 else "#6f42c1"
            score_html = f'<span class="score-bar"><span class="score-fill" style="width:{score}%;background:{scolor}"></span><span class="score-text">{score}</span></span>'

            conf = item.get("confidence", "?")
            conf_class = f"confidence-{conf}" if conf in ("high", "medium", "low") else ""
            conf_html = f'<span class="confidence {conf_class}">{conf}</span>'

            rec_html = badge(f"{REC_ICONS.get(rec, '')} {rec}", REC_COLORS.get(rec, "#6c757d"))
            type_html = badge(item.get("type", "?"), TYPE_COLORS.get(item.get("type"), "#6c757d"))
            prio = item.get("priority", "?")
            prio_html = badge(prio, PRIORITY_COLORS.get(prio, "#dee2e6"), dark=prio in ("Undefined", "Minor", "Normal"))

            tags_html = ""
            if item.get("tags"):
                tags_html = '<div class="issue-tags">' + "".join(f'<span class="tag">{e(t)}</span>' for t in item["tags"]) + "</div>"

            evidence_html = ""
            if item.get("upstream_evidence"):
                evidence_html = f'<div class="issue-evidence">↗ {e(item["upstream_evidence"])}</div>'

            comment_html = ""
            if item.get("suggested_comment"):
                comment_html = f'<div class="issue-comment">💬 Suggested: {e(item["suggested_comment"])}</div>'

            html += f"""    <div class="issue {row_class}" data-rec="{rec}" data-text="{e(item.get("key", "") + " " + item.get("summary", ""))}">
      <div class="issue-header">
        <a class="issue-key" href="{jira_base}/{item["key"]}" target="_blank">{item["key"]}</a>
        {type_html} {prio_html} {score_html} {conf_html} {rec_html}
        <span class="issue-meta">{item.get("created", "")} · {item.get("updated", "")}</span>
      </div>
      <div class="issue-summary">{e(item.get("summary", ""))}</div>
      <div class="issue-reason">{e(item.get("reason", ""))}</div>
      {evidence_html}{comment_html}{tags_html}
    </div>
"""

        html += "  </div>\n</div>\n"

    html += """
<script>
function toggleSection(header) {
  const content = header.nextElementSibling;
  const chevron = header.querySelector('.chevron');
  content.classList.toggle('open');
  chevron.classList.toggle('open');
}
function filterRec(rec) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.issue').forEach(el => {
    el.style.display = (rec === 'all' || el.dataset.rec === rec) ? '' : 'none';
  });
}
function searchIssues(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.issue').forEach(el => {
    const text = (el.dataset.text || '').toLowerCase() + ' ' + el.textContent.toLowerCase();
    el.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}
// Auto-open sections with CLOSE or HIGH_PRIORITY
document.querySelectorAll('.component-section').forEach(section => {
  if (section.querySelector('.issue.close, .issue.high')) {
    section.querySelector('.collapse-content').classList.add('open');
    section.querySelector('.chevron').classList.add('open');
  }
});
</script>
</body>
</html>
"""

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(html)
    print(f"Report: {output_file} ({len(html) / 1024:.0f} KB)", file=sys.stderr)

    rec_summary = Counter(i.get("recommendation", "?") for i in analyzed)
    print(f"\nRecommendation summary:", file=sys.stderr)
    for rec in ["CLOSE", "REVIEW_TO_CLOSE", "NEEDS_TRIAGE", "KEEP", "HIGH_PRIORITY"]:
        print(f"  {REC_ICONS.get(rec, '')} {rec}: {rec_summary.get(rec, 0)}", file=sys.stderr)

    if args.open:
        import subprocess
        subprocess.run(["xdg-open", str(output_file)], check=False)


if __name__ == "__main__":
    main()

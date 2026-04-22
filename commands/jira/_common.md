# Jira Skills — Shared Conventions

This file is the **single source of truth** for logic that is common across all
`/jira:create` sub-skills. Sub-skills reference this file instead of duplicating it.

---

## ⚠️ CRITICAL SAFETY RULES

### SRVKP Project Only

- ✅ **ONLY SRVKP project** — reject all other projects immediately
- ❌ Do NOT accept OCPBUGS, CNTRLPLANE, or any other project

### Confirmation Required

- ✅ **MUST show complete issue preview** before creation
- ✅ **MUST get explicit user confirmation** (yes/no)
- ❌ **NEVER create issues** without user approval
- ❌ **NEVER auto-create** or assume confirmation

### Deletion — Absolute Prohibition

This skill set is for **CREATION ONLY**.

- Do NOT use `jira_delete_issue` MCP tool under any circumstances
- If the user requests deletion, politely decline and explain it must be done manually in Jira UI
- If an issue was created incorrectly, inform the user and suggest creating a corrected version

### Updates — Require Explicit User Approval

**NEVER** use any of the following without explicit user approval:

- `jira_update_issue`
- `jira_transition_issue`
- `jira_add_comment`
- `jira_add_worklog`
- NEVER modify existing SRVKP issues unless the user explicitly says "update SRVKP-123"

Before any update operation:

1. Show which issue will be modified (key and current state)
2. Show exactly what changes will be made
3. Ask: "Do you want me to proceed with this update? (yes/no)"
4. Wait for explicit "yes" — if unclear, do NOT proceed

### Read-Only Operations (Always Safe)

These never require approval:

- `jira_get_issue` — reading issue details
- `jira_search` — searching for issues
- `jira_get_project_issues` — listing project issues
- `jira_get_transitions` — viewing available transitions
- Any other read/query operation

### When User Requests Modifications

If user says "fix SRVKP-123" or similar:

1. **DO NOT** automatically update the issue
2. Ask: "What would you like me to do? Options: add comment, view issue, or something else?"
3. Wait for explicit action and confirmation

### Operation Summary

| Operation | Allowed? |
|-----------|---------|
| CREATE new issues (after preview + confirmation) | ✅ |
| READ any issue | ✅ |
| DELETE any issue | ❌ Absolutely prohibited |
| UPDATE any issue | ⚠️ Only with explicit approval after showing exact changes |

---

## SRVKP Component Suggestions

Components are **auto-suggested** from keywords in the issue summary. Present the suggestion
to the user; they may accept, choose a different component, or skip it (optional field).

### Keyword → Component Mapping

| Keywords | Suggested Component |
|----------|-------------------|
| pipeline, task, taskrun, pipelinerun, workflow, execution | Tekton Pipelines |
| chain, signing, signature, attestation, provenance, supply-chain, security | Tekton Chains |
| trigger, eventlistener, webhook, event, interceptor | Tekton Triggers |
| cli, command, tkn, terminal | Tekton Cli |
| hub, catalog, artifact, registry, repository | Tekton Hub |
| result, log, storage, record, history, persistence | Tekton Results |
| operator, installation, deployment, upgrade, configuration, setup | Operator |
| pac, pipelinesascode, github, gitlab, gitops | Pipeline as Code |
| cache, caching, performance, optimization | Tekton Cache |
| pruner, cleanup, retention, gc, garbage collection, deletion | Pruner |
| ui, dashboard, frontend, web, console, interface | UI |
| ai, machine learning, ml, artificial intelligence | AI |

### Available SRVKP Components (full list)

Tekton Pipelines, Tekton Chains, Tekton Triggers, Tekton Cli, Tekton Hub, Tekton Results,
Operator, Pipeline as Code, Tekton Cache, Pruner, UI, AI

### User Options

- ✅ Accept the auto-suggested component
- ✅ Choose a different component from the list above
- ✅ Skip (component is optional)

---

## MCP → CLI Fallback Decision Tree

Use this decision tree whenever creating or searching Jira issues:

```
Step 1 ─── Call MCP tool
           mcp__atlassian__jira_create_issue(project_key="SRVKP", ...)

Step 2 ─── Inspect result
           │
           ├─ SUCCESS (result contains issue key)
           │   └─ Return issue key and URL to user ✓
           │
           └─ ERROR (result contains any of the following)
               • "Tool rejected: User rejected MCP"
               • "MCP server does not exist"
               • "Connection refused" / timeout
               │
               └─ Step 3: Switch to CLI fallback (no user intervention needed)
                   Run: acli jira workitem create
                        --project "SRVKP"
                        --type   "<same type>"
                        --summary "<same summary>"
                        --description "$(cat <<'EOF' ... EOF)"
                        [--parent "<same parent if any>"]
                        --label "ai-generated-jira"
                        --json
                   └─ Return issue key and URL to user ✓
```

> The LLM cannot catch MCP exceptions in code. **Check whether the tool result contains
> an error message** (step 2) and branch accordingly. The payload must be identical between
> the MCP call and the CLI fallback.

Full `acli` command syntax and examples: [`reference/cli-fallback.md`](reference/cli-fallback.md)

---

## Mandatory Confirmation Flow

Every sub-skill **must** follow this flow before creating any issue:

```
1. Collect all required fields for the issue type
2. Auto-suggest component from summary keywords (see table above)
3. Format description using the issue-type template
4. Scan for sensitive data (credentials, API keys, secrets) — STOP if found
5. Validate required fields are populated
6. Show complete preview:

   ═══════════════════════════════════════════
   PREVIEW: SRVKP <Type>
   ═══════════════════════════════════════════

   Project:     SRVKP
   Type:        <issue type>
   Summary:     <summary>
   Component:   <component> (auto-suggested / user-selected)
   Labels:      ai-generated-jira
   Parent:      <parent key if applicable>

   Description:
   <full formatted description>

   ═══════════════════════════════════════════

7. Ask: "Create this <type>? (yes/no): "
8. Wait for explicit response
   ├─ "yes" → follow MCP → CLI fallback decision tree; return issue key + URL
   └─ "no"  → "Issue creation cancelled. No changes made to Jira."
               Offer: 1) modify details and retry  2) cancel completely
```

---

## Auto-Applied SRVKP Conventions

Every issue created by these skills automatically gets:

| Field | Value |
|-------|-------|
| Project | SRVKP |
| Labels | `ai-generated-jira` |
| Component | Auto-suggested (user can override) |
| Description format | Issue-type specific Jira wiki markup template |

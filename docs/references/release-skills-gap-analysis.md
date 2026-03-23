# Release Skills Gap Analysis

**Created:** 2026-01-19
**Updated:** 2026-01-19
**Purpose:** Track gaps between the Minor Release Guide documentation and existing skills to inform roadmap planning.

---

## Executive Summary

~~The existing skills cover **patch release workflows** well but are **missing critical minor release setup phases**.~~

**Update (2026-01-19):** Milestone 1 (Core Release Workflow) is now **COMPLETE**. Six new skills have been created covering hack configuration through production release. The remaining gaps are in Phase 2 (Pre-Release Setup).

---

## Gap Analysis Matrix

### Priority 1: Currently Missing (Pre-Release Setup) - Future Work

| Phase | Description | Exists? | Priority | Effort |
|-------|-------------|---------|----------|--------|
| Timeline Planning | Set freeze dates, create metrics doc | No | Low | Small |
| Dashboard Update | Update p12n repo dashboard | No | Low | Small |
| Branch Creation | Create release branches on all repos | No | High | Medium |
| COMET Creation | Add new images via CPAAS/PYXIS | No | Medium | Medium |
| CPAAS Configuration | Configure CPAAS, HoneyBadger, Advisory | No | Medium | Large |
| CLI RPM Configuration | Configure CLI RPM builds | No | Medium | Medium |

### Priority 2: Configuration Phase - ✅ COMPLETED

| Phase | Description | Exists? | Status |
|-------|-------------|---------|--------|
| Hack Configuration | Configure konflux, repos, workflows | ✅ Yes | `/osp:hack-config` |
| Component Configuration | Update Dockerfiles, run update-sources | ✅ Yes | `/osp:component-config` |
| Operator Configuration | Configure operator project.yaml, scripts | ✅ Yes | `/osp:operator-config` |

### Priority 3: Build & Release - ✅ COMPLETED

| Phase | Description | Exists? | Status |
|-------|-------------|---------|--------|
| Get Devel Build | operator-update-images, index-render-template for devel | ✅ Yes | `/osp:operator-release` (existing) |
| Release Configuration (Konflux CRD) | RPA, RP, Release YAML creation | ✅ Yes | `/osp:release-config` |
| Stage Release | CORE → CLI → OPERATOR → INDEX stage flow | ✅ Yes | `/osp:stage-release` |
| Prod Release | CORE → CLI → OPERATOR → INDEX prod flow | ✅ Yes | `/osp:prod-release` |

---

## Existing Skills Assessment

### `/osp:release-checklist` (commands/osp/release-checklist.md)
**Coverage:** CVE analysis, component mapping, PR creation for patch releases
**Gap:**
- Doesn't cover initial minor release setup (branch creation, hack config)
- No COMET/CPAAS guidance
- No Konflux CRD (RPA/RP) creation
- No stage/prod release execution

### `/osp:operator-release` (commands/osp/operator-release.md)
**Coverage:** operator-update-images, index-render-template workflows
**Gap:**
- Doesn't cover CORE or CLI release steps
- Missing stage/prod snapshot management
- No release YAML application guidance

### `/osp:release-status` (commands/osp/release-status.md)
**Coverage:** Jira version tracking, issue status
**Gap:** Adequate for its purpose

### `/osp:component-status` (commands/osp/component-status.md)
**Coverage:** Single component readiness check
**Gap:**
- Doesn't guide through the configuration process
- Read-only, doesn't help execute

---

## Proposed New Skills

### Phase 1: Hack Configuration to Stage/Prod (Current Focus)

1. **`/osp:hack-config`** - Configure hack repo for new release
   - Update config/konflux files
   - Update config/konflux/repos branch mappings
   - Create and merge hack PR
   - Apply .konflux resources to cluster

2. **`/osp:component-config`** - Configure a single component
   - Merge hack-generated PRs
   - Update Dockerfiles (base images, versions)
   - Run update-sources workflow
   - Monitor CI and merge

3. **`/osp:operator-config`** - Configure operator for release
   - Update .tekton files
   - Update project.yaml (versions, SHAs)
   - Adjust hack scripts (RHEL version, channels)
   - Run update-sources
   - Verify OLM catalog changes

4. **`/osp:release-config`** - Create Konflux release resources
   - Create RPA files (prod/stage)
   - Create RP files (prod/stage)
   - Create release YAML files in hack repo
   - Submit MR to konflux-release-data

5. **`/osp:stage-release`** - Execute stage release
   - CORE release
   - CLI release (with PAC dependency)
   - OPERATOR release
   - INDEX release
   - Announce

6. **`/osp:prod-release`** - Execute prod release
   - Same flow as stage with production environment

### Phase 2: Pre-Release Setup (Future)

7. **`/osp:init-release`** - Initialize new minor release
   - Timeline planning checklist
   - Branch creation on all repos
   - Dashboard update guidance

8. **`/osp:comet-config`** - COMET creation for new images
   - CPAAS MR creation
   - HoneyBadger job triggering
   - COMET verification

9. **`/osp:cpaas-config`** - CPAAS configuration
   - CPAAS Configuration Guide steps
   - HoneyBadger Configuration
   - Advisory creation

---

## Implementation Roadmap

### Milestone 1: Core Release Workflow - ✅ COMPLETED
Focus: Hack Configuration → Stage/Prod Release

| Skill | Status | File |
|-------|--------|------|
| `/osp:hack-config` | ✅ Complete | `commands/osp/hack-config.md` |
| `/osp:component-config` | ✅ Complete | `commands/osp/component-config.md` |
| `/osp:operator-config` | ✅ Complete | `commands/osp/operator-config.md` |
| `/osp:release-config` | ✅ Complete | `commands/osp/release-config.md` |
| `/osp:stage-release` | ✅ Complete | `commands/osp/stage-release.md` |
| `/osp:prod-release` | ✅ Complete | `commands/osp/prod-release.md` |

### Milestone 2: Pre-Release Setup (Future)
Focus: Everything before Hack Configuration

| Skill | Dependencies | Estimated Effort |
|-------|--------------|------------------|
| `/osp:init-release` | None | Medium |
| `/osp:comet-config` | init-release | Medium |
| `/osp:cpaas-config` | comet-config | Large |

---

## Key Dependencies & Considerations

1. **PAC → CLI dependency:** CLI depends on PAC image, must configure PAC first
2. **Component → Operator dependency:** All component images needed before operator
3. **Operator → Index dependency:** Bundle image needed before index generation
4. **Stage → Prod flow:** Stage must complete before prod

---

## Reference Documents

- `docs/references/minor-release-guide.md` - Full release guide
- `commands/osp/release-checklist.md` - Existing patch release skill
- `commands/osp/operator-release.md` - Existing operator workflow skill

---

*This document should be updated as skills are implemented and gaps are closed.*

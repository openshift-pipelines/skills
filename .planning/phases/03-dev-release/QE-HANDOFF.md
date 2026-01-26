# OpenShift Pipelines 1.15.4 Dev Release

@pipelines-qe-all 1.15.4 dev builds

```
quay.io/openshift-pipeline/pipelines-index-4.18:1.15
quay.io/openshift-pipeline/pipelines-index-4.17:1.15
quay.io/openshift-pipeline/pipelines-index-4.16:1.15
quay.io/openshift-pipeline/pipelines-index-4.15:1.15
quay.io/openshift-pipeline/pipelines-index-4.14:1.15
```

---

**Issues Encountered (Fixed)**

• ISS-005: Index pipeline serviceAccountName missing — Fixed via PR #14224
• Stale component images (8/11 >72h old) — Triggered rebuilds, all fresh now
• PAC_BUILDER registry issue — Switched to quay.io/openshift-pipeline (PR #906)
• Go 1.25 builder update — PR #14352

---

**Known Issues**

• ISS-006: Snyk SAST false positives (Stage release blocker)
  - Snyk flags K8s Secret resource names as "hardcoded credentials"
  - Affects operator/proxy/webhook PRs
  - EC fails but GitHub merge works
  - Must fix before stage release

• Bundle uses pre-Go 1.25 operator images
  - CVE fixes ARE included
  - Fresh bundle build needed for stage

---

**What's Fixed in 1.15.4**

• CVE (jwt-go) — Upgraded to v4.5.2
• CVE (x/crypto) — Upgraded to v0.35.0
• CVE (oauth2) — Upgraded to v0.27.0
• TKN_VERSION — Updated to 0.37.2
• PAC_BUILDER — Fixed registry reference

---

## v2 Images (2026-01-26)

**What changed from v1:**
- FIPS compliance fix in nop image (PR #1540 merged to tektoncd-pipeline)
- PAC images rebuilt with fresh SHAs

**Changed Images:**

| Image | Old SHA | New SHA |
|-------|---------|---------|
| pipelines-pipeline-nop-rhel8 | `01381d3d...` | `96ea90a4...` |
| pipelines-pipelines-as-code-controller-rhel8 | `193efdd6...` | `92c057af...` |
| pipelines-pipelines-as-code-watcher-rhel8 | `e8fb19b9...` | `39553942...` |
| pipelines-pipelines-as-code-cli-rhel8 | — | `ba92c740...` |
| pipelines-operator-bundle-rhel8 | — | `92b52e94...` |

**Component Images:** All v2 images copied to `quay.io/openshift-pipeline/` with tag `v1.15.4`

**Index Images:** ⚠️ PENDING - Need Konflux auth to copy fresh index images. Existing index images may still reference old bundle.

**Testing focus for v2:**
- FIPS mode verification (if FIPS cluster available)
- PAC controller/watcher functionality
- Verify nop container runs correctly

**To get v2 images:**
QE can pull component images directly with `v1.15.4` tag. For full operator install, fresh index images are needed (blocked on Konflux auth).

---

# Phase 3.2: Missing Image Copy Log

**Date:** 2026-01-21
**Task:** Copy 16 missing images to quay.io/openshift-pipeline

## Pre-Copy Verification

| Image | Digest | Dev Status |
|-------|--------|------------|
| pipelines-chains-controller-rhel8 | f02af8475c33... | ✗ MISSING (needs copy) |
| pipelines-console-plugin-rhel8 | ed88d763974f... | ✗ MISSING (needs copy) |
| pipelines-entrypoint-rhel8 | 6c491cf4dbb6... | ✗ MISSING (needs copy) |
| pipelines-hub-api-rhel8 | 1db14f230777... | ✗ MISSING (needs copy) |
| pipelines-hub-ui-rhel8 | aca0024cac7a... | ✗ MISSING (needs copy) |
| pipelines-manual-approval-gate-controller-rhel8 | 02827dac627e... | ✗ MISSING (needs copy) |
| pipelines-manual-approval-gate-webhook-rhel8 | 29430aa7bc21... | ✗ MISSING (needs copy) |
| pipelines-operator-proxy-rhel8 | 08b869d84a4e... | ✗ MISSING (needs copy) |
| pipelines-pipelines-as-code-controller-rhel8 | 193efdd67f1a... | ✗ MISSING (needs copy) |
| pipelines-pipelines-as-code-watcher-rhel8 | e8fb19b9a343... | ✗ MISSING (needs copy) |
| pipelines-pipelines-as-code-webhook-rhel8 | db52a528ea33... | ✗ MISSING (needs copy) |
| pipelines-results-api-rhel8 | eed464a3b4e2... | ✗ MISSING (needs copy) |
| pipelines-results-watcher-rhel8 | 7c81ae208a16... | ✗ MISSING (needs copy) |
| pipelines-triggers-core-interceptors-rhel8 | abac279a0a5e... | ✗ MISSING (needs copy) |
| pipelines-triggers-webhook-rhel8 | 61c22119f37e... | ✗ MISSING (needs copy) |
| pipelines-webhook-rhel8 | 9c87878a52d9... | ✗ MISSING (needs copy) |

**Summary:** All 16 images confirmed MISSING from dev registry - all need to be copied.

**Next step:** Identify source images in Konflux registry and copy to dev registry.


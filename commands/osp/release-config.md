---
name: release-config
description: Create Konflux release resources (RPA, RP, Release YAML)
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Release Configuration (Konflux CRD)

<objective>
Create and configure Konflux release resources for stage and production releases. This includes ReleasePlanAdmission (RPA), ReleasePlan (RP), and Release YAML files.

Use this skill after `/osp:operator-config` is complete and devel builds have been tested by QE.
</objective>

<execution_context>
**Prerequisites:**
- Operator configuration complete (`/osp:operator-config`)
- Devel builds generated and tested by QE
- Access to GitLab `gitlab.cee.redhat.com` (Red Hat internal)
- Access to openshift-pipelines/hack repository

**Konflux Resources:**
| Resource | Purpose | Location |
|----------|---------|----------|
| ReleasePlanAdmission (RPA) | Defines what can be released and how | konflux-release-data GitLab repo |
| ReleasePlan (RP) | Defines specific release plans for apps | konflux-release-data GitLab repo |
| Release YAML | Triggers actual release with snapshot | hack repo (per version) |

**Applications:**
| Application | Contents |
|-------------|----------|
| core | Pipeline, Triggers, Chains, Results, Hub, PAC, git-init, Manual-approval-gate, Console-plugin |
| cli | CLI (tkn), OPC |
| operator | Operator, Bundle |
| fbc (index) | OLM index images for each OCP version |

**Release Type:**
- Minor releases: **RHEA** (Red Hat Enhancement Advisory)
- Patch releases: **RHBA** (Red Hat Bug Advisory)

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.
</execution_context>

<process>
<step name="get_input">
Get the release version from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which minor release version? (e.g., 1.20.0)"

Derive values:
```bash
RELEASE_VERSION="1.20.0"
MINOR_VERSION="${RELEASE_VERSION%.*}"  # e.g., 1.20
BRANCH="release-v${MINOR_VERSION}.x"

echo "Release version: ${RELEASE_VERSION}"
echo "Minor version: ${MINOR_VERSION}"
echo "Branch: ${BRANCH}"
```
</step>

<step name="verify_prerequisites">
Verify prerequisites are met:

```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Checking Konflux applications ==="

# Check core application
echo "Core application:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-${VERSION_DASH}"

# Check operator application
echo ""
echo "Operator application:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-operator-${VERSION_DASH}"

# Check index application
echo ""
echo "Index (FBC) application:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-index-${VERSION_DASH}"

echo ""
echo "Verify all applications have green builds before proceeding."
```

Use AskUserQuestion:
- header: "Builds"
- question: "Have all Konflux application builds passed (core, cli, operator, index)?"
- options: ["Yes, all green", "Need to check", "Some failing"]
</step>

<step name="clone_konflux_release_data">
Clone the konflux-release-data repository:

```bash
WORK_DIR="/tmp/konflux-release-data"
rm -rf "${WORK_DIR}"

echo "Cloning konflux-release-data..."
git clone https://gitlab.cee.redhat.com/releng/konflux-release-data.git "${WORK_DIR}"
cd "${WORK_DIR}"

echo "Cloned to ${WORK_DIR}"
```
</step>

<step name="check_existing_rpa">
Check for existing RPA files as reference:

```bash
cd "${WORK_DIR}"

echo "=== Existing RPA files for tekton-ecosystem ==="
ls -la config/kflux-prd-rh02.0fk9.p1/product/ReleasePlanAdmission/tekton-ecosystem/

echo ""
echo "=== Sample RPA structure ==="
# Show a sample RPA file
cat config/kflux-prd-rh02.0fk9.p1/product/ReleasePlanAdmission/tekton-ecosystem/*.yaml 2>/dev/null | head -50
```

**RPA files needed for release:**
1. `openshift-pipelines-core-{version}-prod.yaml`
2. `openshift-pipelines-core-{version}-stage.yaml`
3. `openshift-pipelines-cli-{version}-prod.yaml`
4. `openshift-pipelines-cli-{version}-stage.yaml`
5. `openshift-pipelines-operator-{version}-prod.yaml`
6. `openshift-pipelines-operator-{version}-stage.yaml`
7. `openshift-pipelines-fbc-{version}-prod.yaml` (for each OCP version)
8. `openshift-pipelines-fbc-{version}-stage.yaml` (for each OCP version)
</step>

<step name="create_rpa_files">
Create ReleasePlanAdmission files for the new version.

**Navigate to RPA directory:**
```bash
cd "${WORK_DIR}/config/kflux-prd-rh02.0fk9.p1/product/ReleasePlanAdmission/tekton-ecosystem"
```

**Template for Core RPA (stage):**
```yaml
apiVersion: appstudio.redhat.com/v1alpha1
kind: ReleasePlanAdmission
metadata:
  name: openshift-pipelines-core-{MINOR_VERSION}-stage
  namespace: rhtap-releng-tenant
spec:
  applications:
    - openshift-pipelines-{VERSION_DASH}
  data:
    # Stage-specific configuration
    releaseNotes:
      type: RHEA
      synopsis: "OpenShift Pipelines {RELEASE_VERSION}"
  origin: tekton-ecosystem-tenant
  pipeline:
    pipelineRef:
      resolver: git
      params:
        - name: url
          value: https://github.com/redhat-appstudio/release-service-catalog
        - name: revision
          value: main
        - name: pathInRepo
          value: pipelines/rh-advisories/rh-advisories.yaml
  policy: rh-policy
```

**Template for Core RPA (prod):**
```yaml
apiVersion: appstudio.redhat.com/v1alpha1
kind: ReleasePlanAdmission
metadata:
  name: openshift-pipelines-core-{MINOR_VERSION}-prod
  namespace: rhtap-releng-tenant
spec:
  applications:
    - openshift-pipelines-{VERSION_DASH}
  data:
    releaseNotes:
      type: RHEA
      synopsis: "OpenShift Pipelines {RELEASE_VERSION}"
  origin: tekton-ecosystem-tenant
  pipeline:
    pipelineRef:
      resolver: git
      params:
        - name: url
          value: https://github.com/redhat-appstudio/release-service-catalog
        - name: revision
          value: main
        - name: pathInRepo
          value: pipelines/rh-advisories/rh-advisories.yaml
  policy: rh-policy
```

**Copy from previous version and update:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"
PREV_VERSION="1.19"
PREV_VERSION_DASH="${PREV_VERSION//./-}"

# Core RPA files
for env in stage prod; do
  if [ -f "openshift-pipelines-core-${PREV_VERSION_DASH}-${env}.yaml" ]; then
    cp "openshift-pipelines-core-${PREV_VERSION_DASH}-${env}.yaml" \
       "openshift-pipelines-core-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION}/${MINOR_VERSION}/g" "openshift-pipelines-core-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION_DASH}/${VERSION_DASH}/g" "openshift-pipelines-core-${VERSION_DASH}-${env}.yaml"
    echo "Created openshift-pipelines-core-${VERSION_DASH}-${env}.yaml"
  fi
done

# CLI RPA files
for env in stage prod; do
  if [ -f "openshift-pipelines-cli-${PREV_VERSION_DASH}-${env}.yaml" ]; then
    cp "openshift-pipelines-cli-${PREV_VERSION_DASH}-${env}.yaml" \
       "openshift-pipelines-cli-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION}/${MINOR_VERSION}/g" "openshift-pipelines-cli-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION_DASH}/${VERSION_DASH}/g" "openshift-pipelines-cli-${VERSION_DASH}-${env}.yaml"
    echo "Created openshift-pipelines-cli-${VERSION_DASH}-${env}.yaml"
  fi
done

# Operator RPA files
for env in stage prod; do
  if [ -f "openshift-pipelines-operator-${PREV_VERSION_DASH}-${env}.yaml" ]; then
    cp "openshift-pipelines-operator-${PREV_VERSION_DASH}-${env}.yaml" \
       "openshift-pipelines-operator-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION}/${MINOR_VERSION}/g" "openshift-pipelines-operator-${VERSION_DASH}-${env}.yaml"
    sed -i "s/${PREV_VERSION_DASH}/${VERSION_DASH}/g" "openshift-pipelines-operator-${VERSION_DASH}-${env}.yaml"
    echo "Created openshift-pipelines-operator-${VERSION_DASH}-${env}.yaml"
  fi
done

# FBC (index) RPA files for each OCP version
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  for env in stage prod; do
    if [ -f "openshift-pipelines-fbc-${PREV_VERSION_DASH}-v${ocp}-${env}.yaml" ]; then
      cp "openshift-pipelines-fbc-${PREV_VERSION_DASH}-v${ocp}-${env}.yaml" \
         "openshift-pipelines-fbc-${VERSION_DASH}-v${ocp}-${env}.yaml"
      sed -i "s/${PREV_VERSION}/${MINOR_VERSION}/g" "openshift-pipelines-fbc-${VERSION_DASH}-v${ocp}-${env}.yaml"
      sed -i "s/${PREV_VERSION_DASH}/${VERSION_DASH}/g" "openshift-pipelines-fbc-${VERSION_DASH}-v${ocp}-${env}.yaml"
      echo "Created openshift-pipelines-fbc-${VERSION_DASH}-v${ocp}-${env}.yaml"
    fi
  done
done
```
</step>

<step name="check_existing_rp">
Check for existing ReleasePlan files:

```bash
cd "${WORK_DIR}"

echo "=== Existing RP files ==="
ls -la tenants-config/cluster/kflux-prd-rh02/tenants/tekton-ecosystem-tenant/

echo ""
echo "=== Sample RP structure ==="
cat tenants-config/cluster/kflux-prd-rh02/tenants/tekton-ecosystem-tenant/openshift-pipelines-release-plan-*.yaml 2>/dev/null | head -50
```
</step>

<step name="create_rp_files">
Create ReleasePlan files for the new version.

**Navigate to RP directory:**
```bash
cd "${WORK_DIR}/tenants-config/cluster/kflux-prd-rh02/tenants/tekton-ecosystem-tenant"
```

**Template for ReleasePlan (stage):**
```yaml
apiVersion: appstudio.redhat.com/v1alpha1
kind: ReleasePlan
metadata:
  labels:
    release.appstudio.openshift.io/auto-release: "false"
    release.appstudio.openshift.io/standing-attribution: "false"
  name: openshift-pipelines-{MINOR_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  application: openshift-pipelines-{VERSION_DASH}
  target: rhtap-releng-tenant
```

**Template for ReleasePlan (prod):**
```yaml
apiVersion: appstudio.redhat.com/v1alpha1
kind: ReleasePlan
metadata:
  labels:
    release.appstudio.openshift.io/auto-release: "false"
    release.appstudio.openshift.io/standing-attribution: "false"
  name: openshift-pipelines-{MINOR_VERSION}-prod
  namespace: tekton-ecosystem-tenant
spec:
  application: openshift-pipelines-{VERSION_DASH}
  target: rhtap-releng-tenant
```

**Copy from previous version and update:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"
PREV_VERSION="1.19"
PREV_VERSION_DASH="${PREV_VERSION//./-}"

for env in stage prod; do
  if [ -f "openshift-pipelines-release-plan-${PREV_VERSION}-${env}.yaml" ]; then
    cp "openshift-pipelines-release-plan-${PREV_VERSION}-${env}.yaml" \
       "openshift-pipelines-release-plan-${MINOR_VERSION}-${env}.yaml"
    sed -i "s/${PREV_VERSION}/${MINOR_VERSION}/g" "openshift-pipelines-release-plan-${MINOR_VERSION}-${env}.yaml"
    sed -i "s/${PREV_VERSION_DASH}/${VERSION_DASH}/g" "openshift-pipelines-release-plan-${MINOR_VERSION}-${env}.yaml"
    echo "Created openshift-pipelines-release-plan-${MINOR_VERSION}-${env}.yaml"
  fi
done
```

**Update kustomization.yaml:**
```bash
echo ""
echo "=== Add new RP files to kustomization.yaml ==="
cat kustomization.yaml

echo ""
echo "Add these entries to resources:"
echo "  - openshift-pipelines-release-plan-${MINOR_VERSION}-stage.yaml"
echo "  - openshift-pipelines-release-plan-${MINOR_VERSION}-prod.yaml"
```
</step>

<step name="run_build_manifests">
Run the build-manifests script to generate autogenerated files:

```bash
cd "${WORK_DIR}"

echo "=== Running build-manifests.sh ==="
./build-manifests.sh

echo ""
echo "=== Verify generated files ==="
git status
```
</step>

<step name="create_gitlab_mr">
Create a Merge Request on GitLab:

```bash
cd "${WORK_DIR}"
MINOR_VERSION="1.20"

# Create branch
git checkout -b "add-osp-${MINOR_VERSION}-release-plans"

# Stage changes
git add -A

# Commit
git commit -m "$(cat <<EOF
Add OpenShift Pipelines ${MINOR_VERSION} release plans

- Add RPA files for core, cli, operator, fbc (stage and prod)
- Add RP files for stage and prod
- Generated autogenerated files

Release: ${MINOR_VERSION}
EOF
)"

# Push (requires GitLab authentication)
echo ""
echo "Push to GitLab:"
echo "git push -u origin add-osp-${MINOR_VERSION}-release-plans"

echo ""
echo "Then create MR at:"
echo "https://gitlab.cee.redhat.com/releng/konflux-release-data/-/merge_requests/new"
```

**Important notes:**
- Ensure CI is green on the MR
- If CI fails with prodsec error, contact Przemyslaw Roguski <proguski@redhat.com>
- They need to add the version - contact them 2-3 days before prod release to make it Live
</step>

<step name="wait_for_mr_merge">
After MR is merged, GitOps automatically applies RPA and RP on RH02 Konflux cluster.

```bash
echo "=== After MR Merge ==="
echo ""
echo "GitOps will automatically apply:"
echo "- ReleasePlanAdmission resources"
echo "- ReleasePlan resources"
echo ""
echo "Verify in Konflux RH02 cluster:"
echo "oc project tekton-ecosystem-tenant"
echo "oc get releaseplanadmission"
echo "oc get releaseplan"
```
</step>

<step name="create_release_yamls">
Create release YAML files in the hack repo.

**Clone hack repo:**
```bash
MINOR_VERSION="1.20"
RELEASE_VERSION="1.20.0"
BRANCH="release-v${MINOR_VERSION}.x"

HACK_DIR="/tmp/hack-release-${MINOR_VERSION}"
rm -rf "${HACK_DIR}"
git clone https://github.com/openshift-pipelines/hack -b "${BRANCH}" "${HACK_DIR}"
cd "${HACK_DIR}"
```

**Create release directory structure:**
```bash
cd "${HACK_DIR}"
RELEASE_VERSION="1.20.0"

mkdir -p "config/release/${RELEASE_VERSION}/stage"
mkdir -p "config/release/${RELEASE_VERSION}/prod"

echo "Created:"
echo "- config/release/${RELEASE_VERSION}/stage/"
echo "- config/release/${RELEASE_VERSION}/prod/"
```

**Reference previous release:**
```bash
PREV_RELEASE="1.19.0"

echo "=== Previous release structure ==="
ls -la "config/release/${PREV_RELEASE}/" 2>/dev/null || echo "Check previous release directory"

if [ -d "config/release/${PREV_RELEASE}/stage" ]; then
  ls -la "config/release/${PREV_RELEASE}/stage/"
fi
```
</step>

<step name="create_stage_release_yamls">
Create stage release YAML files.

**Template for Core Release (stage):**
```yaml
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-core-{RELEASE_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-{MINOR_VERSION}-stage
  snapshot: <SNAPSHOT_NAME>  # To be filled with actual snapshot
```

**Create release files:**
```bash
cd "${HACK_DIR}"
RELEASE_VERSION="1.20.0"
MINOR_VERSION="1.20"

# Core release (stage)
cat > "config/release/${RELEASE_VERSION}/stage/openshift-pipelines-core-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-core-${RELEASE_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-${MINOR_VERSION}-stage
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# CLI release (stage)
cat > "config/release/${RELEASE_VERSION}/stage/openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-cli-${RELEASE_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-cli-${MINOR_VERSION}-stage
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# Operator release (stage)
cat > "config/release/${RELEASE_VERSION}/stage/openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-operator-${RELEASE_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-operator-${MINOR_VERSION}-stage
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# Index releases (stage) - one per OCP version
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  cat > "config/release/${RELEASE_VERSION}/stage/openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-stage
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-fbc-${MINOR_VERSION}-v${ocp}-stage
  snapshot: SNAPSHOT_PLACEHOLDER
EOF
done

echo "Created stage release files:"
ls "config/release/${RELEASE_VERSION}/stage/"
```
</step>

<step name="create_prod_release_yamls">
Create prod release YAML files.

```bash
cd "${HACK_DIR}"
RELEASE_VERSION="1.20.0"
MINOR_VERSION="1.20"

# Core release (prod)
cat > "config/release/${RELEASE_VERSION}/prod/openshift-pipelines-core-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-core-${RELEASE_VERSION}-prod
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-${MINOR_VERSION}-prod
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# CLI release (prod)
cat > "config/release/${RELEASE_VERSION}/prod/openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-cli-${RELEASE_VERSION}-prod
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-cli-${MINOR_VERSION}-prod
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# Operator release (prod)
cat > "config/release/${RELEASE_VERSION}/prod/openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-operator-${RELEASE_VERSION}-prod
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-operator-${MINOR_VERSION}-prod
  snapshot: SNAPSHOT_PLACEHOLDER
EOF

# Index releases (prod) - one per OCP version
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  cat > "config/release/${RELEASE_VERSION}/prod/openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-release.yaml" << EOF
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-prod
  namespace: tekton-ecosystem-tenant
spec:
  releasePlan: openshift-pipelines-fbc-${MINOR_VERSION}-v${ocp}-prod
  snapshot: SNAPSHOT_PLACEHOLDER
EOF
done

echo "Created prod release files:"
ls "config/release/${RELEASE_VERSION}/prod/"
```

**Note:** SNAPSHOT_PLACEHOLDER will be replaced with actual snapshot names during stage/prod release execution.
</step>

<step name="push_hack_release">
Push release YAML files to hack repo:

```bash
cd "${HACK_DIR}"
RELEASE_VERSION="1.20.0"
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Create branch
git checkout -b "add-release-yamls-${RELEASE_VERSION}"

# Stage changes
git add -A

# Commit
git commit -m "$(cat <<EOF
chore: add release YAML templates for v${RELEASE_VERSION}

- Add stage release YAMLs (core, cli, operator, index)
- Add prod release YAMLs (core, cli, operator, index)

Note: Snapshot names need to be filled during release execution.

Release: ${RELEASE_VERSION}
Type: RHEA (minor release)
EOF
)"

# Push
git push -u origin "add-release-yamls-${RELEASE_VERSION}"

# Create PR
gh pr create \
  --base "${BRANCH}" \
  --head "add-release-yamls-${RELEASE_VERSION}" \
  --title "chore: add release YAML templates for v${RELEASE_VERSION}" \
  --body "$(cat <<EOF
## Summary

Add release YAML templates for OpenShift Pipelines ${RELEASE_VERSION} release.

## Files Added

### Stage
- \`config/release/${RELEASE_VERSION}/stage/openshift-pipelines-core-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/stage/openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/stage/openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/stage/openshift-pipelines-index-*.yaml\` (per OCP version)

### Prod
- \`config/release/${RELEASE_VERSION}/prod/openshift-pipelines-core-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/prod/openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/prod/openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml\`
- \`config/release/${RELEASE_VERSION}/prod/openshift-pipelines-index-*.yaml\` (per OCP version)

## Notes

- Snapshot placeholders will be filled during release execution
- Release type: RHEA (minor release)

## Next Steps

1. Merge this PR
2. Run \`/osp:stage-release\` when ready for stage
3. Run \`/osp:prod-release\` after stage validation
EOF
)"
```
</step>

<step name="verify_setup">
Verify release configuration is complete:

```bash
echo "=== Release Configuration Summary ==="
echo ""
echo "1. konflux-release-data GitLab repo:"
echo "   - RPA files created for core, cli, operator, fbc"
echo "   - RP files created for stage and prod"
echo "   - MR submitted and merged"
echo ""
echo "2. hack repo:"
echo "   - Release YAML templates created"
echo "   - PR submitted and merged"
echo ""
echo "3. Konflux cluster verification:"
echo "   oc project tekton-ecosystem-tenant"
echo "   oc get releaseplanadmission | grep ${MINOR_VERSION}"
echo "   oc get releaseplan | grep ${MINOR_VERSION}"
echo ""
echo "=== Ready for Release ==="
echo ""
echo "Stage Release: /osp:stage-release"
echo "Prod Release:  /osp:prod-release"
```
</step>

<step name="prodsec_contact">
**Important:** Contact prodsec before prod release.

```
Contact: Przemyslaw Roguski <proguski@redhat.com>

Timeline: 2-3 days before prod release

Purpose: They need to add the version and make it "Live" for production release.

If CI fails with prodsec error on the MR, contact them immediately.
```
</step>

<step name="generate_todos">
Generate todo items for release configuration:

```
TodoWrite with items:

## Release Configuration for ${RELEASE_VERSION}

### konflux-release-data (GitLab)
- [ ] Clone konflux-release-data repo
- [ ] Create RPA files:
  - [ ] Core (stage/prod)
  - [ ] CLI (stage/prod)
  - [ ] Operator (stage/prod)
  - [ ] FBC/Index (stage/prod per OCP version)
- [ ] Create RP files (stage/prod)
- [ ] Update kustomization.yaml
- [ ] Run build-manifests.sh
- [ ] Create and push MR
- [ ] Wait for CI to pass
- [ ] Get MR merged

### hack repo (Release YAMLs)
- [ ] Create release directory structure
- [ ] Create stage release YAMLs
- [ ] Create prod release YAMLs
- [ ] Create and merge PR

### Verification
- [ ] Verify RPA applied to Konflux cluster
- [ ] Verify RP applied to Konflux cluster
- [ ] Contact prodsec (2-3 days before prod)

### Ready for Release
- [ ] Stage release: /osp:stage-release
- [ ] Prod release: /osp:prod-release
```
</step>
</process>

<output>
Complete Konflux release configuration:
1. ReleasePlanAdmission (RPA) files for all applications (stage/prod)
2. ReleasePlan (RP) files for stage and prod
3. Release YAML templates in hack repo
4. All MRs/PRs merged
5. Resources applied to Konflux cluster via GitOps
</output>

<success_criteria>
- [ ] All Konflux application builds green (core, cli, operator, index)
- [ ] RPA files created for all applications (core, cli, operator, fbc)
- [ ] RPA files created for both environments (stage, prod)
- [ ] RP files created for stage and prod
- [ ] kustomization.yaml updated
- [ ] build-manifests.sh run successfully
- [ ] konflux-release-data MR merged
- [ ] Release YAML templates created in hack repo
- [ ] hack repo PR merged
- [ ] RPA/RP resources verified in Konflux cluster
- [ ] prodsec contacted (for prod release timeline)
</success_criteria>

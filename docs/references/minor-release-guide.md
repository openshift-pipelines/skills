# OpenShift Pipelines Minor Release Guide

**Source:** Internal documentation (PDF)
**Last Updated:** 2026-01-19

This document outlines the comprehensive process for executing a minor release of OpenShift Pipelines. It provides step-by-step instructions for release captains and team members involved in the release process.

---

## Overview

### Supported Versions

| Supported OSP versions | Supported OCP versions | Type |
|------------------------|------------------------|------|
| 1.14, 1.15, 1.16, 1.17 | 4.14, 4.16, 4.17, 4.18, 4.19, 4.20 | RHEL8 |
| 1.18, 1.19, 1.20 | 4.14, 4.16, 4.17, 4.18, 4.19, 4.20 | RHEL9 |

Reference: https://access.redhat.com/support/policy/updates/openshift

---

## Components

### Forked Components (Upstream Based)

| Component Name | Component URL |
|----------------|---------------|
| Pipeline | https://github.com/openshift-pipelines/tektoncd-pipeline |
| Triggers | https://github.com/openshift-pipelines/tektoncd-triggers |
| Chains | https://github.com/openshift-pipelines/tektoncd-chains |
| Results | https://github.com/openshift-pipelines/tektoncd-results |
| Hub | https://github.com/openshift-pipelines/tektoncd-hub |
| PAC | https://github.com/openshift-pipelines/pac-downstream |
| git-init | https://github.com/openshift-pipelines/tektoncd-git-clone |
| CLI | https://github.com/openshift-pipelines/tektoncd-cli |
| Operator | https://github.com/openshift-pipelines/operator |
| Pruner | https://github.com/tektoncd/pruner |

### Pure Downstream Components (No Forked Repos)

| Component Name | Component URL |
|----------------|---------------|
| OPC (no fork) | https://github.com/openshift-pipelines/opc |
| manual-approval-gate (no fork) | https://github.com/openshift-pipelines/manual-approval-gate |
| console-plugin (no fork) | https://github.com/openshift-pipelines/console-plugin |
| Cache (no fork) | https://github.com/openshift-pipelines/tekton-caches |

---

## Pre-Release Phase

### Timeline Planning

#### 1. Release Schedule Definition
- Set Feature Freeze date
- Set Code Freeze date
- Set Documentation Freeze date
- Set Build Freeze date

#### 2. Documentation Setup
- Create release metrics document
- Obtain SME sign-off on upstream component release dates
- Update Dashboard with release date, errata information and components versions
  - Use https://gitlab.cee.redhat.com/tekton/p12n repo and `dashboard` branch
  - Reference example: https://gitlab.cee.redhat.com/tekton/p12n/-/commit/2e748e9e40ad36960c7f5c54854f30a6639ecadc
  - Verify locally before pushing MR:
    ```bash
    # Download Hugo matching the Dockerfile version
    # https://gitlab.cee.redhat.com/tekton/p12n/-/blob/dashboard/Dockerfile#L2
    hugo server --environment production --bind 0.0.0.0 --noBuildLock --cacheDir /tmp/
    ```

#### 3. Branch Creation
Create a branch named `release-v<minor release number>.x` on all forked components and the hack repository.

```bash
# For each forked component
git checkout <previous-released-branch>
git checkout -b release-v<minor>.x

# For hack repository
git checkout next
git checkout -b release-v<minor>.x
```

**Note:** Don't create branches on `manual-approval-gate`, `opc` and `console-plugin` as they are not forked.

### COMET Creation (To add new image)

Release captain ensure with the team to know if there is any New image is getting added during Minor release. If yes:

1. Get the details of the new image
2. Create a COMET via one of two methods:

**Method 1: CPAAS**
- Create a sample MR like https://gitlab.cee.redhat.com/cpaas-products/openshift-pipelines/-/merge_requests/337 to add new image entry
- Once merged, trigger HoneyBadger Job
- Wait for completion, then observe new MR at https://gitlab.cee.redhat.com/pipeline/products/-/merge_requests/3088/
- Reach out to #rel-eng channel (example: https://redhat-internal.slack.com/archives/C03CFJBGRTK/p1748345768781249) to merge the MR

**Method 2: PYXIS**

3. Once MR merged, verify COMET creation at https://comet.engineering.redhat.com/

---

## CPAAS Configuration Phase

- Follow CPAAS Configuration Guide
- Follow HoneyBadger Configuration Guide
- Follow Configuration guide to create Advisory

### CLI (to build RPM) Configurations

Reference: http://dashboard.apps.cicd.ospqa.com/p12n/runbooks/minor-release-runbook-template-clirpm-cpaas-configuration/#update-downstream-repository-configuration

---

## Hack Configuration

The hack repository is used to automate the generation of Konflux resources, GitHub workflows and .tekton configurations for components and the Operator.

### Steps:

1. Go to the hack repository: https://github.com/openshift-pipelines/hack/

2. Clone the repository with the new release branch:
   ```bash
   git clone https://github.com/openshift-pipelines/hack -b release-v<minor release number>.x
   ```

3. Change into the hack directory:
   ```bash
   cd hack
   ```

4. Navigate to the config/konflux directory:
   ```bash
   cd config/konflux
   ```

5. Open all files in this directory and change `next` to the respective release version (e.g., 1.20).
   - [Reference Example](link)
   - [Previous Released Version Example](link)

6. If a new OCP version becomes GA (e.g., 4.20), add a new file `openshift-pipelines-index-4.20.yaml` under `config/konflux`.

7. Go to `config/konflux/repos` and update the branches from `next` to the releasing version.

### Case 1: Repository with Upstream and Downstream

| Field | Description |
|-------|-------------|
| name | Name of the downstream repository |
| upstream | Name of the upstream repository |
| components | List of container images part of the upstream or downstream repository |
| branches | Contains information about upstream and downstream branches |

**Example Structure:**
```yaml
branches:
  - name: release-v1.20.x
    upstream: release-v2.0.x
    versions:
      - "1.20"
```

### Case 2: Repository with Only Downstream (e.g., MAG, Console Plugin)

| Field | Description |
|-------|-------------|
| name | Name of the downstream repository |
| upstream | No upstream repository |
| components | List of container images part of the upstream or downstream repository |
| tekton | Add `watched_resource` to indicate when CI should start |
| branches | Contains information about upstream and downstream branches |

**Example Structure:**
```yaml
branches:
  - name: release-v0.7.0  # this is for MAG
    versions:
      - "1.20"
```

8. Ensure correct supported OCP versions are present (add/remove from workflow as needed)
   - Example PR: https://github.com/openshift-pipelines/hack/commit/b0d3b088c707eacdafe6faddcb48e92984c00e3f

9. Send a Pull Request (PR) with all the changes.

10. After the merge, a GitHub Actions workflow will generate:
    - `.konflux` configurations on the hack repository
    - `.tekton` and `.github` workflows configurations on all components
    - Example PR: https://github.com/openshift-pipelines/hack/pull/230/ for release-v1.19.x

11. Login to Konflux RH02 Cluster with SSO and switch to tekton-ecosystem-tenant:
    ```bash
    oc project tekton-ecosystem-tenant
    ```

12. Navigate to `hack/.konflux/<version>` and apply resources:
    ```bash
    cd .konflux/<version>  # .konflux/1.20
    oc create -f <files>
    ```

**NOTE:** Before apply/create, contact Release Captain.

---

## Component Configuration

**Note:** Pull requests to this repository will trigger CI builds only for the x86 architecture. Full builds for all supported architectures will only run when changes are pushed directly to the branch.

### Steps:

1. **Initial Pull Request Review and Merges**
   - Review and merge all outstanding PRs generated by Hack across all repositories
   - Example for tektoncd-chains:
     - Merge https://github.com/openshift-pipelines/tektoncd-chains/pull/225
     - Merge https://github.com/openshift-pipelines/tektoncd-chains/pull/224

2. **Clone the Release Branch**
   ```bash
   git clone https://github.com/openshift-pipelines/tektoncd-chains -b release-v1.20.x
   ```

3. **Verify .tekton Directory Changes**
   - Thoroughly examine the `.tekton` directory for discrepancies
   - Pay close attention to branch names and Dockerfile paths

4. **Update Dockerfile**
   - **Base Image Update:** Use the latest released SHA from https://catalog.redhat.com/
   - **Version Update:** Update the version as specified in the Dockerfile
   - **Release-Specific Adjustments:** Check for any other required modifications

5. **Update RPMs (If Required)**
   - If CI failures occur due to outdated RPMs, an update is necessary
   - Example error:
     ```
     error: Could not depsolve transaction; 1 problem detected:
     Problem: package perl-Pod-Usage-4:2.01-4.el9.noarch requires perl(Pod::Text) >= 4
     ```
   - Refer to documentation OR contact the previous release captain

6. **Add Patches (If Required)**
   - Apply if any patches are required

7. **Submit and Merge Your Pull Request**

8. **Run Update Sources Action**
   - Navigate to Actions and execute `update-sources-release-v1.20.x` action, targeting the main branch
   - **THIS IS REQUIRED ONLY FOR FORKED COMPONENTS which have Upstream Repos**
   - Wait for CI to succeed, then merge the generated PR
   - Monitor CI success for the newly merged PR
   - A successful run signifies the first generated image for that component

**Important Notes:**
- Run pac-downstream changes first and wait for CI green, then do configuration for tektoncd-cli (has dependency on pac-cli)
- The above steps must be done for all components EXCEPT OPERATOR

---

## Operator Configuration

**Note:** Pull requests to this repository will trigger CI builds only for the x86 architecture. Full builds for all supported architectures will only run when changes are pushed directly to the branch.

### 1. Pre-requisites
- Navigate to the Operator's Git repository
- Ensure the release branch exists (e.g., `release-v<minor release number>.x`)

### 2. Review and Update Core Configuration

- **.tekton files:** Verify correctness, checking branch names and Dockerfile paths for all Components, Bundle and Index
- **Dockerfiles:**
  - Update base images and versions in `.konflux/dockerfiles` directory
  - Check & Update Dockerfile for Bundle and Index in `.konflux/olm-catalog` directory
- **RPMs:** Make any required updates
- **Patches:** Add any necessary patches

### 3. Manage Component Updates (Nudges and SHA Verification)

- **Nudge Pull Requests:** Check for and merge any nudge PRs that update the SHA for all components
- **Important Note:** It's common for nudge PRs not to be generated for some components
- **project.yaml SHA Update:** Manually edit the `project.yaml` file to ensure correct SHA for all components

### 4. Configure Version Information in project.yaml

| Field | Description |
|-------|-------------|
| current | The version planned for release |
| previous | The previously released version (could be minor or patch) |
| previous_range | The previous minor release version (e.g., if doing 1.21.0, previous_range is 1.20.0) |
| channel | The name of the release channel |
| openshift.latest | The latest supported OCP version |
| openshift.min | The minimum supported OCP version |

### 5. Adjust Operator Hack Scripts

- **index-render-template.sh:** Modify `hack/index-render-template.sh` to reflect RHEL version:
  - For 1.14.x, 1.15.x, 1.16.x, 1.17.x: use RHEL8
  - From 1.18.x onwards: use RHEL9

- **operator-fetch-payload.sh:**
  - Check & Update `BUNDLE_ARGS`
  - Check & Modify the sed command to change the channel

### 6. Create and Merge Pull Request

### 7. Trigger and Monitor CI/CD Action
- Go to Actions and run `update-sources-release-v<minor release number>.x` workflow targeting the main branch
- Wait for CI to succeed on the generated PR before merging

### 8. Verify OLM Catalog Changes (from generated PR)

**Bundle (olm-catalog/bundle):**
- Dockerfile:
  - Confirm channel name is updated
  - For minor releases, ensure `latest` is added to both channels:
    ```
    LABEL operators.operatorframework.io.bundle.channel.default.v1="latest"
    LABEL operators.operatorframework.io.bundle.channels.v1="latest,pipelines-1.20"
    ```
  - Verify and update the version
- annotations.yaml: Ensure it's updated

**Index (olm-catalog/index):**
- Each index folder contains a Dockerfile and `catalog-template.json` file
- Update channel information in Dockerfile
- Verify `catalog-template.json` by comparing with base image:
  ```bash
  opm render registry.redhat.io/redhat/redhat-operator-index:v4.15 > target-index-v4.15.json
  ```
- Compare and update `catalog-template.json` with latest information

---

## Get Devel Build

Once all components and Operator configurations are done:

1. **Run operator-update-images workflow:**
   - Go to Operator and run `operator-update-images` GH action
   - Target the release branch, select Environment as `devel`
   - Merge the PR that opens to update the CSV
   - Wait for the Bundle image to be built
   - Update the new Bundle SHA in `project.yaml` (manually or via Nudges)

2. **Run index-render-template workflow:**
   - Go to Operator and run `index-render-template` GH action
   - Target the release branch, select Environment as `devel`
   - Merge the PR to update the json files
   - Wait for CI success

3. **Copy images:**
   - Once CI is green, do skopeo copy from `quay.io/redhat-user-workload` to `quay.io/openshift-pipeline`

---

## Release Configuration (Konflux CRD)

For releasing a product, create:
- ReleasePlanAdmission
- ReleasePlan
- Release Resources

Reference: [Konflux documentation](https://konflux-ci.dev/docs/)

Resources are created under RH02 cluster.

### RPA (Release Plan Admission)

- Reference samples: https://gitlab.cee.redhat.com/releng/konflux-release-data/-/tree/main/config/kflux-prd-rh02.0fk9.p1/product/ReleasePlanAdmission/tekton-ecosystem
- Create files for core, cli, operator and fbc applications for both prod and stage

### RP (Release Plan)

- Reference samples: https://gitlab.cee.redhat.com/releng/konflux-release-data/-/tree/main/tenants-config/cluster/kflux-prd-rh02/tenants/tekton-ecosystem-tenant
- Create `openshift-pipelines-release-plan-<version>-stage.yaml` and `openshift-pipelines-release-plan-<version>-prod.yaml`
- Add created RP files in `kustomization.yaml` file
- Run `build-manifests.sh` script to create autogenerated files
- Send MR to https://gitlab.cee.redhat.com/releng/konflux-release-data
- Ensure CI is green
- If CI fails due to prodsec error, contact Przemyslaw Roguski <proguski@redhat.com>
  - **NOTE:** They add the version, but release captain must contact them 2-3 days before prod release to make it Live
- After MR merge, GitOps workflow automatically applies RPA and RP on RH02 Konflux cluster

### Release YAML Creation

Create release yamls in hack repo for the particular branch:
- Sample: https://github.com/openshift-pipelines/hack/tree/release-v1.19.x/config/release/1.19.0

**NOTE:** For Minor releases, type will be **RHEA**.

---

## Stage Release Process

Go to stage folder: `cd config/release/1.19.0/stage`

### CORE
1. Get the snapshot for latest core built image
2. Update in `openshift-pipelines-core-<version>-release.yaml` file
3. Apply `openshift-pipelines-core-<version>-release.yaml`
4. Wait for core release pipeline success

### CLI
1. Update the `pipelines-pipelines-as-code-cli-rhel9` stage URL in tektoncd-cli dockerfile
2. Get a new build for CLI
3. Ensure Nudges sends PR to Operator project.yaml with new CLI SHA (or manually update)
4. Get the snapshot and update in `openshift-pipelines-cli-<version>-release.yaml`
5. Apply and wait for CLI release pipeline success
6. Once CLI release is successful, start Operator stage release

### OPERATOR
1. Run `operator-update-images` GH action targeting the release branch with Environment as `staging`
2. Merge the PR to update the CSV
3. Wait for the Bundle image to be built
4. Update the new Bundle SHA in `project.yaml`
5. Get the Snapshot and update in `openshift-pipelines-operator-<version>-release.yaml`
6. Apply and wait for operator release success

### INDEX
1. Run `index-render-template` GH action targeting the release branch with Environment as `staging`
2. Merge the PR to update the json files
3. Wait for CI success
4. Get the snapshot for each OCP version and update in respective files
5. Apply the yamls and wait for release success

### Stage Release Announce

Once all component releases (Core, CLI, Operator, Index) are successful, share the build status and details with the team.

---

## Prod Release Process

Go to prod folder: `cd config/release/1.19.0/prod`

### CORE
1. Get the snapshot for latest core built image
2. Update in `openshift-pipelines-core-<version>-release.yaml` file
3. Apply and wait for core release pipeline success

### CLI
1. Update the `pipelines-pipelines-as-code-cli-rhel9` prod URL in tektoncd-cli dockerfile
2. Get a new build for CLI
3. Ensure Nudges sends PR to Operator project.yaml with new CLI SHA
4. Get the snapshot and update in `openshift-pipelines-cli-<version>-release.yaml`
5. Apply and wait for CLI release pipeline success
6. Once CLI release is successful, start Operator prod release

### OPERATOR
1. Run `operator-update-images` GH action targeting the release branch with Environment as `production`
2. Merge the PR to update the CSV
3. Wait for the Bundle image to be built
4. Update the new Bundle SHA in `project.yaml`
5. Get the Snapshot and update in `openshift-pipelines-operator-<version>-release.yaml`
6. Apply and wait for operator release success

### INDEX
1. Run `index-render-template` GH action targeting the release branch with Environment as `production`
2. Merge the PR to update the json files
3. Wait for CI success
4. Get the snapshot for each OCP version and update in respective files
5. Apply the yamls and wait for release success

### Prod Release Announce

Once all component releases (Core, CLI, Operator, Index) are successful, share the build status and details with the team.

Sample format: https://redhat-internal.slack.com/archives/CG5GV6CJD/p1752646759861289

---

## Component Checklist Template

For tracking component configuration progress:

### Per Component:
- [ ] Branch exists
- [ ] HEAD (updated by update sources)
- [ ] Dockerfile Update
- [ ] Update-sources workflow run
- [ ] CI Green on PR
- [ ] Merge PR
- [ ] Create PR and Push to trigger builds for all 4 archs

### Special Notes:
- **CLI:** Has dependency on PAC - run pac-downstream first
- **git-init:** Check if release branch exists in hack config
- **Console Plugin:** May need FIPS changes, Hermetic Yarn configuration
- **OPC:** May need patch updates
- **Operator:** Requires additional steps (project.yaml SHAs, operator-update-images, index-render-template)

---

*Document converted from PDF source for use with Claude Code skills*

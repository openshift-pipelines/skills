---
name: pipeline
description: Create or modify Tekton Pipeline resources
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - Task
---

# Create Tekton Pipeline

<objective>
Help the user create or modify Tekton Pipeline resources following OpenShift Pipelines best practices.
The output will be a valid Tekton Pipeline YAML file ready for deployment.
</objective>

<execution_context>
Reference the Tekton Pipeline API specification:
- apiVersion: tekton.dev/v1 (preferred) or tekton.dev/v1beta1
- Pipeline resources define a series of Tasks to execute
- Tasks can run sequentially or in parallel using `runAfter`
- Parameters and workspaces enable reusability
</execution_context>

<process>
<step name="gather_context">
First, understand the user's requirements:

1. Search for existing Tekton resources in the project:
   - Look for `*.yaml` or `*.yml` files containing `kind: Pipeline` or `kind: Task`
   - Check for existing Tasks that could be reused

2. Use AskUserQuestion to clarify:
   - What is the pipeline's purpose? (build, test, deploy, CI/CD, etc.)
   - What source type? (Git repository, container image, etc.)
   - What's the target environment? (OpenShift, Kubernetes, specific namespace)
   - Should it use existing Tasks from Tekton Hub or custom Tasks?
</step>

<step name="design_pipeline">
Based on the gathered context, design the pipeline structure:

1. Identify required Tasks:
   - git-clone (fetch source code)
   - build tasks (buildah, kaniko, s2i)
   - test tasks (custom or from Hub)
   - deploy tasks (kubectl, oc, argocd)

2. Define parameters for customization:
   - Repository URL
   - Image name/tag
   - Namespace targets
   - Build arguments

3. Define workspaces:
   - source (shared-workspace for code)
   - dockerconfig (for registry auth)
   - kubeconfig (for deployment)

4. Establish task ordering with `runAfter`
</step>

<step name="generate_pipeline">
Create the Pipeline YAML following this structure:

```yaml
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: <pipeline-name>
  labels:
    app.kubernetes.io/version: "0.1"
  annotations:
    tekton.dev/pipelines.minVersion: "0.50.0"
    tekton.dev/categories: <category>
    tekton.dev/tags: <tags>
    tekton.dev/displayName: "<display-name>"
spec:
  description: |
    <description>
  params:
    - name: repo-url
      type: string
      description: The git repository URL
    - name: image-reference
      type: string
      description: The image to build and push
  workspaces:
    - name: shared-workspace
      description: Workspace containing the source code
  tasks:
    - name: fetch-source
      taskRef:
        name: git-clone
        kind: ClusterTask  # or Task for namespace-scoped
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: url
          value: $(params.repo-url)
```

Ensure:
- All parameter references use `$(params.name)` syntax
- Workspace bindings are consistent
- Task dependencies are explicit via `runAfter`
</step>

<step name="validate_and_save">
1. Validate the generated YAML:
   - Check for syntax errors
   - Verify all referenced Tasks exist or are from ClusterTasks
   - Ensure workspace and parameter names are consistent

2. Save to the appropriate location:
   - Suggest `.tekton/` or `pipelines/` directory
   - Use descriptive filename: `<name>-pipeline.yaml`

3. Provide deployment instructions:
   ```bash
   # Apply the pipeline
   kubectl apply -f <filename>

   # Or using tkn CLI
   tkn pipeline start <pipeline-name> --showlog
   ```
</step>
</process>

<output>
A complete, valid Tekton Pipeline YAML file with:
- Proper API version and metadata
- Parameterized inputs for flexibility
- Workspace definitions for data sharing
- Ordered tasks with clear dependencies
- Deployment instructions
</output>

<success_criteria>
- [ ] Pipeline YAML is syntactically valid
- [ ] All task references are resolvable
- [ ] Parameters and workspaces are properly defined
- [ ] Task ordering is logical and explicit
- [ ] File is saved to appropriate location
- [ ] User understands how to deploy and run the pipeline
</success_criteria>

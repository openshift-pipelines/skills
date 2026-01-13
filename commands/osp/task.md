---
name: task
description: Create or modify Tekton Task resources
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - WebFetch
---

# Create Tekton Task

<objective>
Help the user create or modify Tekton Task resources following OpenShift Pipelines best practices.
Tasks are the building blocks of Tekton Pipelines, defining individual units of work.
</objective>

<execution_context>
Reference the Tekton Task API specification:
- apiVersion: tekton.dev/v1 (preferred) or tekton.dev/v1beta1
- Tasks contain Steps that run sequentially in a pod
- Each Step is a container with a specific image and command
- Tasks can define parameters, workspaces, and results
</execution_context>

<process>
<step name="gather_requirements">
Understand what the task needs to accomplish:

1. Use AskUserQuestion to clarify:
   - What action should the task perform? (build, test, deploy, scan, notify)
   - What tools/CLI are needed? (docker, kubectl, npm, maven, etc.)
   - What inputs does it need? (source code, config files, credentials)
   - What outputs should it produce? (images, artifacts, results)

2. Check for existing tasks in the project that might be similar
3. Search Tekton Hub for reusable tasks that could be adapted
</step>

<step name="design_task">
Design the task structure:

1. **Parameters** - Define inputs:
   - String parameters for configuration
   - Array parameters for multiple values
   - Object parameters for structured data

2. **Workspaces** - Define shared storage:
   - source workspace for code
   - output workspace for artifacts
   - credentials workspaces (optional: true when not always needed)

3. **Results** - Define outputs:
   - Digest values
   - URLs
   - Status information

4. **Steps** - Define the execution:
   - Choose appropriate base images
   - Define commands and arguments
   - Set resource requests/limits
   - Configure security context
</step>

<step name="generate_task">
Create the Task YAML following this structure:

```yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: <task-name>
  labels:
    app.kubernetes.io/version: "0.1"
  annotations:
    tekton.dev/pipelines.minVersion: "0.50.0"
    tekton.dev/categories: <category>
    tekton.dev/tags: <comma-separated-tags>
    tekton.dev/displayName: "<Display Name>"
spec:
  description: |
    <detailed description>
  params:
    - name: param-name
      type: string
      description: Description of the parameter
      default: "default-value"
  workspaces:
    - name: source
      description: Workspace containing the source code
  results:
    - name: result-name
      description: Description of the result
  steps:
    - name: step-name
      image: <image>:<tag>
      workingDir: $(workspaces.source.path)
      env:
        - name: ENV_VAR
          value: $(params.param-name)
      script: |
        #!/usr/bin/env bash
        set -euo pipefail
        # Task logic here
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
```

Best practices:
- Use `script` instead of `command` + `args` for readability
- Always set `set -euo pipefail` in bash scripts
- Use non-root security contexts when possible
- Reference parameters with `$(params.name)`
- Reference workspaces with `$(workspaces.name.path)`
- Write results using `echo -n "value" > $(results.name.path)`
</step>

<step name="validate_and_save">
1. Validate the task:
   - Ensure YAML syntax is correct
   - Verify image references are valid
   - Check parameter/workspace references

2. Save the task:
   - Suggest `.tekton/tasks/` directory
   - Use naming convention: `<name>-task.yaml`

3. Provide usage examples:
   ```bash
   # Apply the task
   kubectl apply -f <filename>

   # Run standalone with tkn
   tkn task start <task-name> --showlog

   # Reference in a Pipeline
   taskRef:
     name: <task-name>
   ```
</step>
</process>

<output>
A complete, valid Tekton Task YAML file with:
- Proper API version and metadata
- Well-documented parameters with defaults
- Appropriate workspace definitions
- Results for downstream tasks
- Secure, efficient step definitions
</output>

<success_criteria>
- [ ] Task YAML is syntactically valid
- [ ] All images are specified with tags (not :latest)
- [ ] Parameters have descriptions and sensible defaults
- [ ] Steps follow security best practices
- [ ] Script blocks have proper error handling
- [ ] File is saved and user knows how to use it
</success_criteria>

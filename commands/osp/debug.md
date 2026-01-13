---
name: debug
description: Debug failed PipelineRuns or TaskRuns
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - Task
---

# Debug Pipeline/Task Runs

<objective>
Help the user diagnose and fix issues with failed Tekton PipelineRuns or TaskRuns.
Systematically analyze logs, events, and resource states to identify root causes.
</objective>

<process>
<step name="identify_failure">
First, identify what failed:

1. Ask the user or check for the failure context:
   - PipelineRun name or TaskRun name
   - Namespace where it's running
   - Whether they have `tkn` or `oc`/`kubectl` available

2. Get the current status:
   ```bash
   # List recent PipelineRuns
   tkn pipelinerun list -n <namespace>
   # Or with kubectl
   kubectl get pipelineruns -n <namespace> --sort-by=.metadata.creationTimestamp

   # List recent TaskRuns
   tkn taskrun list -n <namespace>
   ```

3. Get detailed status of the failed run:
   ```bash
   tkn pipelinerun describe <name> -n <namespace>
   # Or
   kubectl get pipelinerun <name> -n <namespace> -o yaml
   ```
</step>

<step name="analyze_failure">
Analyze the failure systematically:

1. **Check the status conditions**:
   ```bash
   kubectl get pipelinerun <name> -o jsonpath='{.status.conditions[*].message}'
   ```

2. **Identify which task failed**:
   ```bash
   tkn pipelinerun describe <name> | grep -A5 "Failed"
   ```

3. **Get logs from the failed step**:
   ```bash
   tkn pipelinerun logs <name> -n <namespace>
   # Or for a specific task
   tkn taskrun logs <taskrun-name> -n <namespace>
   ```

4. **Check pod events**:
   ```bash
   kubectl get events -n <namespace> --sort-by='.lastTimestamp' | grep -i <run-name>
   ```

5. **Check pod status**:
   ```bash
   kubectl get pods -n <namespace> -l tekton.dev/pipelineRun=<name>
   kubectl describe pod <pod-name> -n <namespace>
   ```
</step>

<step name="common_issues">
Check for common failure patterns:

**Image Pull Errors**:
- ImagePullBackOff - Check image name, registry auth
- Solution: Verify image exists, check imagePullSecrets

**Resource Issues**:
- OOMKilled - Container exceeded memory limits
- Solution: Increase `resources.limits.memory`

**Permission Errors**:
- RBAC failures - ServiceAccount lacks permissions
- Solution: Check and update RoleBindings/ClusterRoleBindings

**Workspace Issues**:
- Volume mount failures
- PVC not bound
- Solution: Check PVC status, storage class availability

**Timeout Issues**:
- TaskRun or PipelineRun timeout exceeded
- Solution: Increase `spec.timeout` or optimize task

**Script Errors**:
- Non-zero exit codes from scripts
- Solution: Check script logic, add error handling

**Parameter Issues**:
- Missing required parameters
- Invalid parameter values
- Solution: Verify all required params are provided
</step>

<step name="provide_solution">
Based on the analysis:

1. Clearly explain what went wrong
2. Provide the specific fix needed
3. If it's a code/config change:
   - Show the exact changes required
   - Offer to make the edits

4. If it's a runtime issue:
   - Provide the commands to fix it
   - Explain how to prevent it in the future

5. Suggest how to re-run:
   ```bash
   # Re-run a pipeline
   tkn pipeline start <pipeline-name> --use-pipelinerun <failed-run>

   # Or create a new run
   tkn pipeline start <pipeline-name> --showlog
   ```
</step>
</process>

<output>
A diagnosis report including:
- Root cause identification
- Specific fix or workaround
- Commands or code changes to apply
- Prevention strategies for the future
</output>

<success_criteria>
- [ ] Failed run is identified
- [ ] Root cause is determined
- [ ] Solution is provided
- [ ] User can successfully re-run the pipeline/task
</success_criteria>

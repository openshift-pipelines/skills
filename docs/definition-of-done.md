# Definition of Done (DoD) — OpenShift Pipelines

This document defines the criteria an issue must meet before it can be considered "Done" at each level. It is referenced by `/osp:sprint-status` to track DoD compliance across sprint issues.

> **This is a living document.** Update it as team processes evolve.

---

## Story Level DoD

A story cannot be moved to "Done" until every item below is checked.

### Development & Code Quality (Tech Lead / Developer)

- **Code Complete**: All code written for the story.
- **Peer Review Passed**: Code reviewed by another team member and merged into the target branch (e.g., `main`/`develop`) and (if created) the target release branch (e.g., `release-v1.2.x`).
- **Automated Tests Coverage**: Unit tests, E2E tests, release tests, integration tests written for new/modified code, and all tests pass (meets minimum coverage goal). No dip in test coverage for existing modules.
- **No Linting Issues**: Code meets static analysis (linting, code quality tools) requirements.
- **Build Green**: The CI/CD pipeline runs successfully with the new code.
- **Release Notes**: Release notes text field is updated with appropriate release notes in the Jira ticket.

### Testing & Quality Assurance (QA / Developer)

- **Acceptance Criteria Met**: All acceptance criteria listed in the story description have been manually or automatically verified.
- **Acceptance Test**: Core functionality testing is complete and successful on the dev/staging environment.
- **Regression Checked**: Basic regression testing performed to ensure existing functionality is preserved.
- **Defect-Free**: No new high-priority defects have been created or discovered; followup epics have been created for any low-priority defects.

### Documentation & Readiness (Developer / Tech Writer)

- **Technical Docs Updated**: Necessary inline code comments, API documentation, or component design notes are updated upstream and downstream.
- **User Docs Drafted (if applicable)**: The need for user documentation has been identified, and relevant drafts/placeholders are created.
- **Deployment Notes**: Any non-standard deployment steps or configuration changes are documented in the release notes or deployment guide.
- **Release Notes**: Release notes are updated in the respective Jira if applicable.

### Acceptance & Sign-Off (Stakeholder)

- **Story Accepted**: Formal acceptance has been granted by the Component Owner.

---

## Feature Level DoD

A Feature is considered "Done" only when all of the following criteria have been met.

### Code & Development (PM/PO)

- **All User Stories Complete**: All underlying epic/user stories that make up this Feature are individually "Done" (i.e., met their own DoD).
- **Acceptance Criteria Met**: The Feature fully meets all defined high-level acceptance criteria.
- **Cross-component integration**: Operator integration is done/if required.
- **Code Complete**: The code for the Feature has been written.
- **Peer Review Passed**: The code has been formally peer-reviewed, meets all coding standards, and is merged into the main branch and (if applicable) the targeted release branches.

### UI Development

- **Code completion**: All UI related coding is complete and peer-reviewed.
- **Epics are marked as complete**: All Epic/user stories are marked as complete in Jira.
- **Acceptance criteria**: The pre-defined acceptance criteria is met.
- **Testing**: Unit and developer testing is done.
- **Screen recording**: All PRs should have screen recording/screenshots of features and defects.
- **PRs reviewed**: All the PRs are reviewed and the code is merged in the target branch.
- **CI jobs**: All CI jobs passed successfully.
- **Build availability**: Build is available for testing by QE team.

### Quality Assurance & Testing (PM/PO)

- **Unit Tests Passed**: All relevant unit tests have been written and passed.
- **E2E Tests Passed**: End-to-End (E2E) tests covering the Feature's primary workflows have been executed and passed.
- **Acceptance Tests Passed**: The Feature has passed integration testing with other relevant modules or services.
- **No Blocker defects**: The Feature contains no open critical defects that impede the release; for any other new defects, a new epic should be created.
- **Performance Tested (Optional)**.
- **Security Vetted**: Development team is responsible for taking care.

### Deployment & Documentation (PM/PO)

- **Successfully Built**: The code has been successfully built and deployed to an OpenShift Cluster for verification.
- **User Documentation Ready**: User-facing documentation (e.g., help articles, release notes, guides) for the new Feature has been created and reviewed.
- **Internal Knowledge Transfer**: Any necessary technical documentation, architecture updates, or runbooks have been completed for the Support/Operations team.

### Acceptance & Sign-Off (PM/PO)

- **Stakeholder Review**: The Product Manager/Owner or designated business stakeholder has formally reviewed the Feature.
- **Final Acceptance**: Formal sign-off has been received from the Product Manager, certifying the Feature is ready for release to production.

---

## Epic Level DoD

An Epic is considered "Done" only when all of the following criteria have been met.

### Feature Completion & Scope (Tech Lead/SME)

- **All Features Complete**: All required features and stories tagged under this Epic are individually "Done" (i.e., they have met their Feature-level DoD).
- **Original Goal Met**: The Epic's original high-level objective, stated in the Epic brief or charter (the "Why"), has been fully achieved.
- **Acceptance Met**: All high-level business and technical acceptance criteria defined for the Epic have been validated.
- **NFRs Met**: All Non-Functional Requirements (NFRs) associated with the Epic (e.g., performance, load capacity, security, and accessibility standards) have been verified and passed.

### Integration & Quality Assurance (Tech Lead/SME)

- **End-to-End (E2E) Testing**: Comprehensive cross-Feature, end-to-end testing of the entire Epic workflow has been successfully completed in a production environment.

### Business & Stakeholder Readiness (Tech Lead/SME)

- **Full Documentation Complete**: All user guides, training materials, support runbooks, handover documentation, and marketing content related to the Epic are finalized, approved, and published/ready for publication.
- **Deployment Complete**: The Epic's functionality has been fully deployed and tested in an OpenShift environment (or is ready for a final release window).

### Value Confirmation & Sign-Off (Tech Lead/SME)

- **Stakeholder Review**: The stakeholder (PM/PO/Component Owner) has formally reviewed the Epic.
- **Visibility**: Developing a product feature blog post.

---

## DoD Compliance Signals in Jira

The following labels indicate DoD progress and are used by `/osp:sprint-status` to track compliance:

| Label | Meaning | DoD Status |
|---|---|---|
| `doc-req` | Documentation is required | Docs needed |
| `docs-pending` | Documentation info still needs to be provided | Docs incomplete |
| `missing-docs` | Reached "On QA" without required docs | Docs violation |
| `release-notes-req` | Release notes are required | Release notes needed |
| `release-notes-pending` | Release notes not yet written | Release notes incomplete |
| `test-req` | Tests are required | Tests needed |
| `tests-pending` | Tests not yet written | Tests incomplete |
| `groomable` | Issue needs grooming/triaging | Not ready for dev |

**Jira Automation Enforcement**: If an issue is closed with `docs-pending`, `release-notes-pending`, or `tests-pending` labels, Jira automation reopens it. This prevents premature closure.

### DoD Compliance Scoring

For each issue, the skill computes a DoD compliance score:

- **Complete**: No pending labels, status is Closed/Verified
- **At Risk**: Has `*-pending` labels but is approaching Done statuses (Code Review, Dev Complete, On QA)
- **Incomplete**: Has `*-pending` or `*-req` labels and is not yet Done
- **N/A**: Issue has no DoD-related labels (e.g., Spikes, Tasks)

---

## Bug SLI/SLO Targets

| Severity | Time to Acknowledge (TTA) | Time to Resolve (TTR) |
|---|---|---|
| Blocker (Sev 1) | 99% within 1 hour | 95% within 2 days |
| Critical (Sev 2) | 98% within 2 hours | 90% within 4 days |
| Major (Sev 3) | 95% within 8 business hours | 85% within 10 business days |
| Minor (Sev 4) | 90% within 3 business days | 75% within 3 months |

### Supporting SLIs

| SLI | SLO |
|---|---|
| Bug Reopening Rate | <= 5% for Blocker/Critical; <= 10% for Major/Minor |
| Untriaged Bug Count | Maintain below 10 at any time |
| Escaped Defects | < X% of total bugs found in production |

---

## Capacity Allocation (Minor Release)

| Category | Allocation |
|---|---|
| Minor release features | 40% |
| Bugs | 20% |
| Patch releases | 20% |
| Tech debt | 10% |
| Learning & experimentation | 10% |

---

## Key Labels Reference

| Label | Purpose |
|---|---|
| `doc-req` | Documentation planning label |
| `docs-pending` | Developer must provide docs info |
| `missing-docs` | Reached QA without docs |
| `release-notes-req` | Release notes required |
| `release-notes-pending` | Release notes not written |
| `test-req` | Tests required |
| `tests-pending` | Tests not written |
| `groomable` | Needs grooming before dev |
| `customer` | Customer-reported issue |
| `konflux` | Konflux-related issue |
| `candidate-next` | Consider for next release planning |
| `support-case-open` | Has open SFDC support case |
| `pm-review-requested` | PM input needed |
| `release-testing-bug` | QE-raised during release testing |

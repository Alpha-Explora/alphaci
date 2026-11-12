---
type: "Decision"
title: "Pipeline owners review workflow changes"
description: "A per-organization alphaci-pipeline-owners team of ALPHACI admins owns .github/workflows through CODEOWNERS, and a repository ruleset on dev, uat and main requires its review, bypassable only by the ALPHACI GitHub App."
tags: [architecture, decision, github, branch-protection, codeowners]
status: stable
timestamp: "2026-10-17T00:00:00Z"
sources:
  - id: pr-only-branches
    resource: "/architecture/decisions/adr-0015-github-activity-and-pr-only-branches.md"
    title: "GitHub activity ingest and pull-request-only branches"
---
# ADR-0025: Pipeline owners review workflow changes

**Decision date:** 2026-10-17
**Decision status:** Accepted
**Scope:** CODEOWNERS for generated repositories, the pipeline-owners team, a repository ruleset on dev, uat and main

## Context

A coding agent working under an organization owner's account edited a generated repository's workflows to make its checks pass. It lowered the uat/main coverage gate from 90% to 80% and changed how the verify stage judges the stage before it. A Developer then merged the pull request into `dev` through ALPHACI. Nothing stopped it. The ADR-0015 rule requires a pull request with zero approvals, and `enforce_admins` is off, so an owner can also push straight to the branch.

GitHub Free cannot refuse a push that touches a path; push rulesets need a paid plan with private repositories. On public repositories it can require a code owner's review before a pull request merges into a branch.

## Decisions

1. **A per-organization team, `alphaci-pipeline-owners`, owns the workflows.** Its members are the ALPHACI admins (app role `admin` or a platform admin) who are already members of the organization. Nobody is invited: that is a person's decision, and the outcome lists the admins left out. The team gets Write on each repository, because CODEOWNERS ignores a team without explicit Write. Product owners have only read on GitHub, so they cannot be code owners.
2. **CODEOWNERS** (`.github/CODEOWNERS`) names the team for `/.github/workflows/` and for itself.
3. **A repository ruleset, "ALPHACI pipeline owners", on dev, uat and main** requires a pull request with zero approvals and a code owner's review. Stale approvals are dismissed on push. A pull request that touches no owned path merges as before. One that touches the workflows waits for a pipeline owner. The only bypass actor is the ALPHACI GitHub App. Organization owners and repository admins are held to it, so a direct push to these branches is refused for everyone. That is deliberate: it is how the incident's owner account got around ADR-0015.
4. **Provisioning** does it last, inside `protectPipelineBranches`. Before the branch protection, which refuses direct pushes, it ensures the team and writes CODEOWNERS once on `main`, then fast-forwards `dev` and `uat` to that commit so the three keep one history. A branch that has moved on gets its own commit. After the protection it applies the ruleset. All of it is best effort: it records `project_pipeline_owners_applied` or `project_pipeline_owners_failed` and never fails provisioning.
5. **Existing repositories.** The admin retrofit (`POST /projects/:id/branch-protection`, `POST /admin/branch-protection/apply`) also ensures the team and the ruleset and returns them as `pipelineOwners`. Their branches already refuse direct pushes, so CODEOWNERS arrives through the workflow update pull request, which now includes it for organization repositories.
6. **Where it does not apply.** A personal account has no teams: no CODEOWNERS and no ruleset. A private repository on GitHub Free has no rulesets: the outcome is `unavailable`, not `failed`.
7. **The App needs** Administration: write (ruleset) and Members: write (team), both already required by ADR-0015 and by Project membership grants.

## Consequences

- A workflow change, including one carried by a promotion pull request from dev to uat or uat to main, needs a pipeline owner's approval on GitHub. GitHub never lets a pull request's author approve it, so an agent working as the only admin cannot approve its own change.
- Organization owners can no longer push straight to dev, uat or main.


---
type: "Project Contract"
title: "On-prem host enrollment and assignment"
description: "Workspace machine inventory and explicit project environment assignment."
tags: [architecture, runtime, on-prem]
status: stable
sources:
  - id: hosts
    resource: "src/features/hosts"
    title: "Host model, APIs, view models and views"
  - id: setup
    resource: "src/features/workflows/studio/views/setup-host-selection.tsx"
    title: "Optional host selection during project setup"
---

# On-prem host enrollment and assignment

The thin `/hosts` route renders the Hosts feature inside the existing workspace
shell. Navigation uses the environment provisioning capability. The server's
on-prem flag and existing access/subscription checks remain authoritative.
Inventory is workspace scoped, polls every ten seconds, and displays pending,
connected, prerequisite failure, offline, or revoked. A heartbeat older than 90
seconds is offline. None of these labels implies application health.

Enrollment/revoke controls follow application hosting roles and non-viewer
workspace membership. A code remains only in the mounted workspace view state,
expires at the server timestamp, and can be hidden. The generated installation
commands verify the downloaded SHA-256 before extracting or executing it.
Codes and machine credentials never enter URLs, browser storage, navigation
state, or installation command arguments. The installer asks for the code locally.
Credential replacement and revocation require explicit confirmation. Existing
containers and data can keep running while offline.

Hosting reads the current legacy or reusable-machine assignment and readiness
checks. Assign/replace POSTs carry a stable request ID for network retries and
the expected current assignment ID for compare-and-set. Any edit clears the
replacement confirmation. Unassign uses the expected ID too. A conflict needs
a refresh. No page load or generic retry changes an assignment automatically.
Users edit ports, health paths, and ingress explicitly; production requires a
configured HTTPS ingress URL. Readiness preserves failed and unverified checks.

Project setup optionally selects machines for its on-prem environments.
Workspace changes clear prior selections. Refresh hosts loads new enrollments.
Environments sharing a machine must use distinct host ports. A backend binding
failure appears alongside the created project and directs the user to Hosting
to retry the existing environment. It never retries project creation.

The feature is lean MVVM: `model` owns contracts and installation commands,
`data` owns session-authenticated requests, `view-models` owns cancellation,
pending operations and confirmations, and `views` renders their state.

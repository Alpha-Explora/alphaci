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
  - id: setup-rules
    resource: "src/features/workflows/studio/model/setup-host-assignment-rules.ts"
    title: "Setup assignment defaults and validation"
---

# On-prem host enrollment and assignment

## Hosts page

The thin `/hosts` route renders the Hosts feature inside the workspace shell.
Navigation requires environment provisioning and the enabled `onprem-compose`
provider from `/deployment-providers`. The Hosts page uses the same
availability check before loading inventory. The server's on-prem flag and
access checks remain authoritative.

Inventory is workspace scoped. It polls every ten seconds, and every three
seconds while an enrollment code waits for its machine. A machine shows
Awaiting enrollment, Connected, Prerequisites failed, Offline, or Revoked. A
heartbeat older than 90 seconds is Offline. None of these labels implies
application health.

## Enrollment

Enrollment and revoke controls follow application hosting roles and non-viewer
workspace membership. A code remains only in the mounted view state, expires at
the server timestamp, and can be hidden. The browser can also save an install
file for the machine (`.sh` on Ubuntu, `.cmd` on Windows). It is offered only
for installer 0.2.0 and later, compared as numbers. It is built from the receipt
in the browser and never sent back to the server. Its body carries the code.
Each file hands the code to the installer through a file that the installer
deletes, and the install file deletes itself after a successful run, so a
failed run keeps it for a rerun. The copy-paste command has the installer ask
for the code locally. Both generated installers verify the downloaded SHA-256
before extracting or executing it. Codes and machine credentials never enter
URLs, browser storage, navigation state, or command-line arguments.
Credential replacement and revocation require explicit confirmation. Existing
containers and data can keep running while offline.

## Hosting assignment

Hosting reads the environment's current assignment and readiness checks, and
refreshes the machine list and tunnel report every 20 seconds. Assign/replace
POSTs carry a stable request ID for network retries and the expected current
assignment ID for compare-and-set. Any edit clears the replacement
confirmation. Unassign uses the expected ID too. A conflict needs a refresh. No
page load or generic retry changes an assignment automatically. With exactly
one connected machine, the server assigns it without a picker.

Users edit one container port and one health path per slot (backend,
frontend), and the ingress. AlphaCI allocates the host ports on the machine.
An environment with no assignment pre-fills port and health path from
`GET .../host-assignment/defaults`; a stored assignment keeps its own values.
When the backend has no contract for the app, the fallback is 3000 for a
frontend, 4000 for a backend, and `/` for health.

Ingress is one of:

- `direct`: on the host port, reachable on the machine's own network.
- `configured`: a URL behind an existing proxy or domain.
- `tunnel`, labelled "Automatic HTTPS address": on a server with an apps domain
  the backend makes it a permanent address; otherwise the machine runs a quick
  tunnel whose address changes when the tunnel restarts. The assignment returns
  the machine's report as `tunnel` (null unless the mode is `tunnel`; waiting
  until a fresh report). A tunnel request sends a null public URL.

Production requires an HTTPS address: a configured HTTPS URL or the automatic
address. In the wizard, new assignments default to the automatic address when the
environment deploys a frontend or is production; in Hosting, when it is
production. Otherwise they default to direct. Readiness
preserves failed and unverified checks.

## Project setup

The Create project wizard offers on-prem hosting for one repository and for two
repositories (backend and frontend); two services in one repository are not
supported on-prem. Each on-prem environment can optionally select a machine.
Port and health path come from each project type's `serviceRuntime` in the
backend catalog, and a value the wizard only pre-filled follows a type change.
Workspace changes clear prior selections. Refresh hosts loads new enrollments.
A backend binding failure appears alongside the created project, with each
repository's result for two repositories, and directs the user to Hosting to
retry the existing environment. It never retries project creation.

## Layers

The feature is lean MVVM: `model` owns contracts and installation commands,
`data` owns session-authenticated requests, `view-models` owns polling,
cancellation, pending operations and confirmations, and `views` renders their
state.

---
type: "Feature Map"
title: "Frontend feature map"
description: "Generated inventory of feature domains and the backend contexts they consume."
tags: [architecture, features, map]
status: stable
sources:
  - id: "features"
    resource: "src/features"
    title: "Feature domain tree"
  - id: "surface-registry"
    resource: "docs/capabilities/surface-registry.ts"
    title: "Generated capability surface view"
---

# Frontend feature map

Feature domains are UI ownership boundaries. They consume backend bounded contexts through HTTP; they are not a second catalog and they are not pack-specific application copies.

| Feature domain | Backend context | Current responsibility | Source files |
|---|---|---|---:|
| `admin` | `identity-access` | platform administration, user review, and feedback | 16 |
| `auth` | `identity-access` | sign-in, callback, and session presentation | 18 |
| `capabilities` | `identity-access` | compatibility capability consumption from /api/v1/capabilities | 6 |
| `checklists` | `projects` | team QA checklists and test suites, the project Checklists tab, QA Studio verification runs and evidence, PO Studio acceptance, iterations, QA reports, and the Overview "Returned by QA" card | 195 |
| `groups` | `identity-access` | hierarchy groups, systems, repositories, members, activity, and delivery projects | 59 |
| `guide` | `platform-ops` | in-product guide | 3 |
| `hosts` | `runtime` | on-prem machine enrollment, inventory, and environment host assignment | 21 |
| `home` | `platform-ops` | authenticated home dashboard | 32 |
| `notifications` | `platform-ops` | inbox, live notifications, and notification preferences | 21 |
| `projects` | `projects` | project detail: code, commits, pull requests, pipeline, environments, hosting, promotion, rollback, drift, previews, and settings | 160 |
| `public-site` | `platform-ops` | SaaS marketing landing at / | 17 |
| `runs` | `pipelines` | CI run history presentation | 27 |
| `settings` | `identity-access` | account, workspace, and notification settings | 22 |
| `teams` | `identity-access` | team pages over hierarchy groups: members, Projects explorer, checklist templates, activity, and team settings | 35 |
| `workflows` | `projects` | Create project wizard and workflow studio | 70 |
| `workspace` | `identity-access` | application shell, navigation, and workspace switching | 14 |

Cross-feature imports go through a domain or action `index.ts`. `src/shared/` may not import a feature.

## Verification

Run `npm run boundaries` and `npm run arch:check`.

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
    title: "Capability surface map"
---

# Frontend feature map

Feature domains are UI ownership boundaries. They consume backend bounded contexts through HTTP; they are not a second catalog and they are not pack-specific application copies.

| Feature domain | Backend context | Current responsibility | Source files |
|---|---|---|---:|
| `admin` | `identity-access` | platform administration, user review, and feedback | 16 |
| `auth` | `identity-access` | sign-in, callback, and session presentation | 17 |
| `capabilities` | `identity-access` | compatibility capability consumption from /api/v1/capabilities | 6 |
| `groups` | `identity-access` | hierarchy groups, systems, repositories, members, activity, and delivery projects | 47 |
| `guide` | `platform-ops` | in-product guide | 3 |
| `home` | `platform-ops` | authenticated home dashboard | 18 |
| `notifications` | `platform-ops` | inbox and notification preferences | 15 |
| `projects` | `projects` | project detail, environments, hosting, drift, previews, and workflow settings | 59 |
| `runs` | `pipelines` | CI run history presentation | 20 |
| `settings` | `identity-access` | account, workspace, and notification settings | 18 |
| `teams` | `identity-access` | team listing over hierarchy groups | 10 |
| `workflows` | `projects` | project creation and workflow studio | 48 |
| `workspace` | `identity-access` | application shell, navigation, and workspace switching | 10 |

Cross-feature imports go through a domain or action `index.ts`. `src/shared/` may not import a feature.

## Verification

Run `npm run boundaries` and `npm run arch:check`.

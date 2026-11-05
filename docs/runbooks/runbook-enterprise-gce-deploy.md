---
type: 'Playbook'
title: 'Enterprise GCE deploy'
description: 'How CI deploys AlphaCI to the enterprise Compute Engine VM, the migration gate that can stop it, and the Google Cloud setup it relies on.'
tags: [runbook, deployment, gcp, ci]
status: stable
sources:
  - id: workflow
    resource: '.github/workflows/deploy-enterprise-gce.yml'
    title: 'Deploy workflow'
  - id: images
    resource: '.github/workflows/release.yml'
    title: 'Image build, called by the deploy workflow'
  - id: rollout
    resource: '.github/scripts/deploy-enterprise-gce.sh'
    title: 'Rollout script that runs on the VM'
---

# Enterprise GCE deploy

Alpha Explora's enterprise instance of AlphaCI, `https://enterprise.alphaci.com.ph`, runs on one Compute Engine VM. A green CI run on a push to `main` deploys it.

| Item              | Value                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Project           | `alphaci-enterprise-20261019`                                                                                                                 |
| VM                | `alphaci-enterprise-01`, zone `asia-southeast1-b`, Ubuntu 24.04                                                                               |
| Install directory | `/opt/alphaci`. Its `compose.yaml` runs `api`, `web` and `proxy`. The on-prem host agent and the app containers (`ac-*`) share the directory. |
| Database          | Supabase PostgreSQL, through `secrets/database_url`. No `db` or `migrate` service runs on the VM.                                             |
| Images            | `ghcr.io/alpha-explora/alphaci-be` and `alphaci-fe`, tagged `sha-<commit>` and pinned by digest in `/opt/alphaci/.env`                        |

## What a deploy does

1. `plan` resolves the commit: the CI run's head commit, or the `ref` input of a manual run.
2. `images` builds both images at that commit with `release.yml`, using the self-hosted build arguments, and pushes them to GHCR.
3. `deploy` runs in the `enterprise-gce` GitHub environment. It signs in to Google Cloud with workload identity federation as `alphaci-deployer` and connects to the VM over SSH through IAP.
4. The migration gate reads `/opt/alphaci/.deployed-revision` and compares it with the target commit (see below).
5. `deploy-enterprise-gce.sh` runs on the VM as root:
   - It pulls both digests with the job's `GITHUB_TOKEN`, which is valid only for that job. The token stays in a temporary Docker config that the script deletes after the pull.
   - It backs up `.env` to `.env.before-deploy-<UTC time>` and pins the new digests.
   - It runs `docker compose up --detach --no-deps --wait api web`, then checks `/api/v1/health` and `/healthz` through the proxy on the VM.
   - If a check fails, it restores the backup, restarts the previous images and fails the job.
   - On success, it writes `.deployed-revision` and removes unused untagged images.
6. The job checks both health routes again from the internet.

The proxy, the host agent and the app containers keep running during a deploy.

## Migration gate

The deploy does not apply migrations. The VM's database is Supabase. It was migrated with the Supabase ledger (`supabase_migrations.schema_migrations`), not the self-hosted runner's `public.schema_migrations`, so `migrate-selfhost.js` would treat every migration as pending.

The gate stops the deploy when any of these is true:

- The VM has no `.deployed-revision`. The first deploy always stops here.
- A file under `apps/api/supabase/migrations` changed between the deployed revision and the target.
- The target is not a descendant of the deployed revision, as in a rollback or a rewritten history. An automatic run for an older commit is skipped instead, because a newer one is already deployed.

To continue:

1. Read the files that the job summary lists.
2. Apply them to the VM's database, or confirm that they are already applied. The [migration reconciliation runbook](runbook-migration-reconciliation.md) compares files with a Supabase ledger.
3. Run **Deploy enterprise (GCE)** by hand with the same `ref` and tick **migrations_reviewed**.

## Roll back

Choose one way:

- Run the workflow by hand with the earlier commit as `ref` and tick **migrations_reviewed**. Schema changes are not reversed.
- On the VM, copy the `.env.before-deploy-<UTC time>` file you want back to `.env`. Then run `sudo docker compose up --detach --no-deps --wait api web` in `/opt/alphaci`. The next deploy's gate compares against `.deployed-revision`, which still names the newer commit.

## Google Cloud setup

The deploy needs these resources. All of them are in `alphaci-enterprise-20261019`.

| Resource                                                 | Setting                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workload identity pool `github`, OIDC provider `alphaci` | Issuer `https://token.actions.githubusercontent.com`. The condition admits `Alpha-Explora/alphaci` only (owner ID `295746844`). It maps `attribute.environment` from the token. |
| Service account `alphaci-deployer`                       | `roles/iam.workloadIdentityUser` for `principalSet://…/workloadIdentityPools/github/attribute.environment/enterprise-gce`                                                       |
|                                                          | `roles/compute.osAdminLogin` on the instance `alphaci-enterprise-01` (OS Login with passwordless sudo)                                                                          |
|                                                          | `roles/iap.tunnelResourceAccessor` on the project, with the condition `destination.port == 22`                                                                                  |
|                                                          | `roles/compute.viewer` on the project, so `gcloud compute ssh` can read the instance                                                                                            |
| Firewall `alphaci-enterprise-admin`                      | TCP 22 from `35.235.240.0/20`, the IAP range                                                                                                                                    |

The `enterprise-gce` GitHub environment allows the `main` branch only. To require approval before each deploy, add required reviewers to that environment.

The SSH keys that gcloud adds to the service account's OS Login profile expire after one hour.

## Troubleshooting

| Symptom                                                                   | Check                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `images` fails to push with `denied`                                      | Under the organization's package settings, give this repository write access to the `alphaci-be` or `alphaci-fe` package. A package created from another repository does not accept this repository's token. |
| The rollout step fails at `docker login` or `pull`                        | The package must give this repository at least read access.                                                                                                                                                  |
| `Permission 'iam.serviceAccounts.getAccessToken' denied` in the auth step | The job did not run in the `enterprise-gce` environment, or the run came from another repository.                                                                                                            |
| The rollout rolled back                                                   | The job log shows the last 80 lines of `api` and `web`. On the VM, run `sudo docker compose ps` in `/opt/alphaci`.                                                                                           |

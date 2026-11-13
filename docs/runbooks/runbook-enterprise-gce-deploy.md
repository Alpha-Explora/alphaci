---
type: 'Playbook'
title: 'Enterprise GCE deploy'
description: 'How CI deploys AlphaCI and its settings to the enterprise Compute Engine VM, how to change a setting, the migration gate, stopping and starting the VM, and the Google Cloud setup.'
tags: [runbook, deployment, gcp, ci]
status: stable
sources:
  - id: workflow
    resource: '.github/workflows/deploy-enterprise-gce.yml'
    title: 'Deploy workflow'
  - id: power
    resource: '.github/workflows/enterprise-gce-power.yml'
    title: 'VM power workflow'
  - id: images
    resource: '.github/workflows/release.yml'
    title: 'Image build, called by the deploy workflow'
  - id: template
    resource: 'deploy/enterprise-gce/alphaci.env.template'
    title: 'Settings template'
  - id: secret-files
    resource: 'deploy/enterprise-gce/secret-files'
    title: 'Secret files the deploy writes'
  - id: render
    resource: 'deploy/enterprise-gce/render.sh'
    title: 'Settings renderer that runs on the runner'
  - id: rollout
    resource: 'deploy/enterprise-gce/rollout.sh'
    title: 'Rollout script that runs on the VM'
---

# Enterprise GCE deploy

Alpha Explora's enterprise instance of AlphaCI, `https://enterprise.alphaci.com.ph`, runs on one Compute Engine VM. A green CI run on a push to `main` deploys its code and its settings.

| Item              | Value                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Project           | `alphaci-enterprise-20261019`                                                                                                                 |
| VM                | `alphaci-enterprise-01`, zone `asia-southeast1-b`, Ubuntu 24.04, external IP `34.21.182.183` (reserved address `alphaci-enterprise-ip`)       |
| Install directory | `/opt/alphaci`. Its `compose.yaml` runs `api`, `web` and `proxy`. The on-prem host agent and the app containers (`ac-*`) share the directory. |
| Database          | Supabase PostgreSQL, through `secrets/database_url`. No `db` or `migrate` service runs on the VM.                                             |
| Images            | `ghcr.io/alpha-explora/alphaci-be` and `alphaci-fe`, tagged `sha-<commit>` and pinned by digest in `/opt/alphaci/.env`                        |
| Settings          | The `enterprise-gce` GitHub environment, rendered into `/opt/alphaci/alphaci.env` and `/opt/alphaci/secrets/` on every deploy                 |

## Settings

The repository says which settings exist. The `enterprise-gce` environment (repository **Settings** > **Environments**) holds their values. Every deploy writes them to the VM, so a change made on the VM by hand is undone by the next deploy.

| Where the value lives                                                                                                                                                    | Becomes                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `KEY=value` line in `deploy/enterprise-gce/alphaci.env.template`                                                                                                         | The same line in `alphaci.env`, on every install            |
| `KEY` line in the template, and the environment **variable** `KEY`                                                                                                       | `KEY=<variable>` in `alphaci.env`                           |
| `KEY?` line in the template, and the environment variable `KEY` if it is set                                                                                             | `KEY=<variable>`, or `KEY=` when it is not set              |
| A name in `deploy/enterprise-gce/secret-files`, and the environment **secret** of that name in upper case                                                                | The file `secrets/<name>` (owner uid 1001, mode 0400)       |
| Environment variables `DEPLOY_GCP_PROJECT`, `DEPLOY_GCP_ZONE`, `DEPLOY_GCE_INSTANCE`, `DEPLOY_WORKLOAD_IDENTITY_PROVIDER`, `DEPLOY_SERVICE_ACCOUNT`, `DEPLOY_PUBLIC_URL` | Where the workflow deploys. They are not written to the VM. |

GitHub does not accept variable or secret names that start with `GITHUB_`. For those keys, the environment holds `GH_` instead: `GITHUB_APP_ID` is the variable `GH_APP_ID`, and `secrets/github_app_private_key` is the secret `GH_APP_PRIVATE_KEY`.

A variable holds one line. Write a line break in a value, such as the PEM in `SUPABASE_DB_CA_CERT`, as `\n`.

### Change a setting

1. In the `enterprise-gce` environment, edit the variable or the secret.
2. Run **Deploy enterprise (GCE)** by hand with the deployed commit as `ref`. The job summary of the last deploy names it, and so does `/opt/alphaci/.deployed-revision`.

The run reuses the images of that commit and passes the migration gate, because the revision is the same. On the VM, the rollout compares the rendered settings with the current ones. It restarts `api` and `web`, and `proxy` when `alphaci.env` changed. It does nothing when no value changed. Settings also apply with the next automatic deploy.

### Add or remove a setting

1. Add or remove the line in `alphaci.env.template`, or the name in `secret-files`, in a pull request. For a secret, also add or remove its `SECRET_<NAME>: ${{ secrets.<NAME> }}` line in the **Render settings** step of the workflow. The workflow names each secret, because GitHub holds a workflow that passes all secrets to a remote host for manual approval.
2. Create the variable or secret in the environment before that pull request merges. A deploy whose template names a variable or secret that is not set fails before it connects to the VM, and lists every missing name.

Secret files that `secret-files` does not name, such as the host agent's `machine-token`, are left alone.

## What a deploy does

1. `plan` resolves the commit: the CI run's head commit, or the `ref` input of a manual run. When GHCR already has `sha-<commit>` for both images, it uses those digests.
2. `images` builds both images at that commit with `release.yml`, using the self-hosted build arguments, and pushes them to GHCR. It runs only when `plan` found no images.
3. `deploy` runs in the `enterprise-gce` environment:
   1. `render.sh` renders `alphaci.env` and the secret files from the environment. It stops if a variable or secret is missing.
   2. The job signs in to Google Cloud with workload identity federation as `alphaci-deployer` and connects to the VM over SSH through IAP.
   3. The migration gate reads `/opt/alphaci/.deployed-revision` and compares it with the target commit (see below).
   4. `rollout.sh` runs on the VM as root with the settings on standard input. The settings never touch the VM's disk outside `alphaci.env` and `secrets/`.
4. `rollout.sh` does this:
   1. It compares the image pins in `.env`, `alphaci.env` and each secret with the new ones. If nothing changed, it stops.
   2. It pulls any image that is missing, with the job's `GITHUB_TOKEN`. The token is in a temporary Docker config that the script deletes.
   3. It copies `.env`, `alphaci.env` and the changed secrets to `.deploy-backups/<UTC time>/`, and keeps the newest 10 backups.
   4. It writes the new files, recreates `api` and `web` and waits for them to be healthy, then updates `proxy`. It checks `/api/v1/health` and `/healthz` through the proxy on the VM.
   5. If a check fails, it restores the backup, restarts the previous release and fails the job.
   6. On success, it writes `.deployed-revision` and removes unused untagged images.
5. The job checks both health routes again from the internet.

The host agent and the app containers keep running during a deploy.

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

- Run the workflow by hand with the earlier commit as `ref` and tick **migrations_reviewed**. It deploys that commit with the current settings. Schema changes are not reversed.
- On the VM, in `/opt/alphaci`, copy the files from the `.deploy-backups/<UTC time>/` you want back into place. Then run `sudo docker compose up --detach --no-deps --force-recreate --wait api web proxy`. The next deploy writes the environment's settings again, and its gate compares against `.deployed-revision`, which still names the newer commit.

## Stop and start the VM

Run **Enterprise VM power** by hand and choose an action:

| Action   | What it does                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `status` | Reports the VM's status, and checks `/api/v1/health` and `/healthz` when it is running.                                            |
| `stop`   | Shuts the VM down. Nothing happens if it is already stopped.                                                                       |
| `start`  | Starts the VM, then waits up to 5 minutes for both health routes to answer. When the VM is already running, it only checks health. |

Stopping the VM takes down AlphaCI and every app container (`ac-*`) that the host agent runs on it. Compute charges stop; the disk and the reserved IP are still billed.

On boot, Docker restarts every container, because each one has the restart policy `unless-stopped`. The host agent's timers (`alphaci-machine`, `alphaci-app-routes`) resume on their own. The external IP is reserved, so DNS needs no change.

The workflow uses the deploy's concurrency group, so it never runs during a deploy. It refuses to act while the VM is between states, such as `STOPPING`; run it again once the VM settles.

While the VM is stopped, an automatic deploy skips with a notice, and a manual deploy fails. After a start, check whether a push to `main` was skipped, and if so run **Deploy enterprise (GCE)** by hand with `main` as `ref`.

## Google Cloud setup

The deploy needs these resources. All of them are in `alphaci-enterprise-20261019`.

| Resource                                                 | Setting                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workload identity pool `github`, OIDC provider `alphaci` | Issuer `https://token.actions.githubusercontent.com`. The condition admits `Alpha-Explora/alphaci` only (owner ID `295746844`). It maps `attribute.environment` from the token. |
| Service account `alphaci-deployer`                       | `roles/iam.workloadIdentityUser` for `principalSet://…/workloadIdentityPools/github/attribute.environment/enterprise-gce`                                                       |
|                                                          | `roles/compute.osAdminLogin` on the instance `alphaci-enterprise-01` (OS Login with passwordless sudo)                                                                          |
|                                                          | `roles/iap.tunnelResourceAccessor` on the project, with the condition `destination.port == 22`                                                                                  |
|                                                          | `roles/compute.viewer` on the project, so `gcloud compute ssh` can read the instance and the power workflow can read its status                                                 |
|                                                          | The custom role `alphaciVmPower` (`compute.instances.start` and `compute.instances.stop`) on the instance `alphaci-enterprise-01`, for the power workflow                       |
| Static external address `alphaci-enterprise-ip`          | `34.21.182.183` in `asia-southeast1`, attached to the VM, so the address survives a stop and start                                                                              |
| Firewall `alphaci-enterprise-admin`                      | TCP 22 from `35.235.240.0/20`, the IAP range                                                                                                                                    |

The `enterprise-gce` GitHub environment allows the `main` branch only. To require approval before each deploy, add required reviewers to that environment.

The SSH keys that gcloud adds to the service account's OS Login profile expire after one hour.

## Troubleshooting

| Symptom                                                                    | Check                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Render settings` fails with `set these in the enterprise-gce environment` | Create each variable or secret it lists, then run the workflow again.                                                                                                                                        |
| `images` fails to push with `denied`                                       | Under the organization's package settings, give this repository write access to the `alphaci-be` or `alphaci-fe` package. A package created from another repository does not accept this repository's token. |
| The rollout step fails at `docker login` or `pull`                         | The package must give this repository at least read access.                                                                                                                                                  |
| `Permission 'iam.serviceAccounts.getAccessToken' denied` in the auth step  | The job did not run in the `enterprise-gce` environment, or the run came from another repository.                                                                                                            |
| A deploy says `Deploy skipped: VM is TERMINATED`                           | The VM is stopped. Start it with **Enterprise VM power**, then run the deploy by hand.                                                                                                                       |
| **Enterprise VM power** `start` fails its health check                     | On the VM, run `sudo docker compose ps` in `/opt/alphaci` and `systemctl status docker`.                                                                                                                     |
| The rollout rolled back                                                    | The job log shows the last 80 lines of `api` and `web`. On the VM, run `sudo docker compose ps` in `/opt/alphaci`.                                                                                           |

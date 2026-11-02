# Runbooks

## Self-hosted operator path

1. [Self-hosted install](runbook-selfhost-install.md) - install the AlphaCI appliance with Docker Compose; `alphaci-ctl`, doctor, backup, restore, upgrade, private release images, and deployments on the AlphaCI server.
2. [Self-hosted web image](runbook-selfhost-web-image.md) - fixed build arguments, the same-origin proxy contract, and liveness of the web image.
3. [Database migrations](runbook-database-migrations.md) - how the `migrate` service and the self-hosted runner apply the migration tree.
4. [On-prem host setup](runbook-onprem-host-setup.md) - enroll Ubuntu or Windows (WSL2) machines, assign environments, addresses, signing, and troubleshooting.
5. [On-prem self-enrolling images](runbook-onprem-self-enrolling-images.md) - build an Ubuntu VM or WSL2 distro that enrolls itself on first boot.
6. [Workspace member notifications](../operations/workspace-member-notifications.md) - enable and verify live notifications.

## Hosted service and development

* [Local verification](runbook-local-verification.md) - reproducible local checks for both apps and the documentation bundle.
* [Session authentication](runbook-session-auth.md) - cookie session, CORS, and API origin procedure for the web app.
* [Outbox relay](runbook-outbox-relay.md) - inspect and run the single PostgreSQL outbox relay.
* [Migration reconciliation](runbook-migration-reconciliation.md) - reconcile migration files with a Supabase migration ledger.
* [Deployment provisioning](runbook-deployment-provisioning.md) - provider targets, on-prem targets, and Render or Vercel rollback.
* [Deployment provisioning live smoke](runbook-deployment-provisioning-live-smoke.md) - approved external-resource verification.
* [Authentication custom-domain cutover](runbook-auth-custom-domain-cutover.md) - first-party session cookies for the hosted web app and API.
* [Performance smoke](runbook-performance-smoke.md) - optional k6 health check.

Runbooks describe current procedures and required evidence. They do not authorize destructive production actions by themselves.

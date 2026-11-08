---
type: "Architecture Decision Record"
title: "Bound addresses"
description: "An on-prem environment can be served by its machine under the customer's own hostname, listen address and certificate, the way an IIS binding works."
tags: [architecture, runtime, on-prem, ingress, tls]
status: stable
sources:
  - id: binding-domain
    resource: "apps/api/src/modules/runtime/domain/onprem-binding.ts"
    title: "Binding rules and readiness"
  - id: certificate-parser
    resource: "apps/api/src/modules/runtime/application/onprem/onprem-certificate-parser.ts"
    title: "Certificate upload parser"
  - id: migration
    resource: "apps/api/supabase/migrations/runtime/20261108010000_onprem_address_bindings.sql"
    title: "Certificates, binding reports and the hostname index"
  - id: agent
    resource: "apps/api/deploy/onprem/agent/binding.sh"
    title: "Agent binding sync"
---
# ADR-0023: Bound addresses

**Decision date:** 2026-11-08
**Decision status:** Accepted
**Scope:** How users reach an on-prem environment under a name the customer owns. Extends the ingress modes in [release registry](../api/release-registry.md).

## Context

Customers moving from IIS configured each site with a binding: a local IP
address, port 443, a host name and a certificate from the Windows store,
usually issued by an internal CA. AlphaCI's on-prem ingress had three modes.
`direct` is a host port. `configured` records a URL that something outside
AlphaCI serves. `tunnel` is a Cloudflare quick tunnel, or a name under
`ONPREM_APPS_DOMAIN` on the AlphaCI server. None of them let the customer
choose the name, the listen address and the certificate, and have AlphaCI
serve them.

## Decision

1. A fourth ingress mode, `bound`, carries `{hostname, listenAddress,
   tls}`. `tls` is `acme` (the proxy obtains a public certificate),
   `certificate` (an uploaded one) or `internal` (the proxy's private CA,
   refused for production). The port is always 443. The existing modes are
   unchanged.
2. The server derives `publicUrl` (`https://<hostname>`) and stores it with the
   binding, so every reader of the environment's address works unchanged.
3. A hostname is active on at most one environment across all workspaces (a
   partial unique index). It may not be AlphaCI's own host or a name under
   the apps domain, because the proxy refuses a configuration that names one
   site twice.
4. Certificates belong to a workspace. An upload is a `.pfx` with its
   password, as IIS exports it, or a PEM chain and key. node-forge only
   unwraps the PKCS#12 container; Node's X.509 support does every check: the
   key matches a certificate, the chain is ordered leaf first, the
   certificate names DNS hosts and has not expired. The private key is
   encrypted at rest with `ENV_PROVISIONING_ENCRYPTION_KEY`. A machine
   downloads it from `GET /onprem/certificates/:id` only while one of its
   active assignments uses it, and only when the SHA-256 it holds differs.
5. The machine serves the binding with Caddy, from one site file per
   environment that the agent writes. On the AlphaCI server the appliance's
   own Caddy imports those files. On any other host the agent runs an
   `alphaci-edge` Caddy container with host networking, so `bind` can name
   the listen address. The machine reports each binding's state with every
   check-in, and readiness shows it.
6. Deploying never waits for a binding: its address is known up front.
   Readiness fails when the machine cannot serve it or the certificate has
   expired, and warns 30 days before expiry.

## Consequences

- An IIS administrator can reuse their certificate and DNS records. AlphaCI
  cannot create DNS records; readiness names the A record to create.
- ACME needs public DNS and inbound ports 80 and 443. Internal-only
  networks use an uploaded certificate from their CA.
- On the AlphaCI server the proxy listens on every address, so a binding
  there cannot name a listen address; the agent reports that as a failure.
  `ALPHACI_BIND_ADDRESS` limits the whole appliance to one address instead.
- Agents before 0.5.0 ignore bindings. Readiness asks for an update.
- Renewing a certificate is an upload and a reassignment to the new one.
  Certificates are immutable, so a machine never holds a half-updated pair.

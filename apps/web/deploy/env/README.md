# Frontend composition combinations

Each file sets `ALPHACI_BUILD_PROFILE` and `ALPHACI_EDITION` for one edition:

| File | Profile | Edition | `/` |
|---|---|---|---|
| `hosted-saas.env` | `hosted` | `saas` | marketing landing |
| `hosted-edu.env` | `hosted` | `edu` | redirects to `/login` |
| `enterprise.env` | `enterprise` | `enterprise` | redirects to `/login` |

Copy one to `.env.local`, or let `npm run dev:<edition>` set the same variables
for a single run without touching any file:

```powershell
Copy-Item deploy/env/hosted-saas.env .env.local
npm run dev:saas
```

Both variables are read by `next.config.ts` at build time and inlined into the
bundle, so a change needs a rebuild or a dev-server restart, not just a reload.
Keep them in step with the backend's values; nothing cross-checks the two
services.

The self-hosted image uses the `enterprise.env` pair, passed as Docker build
arguments together with `NEXT_PUBLIC_API_BASE_URL=/api/v1`. See
[`docs/runbooks/runbook-selfhost.md`](../../docs/runbooks/runbook-selfhost.md).

There is deliberately no `enterprise-client.env` here, unlike the backend. The
client axis (`ALPHACI_CLIENT`, `ALPHACI_CLIENT_CONFIG`) narrows an Enterprise
deployment's capabilities at runtime and is resolved entirely by the backend.
The frontend learns the result from `/api/v1/capabilities`. A file here that set
nothing would only imply otherwise.

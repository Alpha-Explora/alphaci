# Frontend composition combinations

Copy one to `.env.local`, or let `npm run dev:<edition>` set the same variables
for a single run without touching any file:

```powershell
Copy-Item deploy/env/hosted-saas.env .env.local
npm run dev:saas
```

Both variables are read by `next.config.ts` at build time and inlined into the
bundle, so a change needs a rebuild or a dev-server restart, not just a reload.

There is deliberately no `enterprise-client.env` here, unlike the backend. The
client axis (`ALPHACI_CLIENT`, `ALPHACI_CLIENT_CONFIG`) narrows an Enterprise
deployment's capabilities at runtime and is resolved entirely by the backend.
The frontend learns the result from `/api/v1/capabilities`. A file here that set
nothing would only imply otherwise.

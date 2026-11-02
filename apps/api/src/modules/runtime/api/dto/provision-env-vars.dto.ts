/**
 * The body of POST /projects/:projectId/env-vars/provision, defined once in
 * `@alphaci/api-contracts`.
 *
 * `gitBranch` is required for the preview lane and rejected for production;
 * EnvVarsService.resolveScope is the single place that pairing is validated.
 */
export type { ProvisionEnvVarsRequest as ProvisionEnvVarsDto } from '@alphaci/api-contracts';

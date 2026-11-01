import { request } from "@/shared/api/request";

import type { DeploymentProviderAvailability } from "../model/onprem-hosting-rules";

/**
 * `GET /deployment-providers`, for the create wizard's on-prem choice.
 *
 * The Hosting tab reads the same endpoint through the projects feature. This
 * is a separate module on purpose: the wizard's view-model reads it on mount,
 * and the existing jest.mock factories of the projects barrel would otherwise
 * hand that read `undefined`.
 */
export const deploymentProvidersRepository = {
  async list(): Promise<DeploymentProviderAvailability[]> {
    const response = await request<{ providers?: DeploymentProviderAvailability[] }>(
      "/deployment-providers",
    );
    return Array.isArray(response?.providers) ? response.providers : [];
  },
};

/**
 * Delivery projects (the product's "Projects").
 *
 * GET /delivery-projects/:deliveryProjectId, PATCH it and
 * POST /delivery-projects/:deliveryProjectId/archive return one DeliveryProject.
 * GET /systems/:systemId/delivery-projects returns DeliveryProject[].
 */

import type { LifecycleStatus } from './groups.js';

export interface DeliveryProject {
  id: string;
  systemId: string;
  groupId: string;
  name: string;
  description: string | null;
  managerId: string | null;
  status: LifecycleStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Repositories that are not archived. */
  repositoryCount: number;
}

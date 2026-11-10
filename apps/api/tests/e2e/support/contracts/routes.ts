import { z } from 'zod';

import {
  DeliveryProjectSchema,
  GroupMemberSchema,
  GroupSchema,
} from './hierarchy';
import {
  ProjectSemanticCoverageSchema,
  ProjectTodoListSchema,
  ProjectTodoSchema,
  QaHistoryPageSchema,
  QaImportPreviewSchema,
  SpecialAccessResponseSchema,
} from './qa-tracker';

/*
 * The routes whose response is declared in @alphaci/api-contracts, each with the
 * schema its real response is checked against (tests/e2e/hierarchy-contracts,
 * tests/e2e/qa-tracker-contracts).
 * Keys use the route inventory form (`METHOD /api/v1/path/{param}`).
 *
 * tests/architecture/route-contracts.spec.ts requires every route to be here or
 * in route-contracts.baseline.txt, so a new route either declares its contract
 * or shows up in a reviewed diff as one that does not. Each e2e spec checks
 * that it exercised every route of its own group.
 */
export const HIERARCHY_CONTRACTS = {
  'POST /api/v1/groups': GroupSchema,
  'GET /api/v1/groups': z.array(GroupSchema),
  'GET /api/v1/groups/{groupId}': GroupSchema,
  'PATCH /api/v1/groups/{groupId}': GroupSchema,
  'POST /api/v1/groups/{groupId}/archive': GroupSchema,
  'POST /api/v1/groups/{groupId}/reopen': GroupSchema,
  'GET /api/v1/groups/{groupId}/members': z.array(GroupMemberSchema),
  'POST /api/v1/systems/{systemId}/delivery-projects': DeliveryProjectSchema,
  'GET /api/v1/systems/{systemId}/delivery-projects': z.array(
    DeliveryProjectSchema,
  ),
  'GET /api/v1/delivery-projects/{deliveryProjectId}': DeliveryProjectSchema,
  'PATCH /api/v1/delivery-projects/{deliveryProjectId}': DeliveryProjectSchema,
  'POST /api/v1/delivery-projects/{deliveryProjectId}/archive':
    DeliveryProjectSchema,
} as const;

export const QA_TRACKER_CONTRACTS = {
  'GET /api/v1/delivery-projects/{deliveryProjectId}/todos':
    ProjectTodoListSchema,
  'POST /api/v1/delivery-projects/{deliveryProjectId}/todos': ProjectTodoSchema,
  'PATCH /api/v1/delivery-projects/{deliveryProjectId}/todos/{todoId}':
    ProjectTodoSchema,
  'GET /api/v1/delivery-projects/{deliveryProjectId}/qa-history':
    QaHistoryPageSchema,
  'GET /api/v1/delivery-projects/{deliveryProjectId}/semantic-coverage':
    ProjectSemanticCoverageSchema,
  'POST /api/v1/delivery-projects/{deliveryProjectId}/qa-import-preview':
    QaImportPreviewSchema,
  'PATCH /api/v1/admin/users/{id}/special-access': SpecialAccessResponseSchema,
} as const;

export const ROUTE_CONTRACTS = {
  ...HIERARCHY_CONTRACTS,
  ...QA_TRACKER_CONTRACTS,
} as const;

export type ContractRoute = keyof typeof ROUTE_CONTRACTS;

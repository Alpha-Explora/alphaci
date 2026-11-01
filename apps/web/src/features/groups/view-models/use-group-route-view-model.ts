"use client";

import { useParams } from "next/navigation";

/**
 * Route adapter for the group domain: owns the useParams call so views don't
 * have to. Every group action slice is scoped by the same route parameter, so
 * one adapter serves all of them.
 */
export function useGroupRouteViewModel() {
  const params = useParams<{ groupId: string }>();
  return { groupId: params.groupId };
}

export function useGroupRepositoryRouteViewModel() {
  const params = useParams<{ groupId: string; repositoryId: string }>();
  return { groupId: params.groupId, repositoryId: params.repositoryId };
}

export function useGroupSystemRouteViewModel() {
  const params = useParams<{ groupId: string; systemId: string }>();
  return { groupId: params.groupId, systemId: params.systemId };
}

export function useGroupDeliveryProjectRouteViewModel() {
  const params = useParams<{ groupId: string; deliveryProjectId: string }>();
  return { groupId: params.groupId, deliveryProjectId: params.deliveryProjectId };
}

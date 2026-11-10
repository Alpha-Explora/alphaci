/** One event of a Project's Dev and QA audit trail, newest first. */
export interface QaHistoryEvent {
  id: string;
  createdAt: string;
  iterationId: string;
  iterationNumber: number;
  runId: string | null;
  itemId: string | null;
  title: string;
  requirementName: string;
  actorLogin: string | null;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown>;
}

/** `GET /delivery-projects/:id/qa-history`: 50 events, and the cursor of the next page or null. */
export interface QaHistoryPage {
  events: QaHistoryEvent[];
  nextCursor: string | null;
}

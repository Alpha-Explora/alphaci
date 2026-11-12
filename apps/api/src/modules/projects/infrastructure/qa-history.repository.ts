import { Injectable } from '@nestjs/common';
import { DatabaseService } from '#kernel/db/database.service';

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

@Injectable()
export class QaHistoryRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(
    projectId: string,
    filter: {
      itemId?: string;
      iterationId?: string;
      before?: { at: string; id: string };
      /** Rows to read; the page size plus one so the caller can tell there is more. Default 51. */
      limit?: number;
    },
  ): Promise<QaHistoryEvent[]> {
    const result = await this.db.query<QaHistoryEvent>(
      `
      WITH events AS (
        SELECT 'qa:' || e.id AS id, e.created_at AS at, r.iteration_id,
          r.id AS run_id, ri.source_item_id AS item_id, ri.title,
          COALESCE(ri.requirement_name, '') AS requirement_name,
          e.actor_login, e.event_type AS type, e.from_status, e.to_status, e.payload
        FROM projects.qa_run_item_events e
        JOIN projects.qa_run_items ri ON ri.id = e.run_item_id
        JOIN projects.qa_verification_runs r ON r.id = e.run_id
        WHERE r.delivery_project_id = $1 AND r.scope = 'project'
        UNION ALL
        SELECT 'progress:' || e.id, e.created_at, e.iteration_id,
          NULL::uuid, e.source_item_id, e.title, e.requirement_name,
          e.actor_login, 'progress_changed', e.from_status, e.to_status, '{}'::jsonb
        FROM projects.qa_progress_events e WHERE e.delivery_project_id = $1
        UNION ALL
        SELECT 'signoff:' || s.id, s.signed_at, r.iteration_id,
          r.id, NULL::uuid, 'QA sign-off', '', s.signed_by_login,
          'signed_off', NULL, s.verdict,
          jsonb_build_object('summary', s.summary, 'supersededAt', s.superseded_at)
        FROM projects.qa_run_signoffs s
        JOIN projects.qa_verification_runs r ON r.id = s.run_id
        WHERE r.delivery_project_id = $1 AND r.scope = 'project'
      )
      SELECT id, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt", iteration_id AS "iterationId",
        (SELECT number FROM projects.project_iterations i WHERE i.id = events.iteration_id) AS "iterationNumber",
        run_id AS "runId", item_id AS "itemId", title,
        requirement_name AS "requirementName", actor_login AS "actorLogin",
        type, from_status AS "fromStatus", to_status AS "toStatus", payload
      FROM events
      WHERE ($2::uuid IS NULL OR item_id = $2)
        AND ($3::uuid IS NULL OR iteration_id = $3)
        AND ($4::timestamptz IS NULL OR (at, id) < ($4::timestamptz, $5::text))
      ORDER BY at DESC, id DESC LIMIT $6;
    `,
      [
        projectId,
        filter.itemId ?? null,
        filter.iterationId ?? null,
        filter.before?.at ?? null,
        filter.before?.id ?? null,
        filter.limit ?? 51,
      ],
    );
    return result.rows;
  }
}

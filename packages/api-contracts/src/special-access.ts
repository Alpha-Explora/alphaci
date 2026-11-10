/** Admin-granted extras on top of a person's role (@alphaci/persona-rules holds the rules). */
export type SpecialAccess = 'qa_release' | 'deployment_override';

/** `PATCH /admin/users/:id/special-access`: the person's grants after the change. */
export interface SpecialAccessResponse {
  specialAccess: SpecialAccess[];
}

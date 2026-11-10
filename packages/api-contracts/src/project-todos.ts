/** A to-do's priority; also a User story's. */
export type BacklogPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProjectTodoStatus = 'open' | 'done';

export interface TodoPerson {
  id: string;
  login: string | null;
}

/** One team to-do: `POST /delivery-projects/:id/todos` and `PATCH .../todos/:todoId` answer it. */
export interface ProjectTodo {
  id: string;
  deliveryProjectId: string;
  title: string;
  notes: string | null;
  assignee: TodoPerson | null;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  priority: BacklogPriority | null;
  status: ProjectTodoStatus;
  createdBy: TodoPerson;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedByLogin: string | null;
  rowVersion: number;
  /** The creator, a Product owner or an admin: edit the details and delete. Anyone may tick it done. */
  canEdit: boolean;
}

/** `GET /delivery-projects/:id/todos` */
export interface ProjectTodoList {
  /** Open first (soonest due, highest priority), then done in the last 30 days. */
  todos: ProjectTodo[];
  /** Who a to-do can be assigned to: the Project team's active members. */
  assignees: TodoPerson[];
}

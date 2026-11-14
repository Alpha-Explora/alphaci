'use client';

import type { GroupMember } from '@/features/groups';
import {
  useAddMemberViewModel,
  type AddMemberViewModel,
} from '../view-models/use-add-member-view-model';
import { Avatar, FormDialog } from './primitives';

/**
 * The team's Projects the person also joins. Joining the team gives no
 * repository access by itself; a Developer gets GitHub write access through
 * the Projects picked here.
 */
function ProjectPicker({ vm }: Readonly<{ vm: AddMemberViewModel }>) {
  let body;
  if (vm.projectsStatus === 'loading') {
    body = (
      <span className="hier-field-hint">{'Loading this team’s Projects…'}</span>
    );
  } else if (vm.projectsStatus === 'error') {
    body = (
      <span className="hier-field-hint">
        {
          'Couldn’t load this team’s Projects. You can still add the member, then add them to Projects from each Project’s Members.'
        }
      </span>
    );
  } else if (vm.projects.length === 0) {
    body = (
      <span className="hier-field-hint">This team has no Projects yet.</span>
    );
  } else {
    body = (
      <div className="invite-projects">
        {vm.projects.map((project) => (
          <label key={project.deliveryProjectId} className="invite-project">
            <input
              type="checkbox"
              checked={vm.selectedProjectIds.has(project.deliveryProjectId)}
              onChange={() => vm.toggleProject(project.deliveryProjectId)}
            />
            <span>{project.name}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <fieldset className="hier-field invite-projects-field">
      <legend className="hier-field-label">Projects (optional)</legend>
      {body}
      {vm.projectsStatus === 'ready' && vm.projects.length > 0 && (
        <span className="hier-field-hint">
          Everyone you add joins the Projects you pick. A Developer gets GitHub
          write access to every repository of those Projects; without a Project,
          they get no repository access.
        </span>
      )}
    </fieldset>
  );
}

/** The people picked so far; each chip can be dropped before adding. */
function SelectedMembers({ vm }: Readonly<{ vm: AddMemberViewModel }>) {
  if (vm.selectedUsers.length === 0) return null;
  return (
    <ul className="invite-chips" aria-label="Selected members">
      {vm.selectedUsers.map((user) => (
        <li key={user.login} className="invite-chip">
          <Avatar
            login={user.login}
            name={user.name}
            avatarUrl={user.avatarUrl}
          />
          <span className="invite-chip__name">{user.name ?? user.login}</span>
          <button
            type="button"
            className="invite-chip__remove"
            aria-label={`Remove ${user.name ?? user.login}`}
            onClick={() => vm.removeUser(user.login)}
            disabled={vm.submitting}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

function submitLabelFor(count: number): string {
  return count > 1 ? `Add ${count} members` : 'Add member';
}

/**
 * Adds one or more people to a group immediately. There is no invitation and
 * nothing for them to accept — they are members the moment this succeeds.
 */
export function AddMemberDialog({
  open,
  groupId,
  onClose,
  onAdded,
}: {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onAdded: (member: GroupMember) => void;
}) {
  const vm = useAddMemberViewModel({ open, groupId, onAdded, onClose });

  return (
    <FormDialog
      open={open}
      onClose={vm.close}
      title="Add member"
      description="Pick one or more members of your GitHub organization. They join as Members straight away — you can promote them to Lead afterward."
      submitLabel={submitLabelFor(vm.selectedUsers.length)}
      submitting={vm.submitting}
      error={vm.error}
      canSubmit={vm.canSubmit}
      onSubmit={vm.submit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="add-member-user">
          Organization members
        </label>

        <SelectedMembers vm={vm} />
        <input
          id="add-member-user"
          className="hier-input"
          value={vm.search}
          onChange={(event) => vm.setSearch(event.target.value)}
          /* Deliberately does not name the organization: which directory
             backs this deployment is configuration (MEMBER_DIRECTORY_*),
             published by GET /api/v1/directory. Naming it here has to
             come from that data, never a hardcoded org. */
          placeholder="Search by name or GitHub login"
          autoComplete="off"
        />
        {vm.results.length > 0 && (
          <div
            className="invite-results"
            role="listbox"
            aria-label="Organization members"
            aria-multiselectable="true"
          >
            {vm.results.map((user) => {
              const selected = vm.isSelected(user);
              return (
                <button
                  key={user.login}
                  type="button"
                  className="invite-result"
                  role="option"
                  aria-selected={selected}
                  disabled={!user.hasAccount || vm.submitting}
                  title={
                    user.hasAccount
                      ? undefined
                      : "Hasn't signed into AlphaCI yet"
                  }
                  onClick={() => vm.toggleUser(user)}
                >
                  <Avatar
                    login={user.login}
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                  />
                  <div className="invite-result__meta">
                    <strong>{user.name ?? user.login}</strong>
                    <span>
                      @{user.login}
                      {user.hasAccount
                        ? user.email
                          ? ` · ${user.email}`
                          : ''
                        : " · hasn't signed in yet"}
                    </span>
                  </div>
                  {user.hasAccount ? (
                    <span className="invite-result__check" aria-hidden="true">
                      <svg viewBox="0 0 16 16">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </span>
                  ) : (
                    <span className="invite-result__flag">No account</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <span className="hier-field-hint" role="status">
          {vm.status === 'loading'
            ? 'Loading organization members…'
            : (vm.emptyMessage ??
              "Members without an AlphaCI account can't be added until they sign in.")}
        </span>
      </div>

      <ProjectPicker vm={vm} />
    </FormDialog>
  );
}

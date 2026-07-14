"use client";

import { useEffect, useState } from "react";

import {
  acceptGroupInvitation,
  declineGroupInvitation,
  getMyInvitations,
} from "@/lib/api/client";
import type { GroupInvitation } from "@/lib/api/hierarchy-contracts";
import { Avatar } from "@/components/hierarchy/primitives";
import { timeAgo } from "@/hooks/use-hierarchy";

/**
 * Invitee inbox. Group leads send invitations from the members panel, but until
 * now the invited person had no way to *act* on one — there was no surface that
 * listed their pending invitations. This banner fetches
 * GET /groups/invitations/mine and lets them Accept (join the group) or Decline.
 * On accept it asks the parent to refresh the groups list so the newly-joined
 * group appears immediately.
 */
export function PendingInvitationsBanner({
  onAccepted,
}: {
  onAccepted?: () => void;
}) {
  const [invitations, setInvitations] = useState<GroupInvitation[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMyInvitations()
      .then((items) => {
        if (active) setInvitations(items);
      })
      .catch(() => {
        // Hierarchy may be disabled/unreachable — hide the banner rather than
        // surfacing an error on a surface the user didn't explicitly open.
        if (active) setInvitations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function accept(invitation: GroupInvitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      await acceptGroupInvitation(invitation.id);
      setInvitations((current) =>
        (current ?? []).filter((item) => item.id !== invitation.id),
      );
      onAccepted?.();
    } catch {
      setError("That invitation could not be accepted. It may have been revoked.");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(invitation: GroupInvitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      await declineGroupInvitation(invitation.id);
      setInvitations((current) =>
        (current ?? []).filter((item) => item.id !== invitation.id),
      );
    } catch {
      setError("That invitation could not be declined. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!invitations || invitations.length === 0) return null;

  return (
    <section
      className="invitations-inbox glass-panel"
      aria-label="Your group invitations"
    >
      <div className="invitations-inbox__header">
        <h3>
          You have {invitations.length}{" "}
          {invitations.length === 1 ? "invitation" : "invitations"}
        </h3>
        <p>Accept to join the group, or decline to dismiss it.</p>
      </div>
      <ul className="invitations-inbox__list">
        {invitations.map((invitation) => {
          const inviter =
            invitation.invitedByName || invitation.invitedByLogin;
          return (
            <li key={invitation.id} className="invitations-inbox__item">
              <Avatar
                login={invitation.invitedByLogin}
                name={invitation.invitedByName}
              />
              <div className="invitations-inbox__meta">
                <strong>{invitation.groupName ?? "A group"}</strong>
                <span>
                  {inviter ? `Invited by ${inviter} · ` : ""}
                  {timeAgo(invitation.createdAt)}
                </span>
              </div>
              <div className="invitations-inbox__actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={busyId === invitation.id}
                  onClick={() => void accept(invitation)}
                >
                  {busyId === invitation.id ? "Working…" : "Accept"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busyId === invitation.id}
                  onClick={() => void decline(invitation)}
                >
                  Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="error-text" role="alert" style={{ margin: "0.5rem 0 0" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

import {
  acceptGroupInvitation,
  declineGroupInvitation,
  getMyInvitations,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
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

  // Map the backend's status codes to a specific reason instead of a single
  // catch-all, so a genuinely revoked/expired invite reads differently from a
  // transient server error. A 400/404/409 means the invite is no longer
  // actionable, so we also drop it from the list.
  function invitationGoneMessage(cause: unknown, verb: "accepted" | "declined") {
    if (cause instanceof ApiError) {
      if (cause.status === 404)
        return { message: "This invitation no longer exists.", gone: true };
      if (cause.status === 400 || cause.status === 409)
        return {
          message:
            "This invitation is no longer pending — it may have been revoked, or you already responded.",
          gone: true,
        };
      if (cause.status === 403)
        return {
          message: "This invitation isn't addressed to your account.",
          gone: false,
        };
    }
    return { message: `The invitation could not be ${verb}. Please try again.`, gone: false };
  }

  async function accept(invitation: GroupInvitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      await acceptGroupInvitation(invitation.id);
      setInvitations((current) =>
        (current ?? []).filter((item) => item.id !== invitation.id),
      );
      onAccepted?.();
    } catch (cause) {
      const { message, gone } = invitationGoneMessage(cause, "accepted");
      setError(message);
      if (gone) {
        setInvitations((current) =>
          (current ?? []).filter((item) => item.id !== invitation.id),
        );
      }
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
    } catch (cause) {
      const { message, gone } = invitationGoneMessage(cause, "declined");
      setError(message);
      if (gone) {
        setInvitations((current) =>
          (current ?? []).filter((item) => item.id !== invitation.id),
        );
      }
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

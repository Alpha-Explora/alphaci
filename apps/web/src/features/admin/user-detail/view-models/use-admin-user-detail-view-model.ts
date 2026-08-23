"use client";

import { useEffect, useRef, useState } from "react";

import { adminRepository } from "../../data/admin-repository";
import { describeRoleError } from "../../model/admin-rules";
import {
  APP_ROLE_LABELS,
  type AdminStatus,
  type AdminUserDetail,
  type AppRole,
} from "../../model/admin-types";

export interface AdminUserDetailViewModel {
  detail: AdminUserDetail | null;
  status: AdminStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** True while a role write is in flight. */
  roleBusy: boolean;
  /** Outcome of the last role action, success or failure. */
  roleMessage: string | null;
  setRole: (role: AppRole) => Promise<void>;
  resetRoleToGithub: () => Promise<void>;
}

/** ViewModel for one user in the admin console. */
export function useAdminUserDetailViewModel(
  id: string,
): AdminUserDetailViewModel {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [status, setStatus] = useState<AdminStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const [nonce, setNonce] = useState(0);
  const req = useRef(0);

  useEffect(() => {
    req.current += 1;
    const rid = req.current;
    let active = true;

    adminRepository
      .user(id)
      .then((next) => {
        if (!active || rid !== req.current) return;
        setDetail(next);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || rid !== req.current) return;
        setError("Could not load this user.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [id, nonce]);

  /** Re-reads the user after a write; the role write owns its own busy flag. */
  const reload = () => setNonce((n) => n + 1);

  async function setRole(next: AppRole) {
    setRoleBusy(true);
    setRoleMessage(null);
    try {
      await adminRepository.setUserRole(id, next);
      reload();
      setRoleMessage(`Role set to ${APP_ROLE_LABELS[next]}.`);
    } catch (cause) {
      setRoleMessage(`Failed to update role: ${describeRoleError(cause)}`);
    } finally {
      setRoleBusy(false);
    }
  }

  /**
   * Unpins the user so GitHub team membership drives their role again.
   *
   * The role itself does not change here — the backend has no GitHub token on
   * this request — so the message says what will actually happen rather than
   * implying an immediate change.
   */
  async function resetRoleToGithub() {
    setRoleBusy(true);
    setRoleMessage(null);
    try {
      await adminRepository.resetUserRoleToGithub(id);
      reload();
      setRoleMessage(
        "Now following GitHub teams. The role updates on their next sign-in, or immediately if their team membership changes.",
      );
    } catch (cause) {
      setRoleMessage(`Failed to reset role: ${describeRoleError(cause)}`);
    } finally {
      setRoleBusy(false);
    }
  }

  return {
    detail,
    status,
    error,
    roleBusy,
    roleMessage,
    setRole,
    resetRoleToGithub,
  };
}

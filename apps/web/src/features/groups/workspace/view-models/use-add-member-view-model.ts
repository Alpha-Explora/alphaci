"use client";

import { useCallback, useEffect, useState } from "react";

import { groupsRepository } from "../../data/groups-repository";
import type {
  GroupMember,
  InternalUserDirectoryEntry,
} from "../../model/groups-types";
import {
  describeAddMemberError,
  describeDirectoryError,
  emptyDirectoryMessage,
} from "../../model/member-directory-rules";

/** `idle` while closed or once someone is picked; the list is not needed. */
export type MemberDirectoryStatus = "idle" | "loading" | "ready" | "error";

export const DIRECTORY_SEARCH_DEBOUNCE_MS = 250;

interface Lookup {
  /** The group and search this answer belongs to. */
  key: string;
  status: "loading" | "ready" | "error";
  results: InternalUserDirectoryEntry[];
  error: string | null;
}

interface LookupView {
  status: MemberDirectoryStatus;
  results: InternalUserDirectoryEntry[];
  error: string | null;
}

const IDLE: LookupView = { status: "idle", results: [], error: null };

/**
 * What the picker shows for the search in the box. Until the answer for
 * `key` arrives it stays `loading` over the previous results, so typing does
 * not blank the list between keystrokes.
 */
function deriveLookup(
  active: boolean,
  key: string,
  lookup: Lookup | null,
): LookupView {
  if (!active) return IDLE;
  if (lookup === null || lookup.key !== key) {
    return { status: "loading", results: lookup?.results ?? [], error: null };
  }
  return { status: lookup.status, results: lookup.results, error: lookup.error };
}

/**
 * Searches the member directory as the lead types. An answer that arrives
 * after a newer search began is dropped, so a slow response can never
 * replace the results for what is in the box now.
 */
function useDirectoryLookup(active: boolean, groupId: string, term: string) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const key = `${groupId}\u0000${term}`;

  useEffect(() => {
    if (!active) return;
    let stale = false;
    const settle = (next: Omit<Lookup, "key">) => {
      if (!stale) setLookup({ key, ...next });
    };
    const handle = window.setTimeout(() => {
      setLookup((previous) => ({
        key,
        status: "loading",
        results: previous?.results ?? [],
        error: null,
      }));
      groupsRepository
        .eligibleMembers(groupId, term)
        .then((results) => settle({ status: "ready", results, error: null }))
        .catch((cause: unknown) =>
          settle({ status: "error", results: [], error: describeDirectoryError(cause) }),
        );
    }, DIRECTORY_SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(handle);
    };
  }, [active, groupId, key, term]);

  const clear = useCallback(() => setLookup(null), []);
  return { view: deriveLookup(active, key, lookup), clear };
}

function emptyMessageFor(view: LookupView, term: string): string | null {
  return view.status === "ready" && view.results.length === 0
    ? emptyDirectoryMessage(term)
    : null;
}

export interface AddMemberViewModel {
  search: string;
  setSearch: (value: string) => void;
  status: MemberDirectoryStatus;
  results: InternalUserDirectoryEntry[];
  /** Set when the directory answered and nobody matched. */
  emptyMessage: string | null;
  selectedUser: InternalUserDirectoryEntry | null;
  select: (user: InternalUserDirectoryEntry) => void;
  clearSelection: () => void;
  error: string | null;
  canSubmit: boolean;
  submitting: boolean;
  submit: () => Promise<void>;
  close: () => void;
}

/** ViewModel for adding a person to a group from the member directory. */
export function useAddMemberViewModel({
  open,
  groupId,
  onAdded,
  onClose,
}: {
  open: boolean;
  groupId: string;
  onAdded: (member: GroupMember) => void;
  onClose: () => void;
}): AddMemberViewModel {
  const [search, setSearchValue] = useState("");
  const [selectedUser, setSelectedUser] =
    useState<InternalUserDirectoryEntry | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const term = search.trim();
  const { view, clear } = useDirectoryLookup(
    open && selectedUser === null,
    groupId,
    term,
  );

  const close = useCallback(() => {
    setSearchValue("");
    setSelectedUser(null);
    setSubmitError(null);
    clear();
    onClose();
  }, [clear, onClose]);

  const submit = useCallback(async () => {
    if (!selectedUser?.hasAccount || !selectedUser.id) {
      setSubmitError("Select an organization member who has an AlphaCI account.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Everyone joins as a Member; a Lead can promote them afterward.
      const member = await groupsRepository.addMember(groupId, {
        userId: selectedUser.id,
      });
      onAdded(member);
      close();
    } catch (cause) {
      setSubmitError(describeAddMemberError(cause));
    } finally {
      setSubmitting(false);
    }
  }, [close, groupId, onAdded, selectedUser]);

  return {
    search,
    setSearch: (value) => {
      setSelectedUser(null);
      setSubmitError(null);
      setSearchValue(value);
    },
    status: view.status,
    results: view.results,
    emptyMessage: emptyMessageFor(view, term),
    selectedUser,
    select: (user) => {
      if (user.hasAccount) setSelectedUser(user);
    },
    clearSelection: () => {
      setSelectedUser(null);
      setSearchValue("");
    },
    error: submitError ?? view.error,
    canSubmit: selectedUser?.hasAccount === true,
    submitting,
    submit,
    close,
  };
}

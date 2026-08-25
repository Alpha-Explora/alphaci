"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthSessionViewModel } from "./use-auth-session-view-model";

/**
 * Sign out and return to the landing route.
 *
 * A separate hook rather than a method on useAuthSessionViewModel: the session
 * VM is consumed in tests and non-router contexts, and a redirect target is a
 * navigation concern. Composing here keeps both dependencies honest.
 */
export function useSignOutAndRedirect() {
  const router = useRouter();
  const { signOut, isSigningOut } = useAuthSessionViewModel();

  const signOutAndRedirect = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [signOut, router]);

  return { signOutAndRedirect, isSigningOut };
}

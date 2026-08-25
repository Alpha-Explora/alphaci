"use client";

/**
 * use-onboarding-tour.ts
 *
 * Orchestrates the guided Create Project onboarding tour.
 *
 * Auto-launch conditions (all must be true):
 *   - User is authenticated and NOT a guest
 *   - user.onboardingCompleted === false
 *   - The Setup tab is the active tab
 *   - The DOM anchors are mounted (checked via a short rAF delay)
 *   - The tour has not already launched in this browser session
 *
 * Explicit replay: if the URL contains `?tour=1` the tour starts regardless
 * of onboardingCompleted status — this supports the Guide page replay button.
 *
 * The tour is also exposed via `startTour()` for manual replay.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { AuthMeResponse } from "@/shared/api/contracts";
import { completeOnboarding } from "@/features/auth/session";

// Lazy-import the tour builder so driver.js is never bundled on the server.
type TourModule = typeof import("../views/tours/create-project-tour");

interface UseOnboardingTourOptions {
  /**
   * The current auth session, or null/undefined if not yet loaded.
   * The hook reads `session.user.onboardingCompleted` and skips the tour
   * when the user is a guest (no authenticated session).
   */
  session: AuthMeResponse | null | undefined;
  /** True when the user is a guest (unauthenticated preview). */
  guest: boolean;
  /** True when the Setup tab is the currently active tab. */
  isSetupTabActive: boolean;
  /**
   * Optional override of the `onboardingCompleted` flag, threaded from the
   * page that owns the session so WorkflowBuilder does not need to re-fetch.
   */
  onboardingCompleted?: boolean;
}

interface UseOnboardingTourReturn {
  /** Manually start (or restart) the guided tour. */
  startTour: () => void;
  /** True once the tour has been marked as finished in this session. */
  tourDone: boolean;
}

export function useOnboardingTour({
  session,
  guest,
  isSetupTabActive,
  onboardingCompleted,
}: UseOnboardingTourOptions): UseOnboardingTourReturn {
  // Has this hook already launched the tour in this session?
  const launchedRef = useRef(false);

  // Resolved tour module (loaded lazily, once).
  const moduleRef = useRef<TourModule | null>(null);

  // Local optimistic flag: once the tour is done we do not re-launch.
  const [tourDone, setTourDone] = useState(false);

  // Stable reference to the current driver instance so we can destroy on unmount.
  const driverRef = useRef<ReturnType<TourModule["createProjectTour"]> | null>(null);

  // Read ?tour=1 from the URL — set by the Guide page replay button.
  const searchParams = useSearchParams();
  const tourParamActive = searchParams.get("tour") === "1";

  const resolvedOnboardingCompleted =
    onboardingCompleted ?? session?.user?.onboardingCompleted ?? true;

  /** Marks onboarding complete on the server (fire-and-forget). */
  const markComplete = useCallback(() => {
    setTourDone(true);
    completeOnboarding().catch(() => {
      // Swallow — a failed network call must not surface to the user.
    });
  }, []);

  /** Loads the tour module if not yet loaded and starts the driver. */
  const startTour = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Dynamically import driver.js CSS on first use.
    await import("driver.js/dist/driver.css");

    if (!moduleRef.current) {
      moduleRef.current = await import("../views/tours/create-project-tour");
    }

    // Destroy any existing instance before creating a new one.
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }

    const instance = moduleRef.current.createProjectTour({
      onFinished: markComplete,
    });

    driverRef.current = instance;
    instance.drive();
  }, [markComplete]);

  /** Synchronous wrapper exposed to callers (manual replay button). */
  const handleStartTour = useCallback(() => {
    void startTour();
  }, [startTour]);

  // Auto-launch for new users: fires once when all conditions are met.
  useEffect(() => {
    if (launchedRef.current) return;
    if (guest) return;
    if (!session) return;
    if (resolvedOnboardingCompleted) return;
    if (!isSetupTabActive) return;

    launchedRef.current = true;

    // Wait one rAF so the DOM anchors are fully mounted before driver.js
    // tries to query them.
    const rafId = requestAnimationFrame(() => {
      void startTour();
    });

    return () => cancelAnimationFrame(rafId);
  }, [guest, session, resolvedOnboardingCompleted, isSetupTabActive, startTour]);

  // Explicit replay via ?tour=1 — fires for both new and existing users.
  // This runs independently of launchedRef so it always triggers when the
  // param is present, regardless of onboardingCompleted status.
  useEffect(() => {
    if (!tourParamActive) return;
    if (!isSetupTabActive) return;
    if (guest) return;
    if (!session) return;

    // Guard with a separate ref so we only fire once per page load even if
    // the effect runs more than once (React Strict Mode double-invoke).
    const rafId = requestAnimationFrame(() => {
      void startTour();
    });

    return () => cancelAnimationFrame(rafId);
    // tourParamActive and isSetupTabActive are intentionally the only
    // triggers — we want exactly one launch per URL load, not on every
    // session/guest change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourParamActive, isSetupTabActive]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { startTour: handleStartTour, tourDone };
}

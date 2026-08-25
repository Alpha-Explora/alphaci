"use client";

/**
 * use-current-projects-tour.ts
 *
 * Orchestrates the guided Current Projects onboarding tour.
 *
 * Auto-launch conditions (all must be true):
 *   - User is authenticated and NOT a guest
 *   - user.onboardingCompleted === false  (same flag as the setup tour)
 *   - The Current Projects tab is the active tab
 *   - At least one provisioned project exists in the DOM (checked via rAF delay)
 *   - The tour has not already launched in this browser session
 *
 * Explicit replay: if the URL contains `?tour=2` the tour starts regardless
 * of onboardingCompleted status — mirrors the ?tour=1 pattern used by the
 * Create Project tour in use-onboarding-tour.ts.
 *
 * The tour is also exposed via `startTour()` for the manual "Show guide" button.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { AuthMeResponse } from "@/shared/api/contracts";
import { completeOnboarding } from "@/features/auth/session";

// Lazy-import the tour builder so driver.js is never bundled on the server.
type TourModule = typeof import("../views/tours/current-projects-tour");

interface UseCurrentProjectsTourOptions {
  /**
   * The current auth session, or null/undefined if not yet loaded.
   * The hook reads `session.user.onboardingCompleted` and skips the tour
   * when the user is a guest (no authenticated session).
   */
  session: AuthMeResponse | null | undefined;
  /** True when the user is a guest (unauthenticated preview). */
  guest: boolean;
  /** True when the Current Projects tab is the active tab. */
  isCurrentTabActive: boolean;
  /**
   * Optional override of the `onboardingCompleted` flag, threaded from the
   * page that owns the session so WorkflowBuilder does not need to re-fetch.
   */
  onboardingCompleted?: boolean;
}

interface UseCurrentProjectsTourReturn {
  /** Manually start (or restart) the guided tour. */
  startTour: () => void;
  /** True once the tour has been marked as finished in this session. */
  tourDone: boolean;
}

export function useCurrentProjectsTour({
  session,
  guest,
  isCurrentTabActive,
  onboardingCompleted,
}: UseCurrentProjectsTourOptions): UseCurrentProjectsTourReturn {
  // Has this hook already launched the tour in this browser session?
  const launchedRef = useRef(false);

  // Resolved tour module (loaded lazily, once).
  const moduleRef = useRef<TourModule | null>(null);

  // Local optimistic flag: once the tour is done we do not re-launch.
  const [tourDone, setTourDone] = useState(false);

  // Stable reference to the current driver instance so we can destroy on unmount.
  const driverRef = useRef<ReturnType<TourModule["createCurrentProjectsTour"]> | null>(null);

  // Read ?tour=2 from the URL — set by the "Show guide" button on the Current tab.
  // Uses "2" to avoid collision with the setup tour's "?tour=1" param.
  const searchParams = useSearchParams();
  const tourParamActive = searchParams.get("tour") === "2";

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
      moduleRef.current = await import("../views/tours/current-projects-tour");
    }

    // Destroy any existing instance before creating a new one.
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }

    const instance = moduleRef.current.createCurrentProjectsTour({
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
    if (!isCurrentTabActive) return;

    launchedRef.current = true;

    // Wait one rAF so the DOM anchors are fully mounted before driver.js
    // tries to query them.
    const rafId = requestAnimationFrame(() => {
      void startTour();
    });

    return () => cancelAnimationFrame(rafId);
  }, [guest, session, resolvedOnboardingCompleted, isCurrentTabActive, startTour]);

  // Explicit replay via ?tour=2 — fires for both new and existing users.
  // Runs independently of launchedRef so it always triggers when the
  // param is present, regardless of onboardingCompleted status.
  useEffect(() => {
    if (!tourParamActive) return;
    if (!isCurrentTabActive) return;
    if (guest) return;
    if (!session) return;

    // Guard with rAF so DOM anchors are mounted.
    const rafId = requestAnimationFrame(() => {
      void startTour();
    });

    return () => cancelAnimationFrame(rafId);
    // tourParamActive and isCurrentTabActive are intentionally the only
    // triggers — we want exactly one launch per URL load, not on every
    // session/guest change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourParamActive, isCurrentTabActive]);

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

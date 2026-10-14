"use client";

import { useState } from "react";

import {
  DEFAULT_HOSTING_CHOICE,
  effectiveHostingChoice,
  hostingOptions,
  type HostingChoice,
  type HostingOption,
} from "../model/hosting-choice-rules";
import type { OnpremHosting } from "../model/onprem-hosting-rules";

export interface HostingChoiceState {
  /** The choice that applies (a pick that is no longer offered falls back to the default). */
  choice: HostingChoice;
  /** The options the Delivery step shows, on-prem only where the deployment lists it. */
  options: HostingOption[];
  select: (choice: HostingChoice) => void;
}

/**
 * The create wizard's project-wide Hosting choice (see hosting-choice-rules).
 * Vercel / Render by default; on-prem only where `GET /deployment-providers`
 * offers it and the project is a single application.
 */
export function useHostingChoice(input: {
  onprem: OnpremHosting;
  isDualShape: boolean;
}): HostingChoiceState {
  const [picked, setPicked] = useState<HostingChoice>(DEFAULT_HOSTING_CHOICE);
  const options = hostingOptions(input);
  return {
    choice: effectiveHostingChoice(picked, options),
    options,
    select: setPicked,
  };
}

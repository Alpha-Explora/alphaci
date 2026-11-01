"use client";

import { useState } from "react";

import {
  DEFAULT_HOSTING_CHOICE,
  effectiveHostingChoice,
  hostingOptions,
  onpremSlotsForLayout,
  type HostingChoice,
  type HostingOption,
  type ServiceLayout,
} from "../model/hosting-choice-rules";
import type { OnpremHosting } from "../model/onprem-hosting-rules";
import type { HostSlot, SlotRuntimes } from "../model/setup-host-assignment-rules";

export interface HostingChoiceState {
  /** The choice that applies (a pick that is no longer offered falls back to the default). */
  choice: HostingChoice;
  /** The options the Delivery step shows, on-prem only where the deployment lists it. */
  options: HostingOption[];
  select: (choice: HostingChoice) => void;
  /** How the project's code is laid out: one application, or two repositories, or two services in one. */
  layout: ServiceLayout;
  /** The slots each environment's on-prem host runs: one, or backend and frontend. */
  onpremSlots: HostSlot[];
  /** Each slot's container port and health path, from the catalog's scaffold contracts. */
  onpremRuntimes: SlotRuntimes;
}

/**
 * The create wizard's project-wide Hosting choice (see hosting-choice-rules).
 * Vercel / Render by default; on-prem only where `GET /deployment-providers`
 * offers it and the project is a single application or two repositories.
 */
export function useHostingChoice(input: {
  onprem: OnpremHosting;
  layout: ServiceLayout;
  selectedProjectKind: "frontend" | "backend";
  onpremRuntimes: SlotRuntimes;
}): HostingChoiceState {
  const [picked, setPicked] = useState<HostingChoice>(DEFAULT_HOSTING_CHOICE);
  const options = hostingOptions({ onprem: input.onprem, layout: input.layout });
  return {
    choice: effectiveHostingChoice(picked, options),
    options,
    select: setPicked,
    layout: input.layout,
    onpremSlots: onpremSlotsForLayout(input.layout, input.selectedProjectKind),
    onpremRuntimes: input.onpremRuntimes,
  };
}

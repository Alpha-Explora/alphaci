"use client";

import { useEffect, useState } from "react";

import { deploymentProvidersRepository } from "../data/deployment-providers-repository";
import {
  onpremHostingFrom,
  type OnpremHosting,
} from "../model/onprem-hosting-rules";

/**
 * Whether the create wizard offers "On-prem host" (see OnpremHosting).
 *
 * Read once, the first time the wizard is active. Until the answer arrives,
 * and when the read fails, the status is "hidden": the wizard is exactly as it
 * was before on-prem existed, never a choice the backend would refuse.
 */
export function useOnpremHosting(options: {
  /** A guest creates nothing, so nothing is read. */
  guest: boolean;
  /** Whether the create wizard is showing. */
  open: boolean;
}): OnpremHosting {
  const active = options.open && !options.guest;
  const [hosting, setHosting] = useState<OnpremHosting | null>(null);
  const loaded = hosting !== null;

  useEffect(() => {
    if (!active || loaded) return;
    let current = true;
    deploymentProvidersRepository
      .list()
      .then((providers) => {
        if (current) setHosting(onpremHostingFrom(providers));
      })
      .catch(() => {
        if (current) setHosting({ status: "hidden" });
      });
    return () => {
      current = false;
    };
  }, [active, loaded]);

  return hosting ?? { status: "hidden" };
}

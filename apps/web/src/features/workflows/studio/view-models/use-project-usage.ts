"use client";

import { useEffect, useState } from "react";

import type { UsageLimitItem } from "@/shared/api/contracts";
import { getMyUsage } from "@/features/projects";

export function useProjectUsage(): UsageLimitItem[] {
  const [usageItems, setUsageItems] = useState<UsageLimitItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getMyUsage()
      .then((usage) => {
        if (!cancelled && usage.enabled) {
          setUsageItems(usage.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsageItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return usageItems;
}

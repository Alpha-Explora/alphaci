"use client";

import {
  customResolutionChoice,
  resolveResolution,
  type DevicePresetId,
  type Resolution,
} from "../../model/qa-studio-rules";
import { useRememberedChoice } from "./use-remembered-flag";

export const STUDIO_RESOLUTION_KEYS: Readonly<Record<DevicePresetId, string>> = {
  desktop: "alphaci.qa-studio.resolution.desktop",
  tablet: "alphaci.qa-studio.resolution.tablet",
  mobile: "alphaci.qa-studio.resolution.mobile",
};

export interface StudioResolutionState {
  /** The size the selected device class is viewed at (portrait for rotatable classes). */
  resolution: Resolution;
  /** A preset id, or a storable custom choice. Anything unknown falls back to the class's default. */
  chooseResolution: (choice: string) => void;
  /** A typed size. Out of range falls back to the default, so callers validate first. */
  chooseCustomResolution: (width: number, height: number) => void;
}

/**
 * The studio's resolution, remembered per viewer AND per device class: a tester
 * who views Desktop at 1920 × 1080 and Mobile on an iPhone 14 finds both as they
 * left them. Three fixed hooks (a hook cannot be called in a loop), one read.
 * Like the layout, it only restyles the frame: the page under test is never
 * re-mounted to change it.
 */
export function useStudioResolution(deviceId: DevicePresetId): StudioResolutionState {
  const [desktop, setDesktop] = useRememberedChoice(STUDIO_RESOLUTION_KEYS.desktop, (stored) =>
    resolveResolution("desktop", stored).choice,
  );
  const [tablet, setTablet] = useRememberedChoice(STUDIO_RESOLUTION_KEYS.tablet, (stored) =>
    resolveResolution("tablet", stored).choice,
  );
  const [mobile, setMobile] = useRememberedChoice(STUDIO_RESOLUTION_KEYS.mobile, (stored) =>
    resolveResolution("mobile", stored).choice,
  );
  const choices = { desktop, tablet, mobile };
  const setters = { desktop: setDesktop, tablet: setTablet, mobile: setMobile };

  function chooseResolution(choice: string) {
    setters[deviceId](resolveResolution(deviceId, choice).choice);
  }

  return {
    resolution: resolveResolution(deviceId, choices[deviceId]),
    chooseResolution,
    chooseCustomResolution: (width, height) => chooseResolution(customResolutionChoice(width, height)),
  };
}

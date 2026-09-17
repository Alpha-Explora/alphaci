interface DevQuickLoginEligibilityInput {
  nodeEnv: string | undefined;
  featureFlag: string | undefined;
  browserOrigin: string | null;
  apiBaseUrl: string;
  apiBaseUrlConfigured: boolean;
}

/**
 * Returns true only for an explicitly enabled local development build whose
 * browser and API both resolve to HTTP loopback origins. The backend applies
 * an independent guard as well.
 */
export function canUseDevQuickLogin({
  nodeEnv,
  featureFlag,
  browserOrigin,
  apiBaseUrl,
  apiBaseUrlConfigured,
}: DevQuickLoginEligibilityInput): boolean {
  return (
    nodeEnv === "development" &&
    featureFlag === "true" &&
    browserOrigin !== null &&
    isLoopbackHttpOrigin(browserOrigin) &&
    apiBaseUrlConfigured &&
    isLoopbackHttpTarget(apiBaseUrl)
  );
}

export function isLoopbackHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      !url.username &&
      !url.password &&
      !url.pathname.replace(/\/$/, "") &&
      !url.search &&
      !url.hash &&
      isLoopbackHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isLoopbackHttpTarget(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      isLoopbackHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isLoopbackHostname(value: string): boolean {
  const hostname = value.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname === "::1") return true;

  const octets = hostname.split(".");
  if (octets.length !== 4 || !octets.every((octet) => /^\d+$/.test(octet))) {
    return false;
  }

  const numbers = octets.map(Number);
  return (
    numbers[0] === 127 &&
    numbers.every((octet) => octet >= 0 && octet <= 255)
  );
}

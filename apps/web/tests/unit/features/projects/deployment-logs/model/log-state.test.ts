import {
  applyAppend,
  applyRateLimited,
  applySnapshot,
  initialLogState,
} from "../../../../../../src/features/projects/deployment-logs/model/log-state";
import {
  cooldownEnd,
  DEFAULT_RETRY_AFTER_MS,
  isRateLimitReason,
  rateLimitNotice,
  secondsUntil,
} from "../../../../../../src/features/projects/deployment-logs/model/log-rate-limit";
import { line, page } from "../log-fixtures";

const KEY = "k";

function seeded() {
  return applySnapshot(initialLogState(KEY), KEY, page([line("a", 1), line("b", 2)]), 0);
}

describe("rate-limit state", () => {
  it("keeps the lines and the live source while rate limited", () => {
    const limited = applyRateLimited(seeded(), KEY, 30_000, 1_000);
    expect(limited.rateLimitedUntil).toBe(31_000);
    expect(limited.buffer.lines.map((l) => l.id)).toEqual(["a", "b"]);
    expect(limited.received).toBe(true);
    expect(limited.source).toBe("live");
    expect(limited.error).toBeNull();
  });

  it("falls back to the default cooldown when the wait was not sent", () => {
    expect(applyRateLimited(seeded(), KEY, undefined, 1_000).rateLimitedUntil).toBe(
      1_000 + DEFAULT_RETRY_AFTER_MS,
    );
  });

  it("clears on the next append", () => {
    const limited = applyRateLimited(seeded(), KEY, 30_000, 0);
    const next = applyAppend(limited, KEY, "live", [line("c", 3)]);
    expect(next.rateLimitedUntil).toBeNull();
    expect(next.buffer.lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("clears on the next snapshot, and a legacy rate-limited one keeps the lines", () => {
    const limited = applyRateLimited(seeded(), KEY, 30_000, 0);
    expect(applySnapshot(limited, KEY, page([line("c", 3)]), 5).rateLimitedUntil).toBeNull();

    const legacy = applySnapshot(seeded(), KEY, page([], { rateLimited: true, retryAfterMs: 10_000 }), 100);
    expect(legacy.rateLimitedUntil).toBe(10_100);
    expect(legacy.buffer.lines.map((l) => l.id)).toEqual(["a", "b"]);
    expect(legacy.source).toBe("live");
  });
});

describe("rate-limit helpers", () => {
  it("recognises a raw provider 429 reason", () => {
    expect(isRateLimitReason('Render logs could not be loaded: 429 {"message": "rate limit exceeded"}')).toBe(true);
    expect(isRateLimitReason("Rate-limited by host")).toBe(true);
    expect(isRateLimitReason("Render returned 503")).toBe(false);
    expect(isRateLimitReason("took 4290ms")).toBe(false);
    expect(isRateLimitReason(null)).toBe(false);
  });

  it("counts whole seconds up, never below zero", () => {
    expect(cooldownEnd(1000, 2500)).toBe(3500);
    expect(secondsUntil(3500, 1000)).toBe(3);
    expect(secondsUntil(3500, 9000)).toBe(0);
  });

  it("words the notice for the provider and for no seconds left", () => {
    expect(rateLimitNotice("Render", 42)).toBe("Render is limiting log reads · retrying in 42s");
    expect(rateLimitNotice("The host", 0)).toBe("The host is limiting log reads · retrying now");
  });
});

import {
  formatLogDateTime,
  formatLogTime,
  instanceTag,
  rangeOptions,
  rangeWindow,
  stripAnsi,
  timeZoneAbbreviation,
} from "../../../../../../src/features/projects/deployment-logs/model/log-format";

const AT = "2026-09-24T10:03:07.000Z";

describe("log time formatting", () => {
  it("formats in the viewer's timezone, 24-hour", () => {
    expect(formatLogTime(AT, { timeZone: "Asia/Manila", locale: "en-US" })).toBe("18:03:07");
    expect(formatLogTime(AT, { timeZone: "America/New_York", locale: "en-US" })).toBe("06:03:07");
    expect(formatLogTime(AT, { timeZone: "UTC", locale: "en-US" })).toBe("10:03:07");
  });

  it("returns an unparseable timestamp as it came", () => {
    expect(formatLogTime("not a time")).toBe("not a time");
    expect(formatLogDateTime("not a time")).toBe("not a time");
  });

  it("names the timezone from Intl rather than a fixed offset", () => {
    const at = new Date(AT);
    expect(timeZoneAbbreviation(at, { timeZone: "Asia/Manila", locale: "en-US" })).toMatch(/GMT\+8|PHT|PST/);
    expect(timeZoneAbbreviation(at, { timeZone: "America/New_York", locale: "en-US" })).toBe("EDT");
    expect(timeZoneAbbreviation(at, { timeZone: "UTC", locale: "en-US" })).toBe("UTC");
  });

  it("includes the date and zone in the full form", () => {
    const full = formatLogDateTime(AT, { timeZone: "UTC", locale: "en-US" });
    expect(full).toContain("2026");
    expect(full).toContain("UTC");
  });
});

describe("line display", () => {
  it("keeps the part of an instance name that tells replicas apart", () => {
    expect(instanceTag("srv-d1abc-5d8f9c7b6-x2k4j")).toBe("x2k4j");
    expect(instanceTag("web")).toBe("web");
    expect(instanceTag(null)).toBeNull();
  });

  it("strips terminal colour codes from a message", () => {
    const esc = String.fromCharCode(27);
    expect(stripAnsi(`${esc}[32m==> Build successful${esc}[0m`)).toBe("==> Build successful");
    expect(stripAnsi("plain")).toBe("plain");
  });
});

describe("time range presets", () => {
  const now = Date.parse("2026-09-24T12:00:00.000Z");
  const deploy = { startTime: "2026-09-24T11:30:00.000Z", endTime: null };

  it("measures relative presets back from now, open-ended", () => {
    expect(rangeWindow("15m", now, deploy)).toEqual({
      startTime: "2026-09-24T11:45:00.000Z",
      endTime: null,
    });
    expect(rangeWindow("7d", now, null)?.startTime).toBe("2026-09-17T12:00:00.000Z");
  });

  it("scopes 'This deploy' to the deploy's window, and offers it only when there is one", () => {
    expect(rangeWindow("deploy", now, deploy)).toBe(deploy);
    expect(rangeWindow("deploy", now, null)).toBeNull();
    expect(rangeOptions(deploy)[0]?.value).toBe("deploy");
    expect(rangeOptions(null).some((option) => option.value === "deploy")).toBe(false);
  });
});

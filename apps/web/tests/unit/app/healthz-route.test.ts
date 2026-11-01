/**
 * @jest-environment node
 */

import { GET } from "@/app/healthz/route";

describe("GET /healthz", () => {
  it("answers 200 with a JSON ok status and no-store caching", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

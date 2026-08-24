import {
  getPendingAccount,
  restoreAccount,
  startFreshAccount,
} from "../support/api-client";

describe("account archive/restore API client", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  describe("getPendingAccount", () => {
    it("returns pending: true with account details when an archived account is awaiting choice", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          pending: true,
          login: "octocat",
          archivedAt: "2026-05-01T00:00:00.000Z",
          purgeAt: "2026-05-31T00:00:00.000Z",
          retentionDays: 30,
        }),
      });

      const result = await getPendingAccount();

      expect(result).toEqual({
        pending: true,
        login: "octocat",
        archivedAt: "2026-05-01T00:00:00.000Z",
        purgeAt: "2026-05-31T00:00:00.000Z",
        retentionDays: 30,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/auth/account/pending",
        expect.objectContaining({ credentials: "include" }),
      );
    });

    it("returns pending: false when no archived account is awaiting choice", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ pending: false }),
      });

      const result = await getPendingAccount();

      expect(result).toEqual({ pending: false });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/auth/account/pending",
        expect.any(Object),
      );
    });
  });

  describe("restoreAccount", () => {
    it("sends a POST to the restore endpoint and returns ok + restored", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, restored: true }),
      });

      const result = await restoreAccount();

      expect(result).toEqual({ ok: true, restored: true });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/auth/account/restore",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });

    it("throws ApiError when the backend rejects the restore", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: "Account not archived" }),
      });

      const { ApiError } = await import("../support/api-client");
      await expect(restoreAccount()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("startFreshAccount", () => {
    it("sends a POST to the start-fresh endpoint and returns ok + created", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ ok: true, created: true }),
      });

      const result = await startFreshAccount();

      expect(result).toEqual({ ok: true, created: true });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/auth/account/start-fresh",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });

    it("throws ApiError when the backend rejects the start-fresh request", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "No pending account found" }),
      });

      const { ApiError } = await import("../support/api-client");
      await expect(startFreshAccount()).rejects.toBeInstanceOf(ApiError);
    });
  });
});

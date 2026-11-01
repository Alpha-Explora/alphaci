import { devQuickLogin } from "../../../../../../src/features/auth/session/data/auth-api";
import { request } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/shared/api/request", () => ({
  request: jest.fn(),
  getApiBaseUrl: jest.fn(() => "http://localhost:4000/api/v1"),
}));

const mockRequest = request as jest.MockedFunction<typeof request>;

describe("devQuickLogin", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ ok: true });
  });

  it("uses the normal credentialed request path without a fixture selector", async () => {
    await devQuickLogin();

    expect(mockRequest).toHaveBeenCalledWith("/auth/dev/quick-login", {
      method: "POST",
    });
  });
});

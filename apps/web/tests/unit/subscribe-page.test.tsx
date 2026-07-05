import SubscribePage from "../../src/app/subscribe/page";

const redirectMock = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

describe("SubscribePage", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects legacy subscription links to the workspace", () => {
    SubscribePage();

    expect(redirectMock).toHaveBeenCalledWith("/home");
  });
});

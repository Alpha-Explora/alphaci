import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CloneCard } from "../../../../../../src/features/projects/detail/views/clone-card";

describe("CloneCard", () => {
  let container: HTMLDivElement;
  let root: Root;
  const writeText = jest.fn<Promise<void>, [string]>();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const input = () => container.querySelector<HTMLInputElement>(".clone-card__input")!;
  const tab = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((el) => el.textContent === label)!;

  it("starts on HTTPS with the web URL, and no hint line under it", () => {
    act(() => root.render(<CloneCard repoFullName="Alphaexplora-Sandbox/logistics2cicd-fe" />));
    expect(container.textContent).toContain("Clone");
    expect(tab("HTTPS").getAttribute("aria-selected")).toBe("true");
    expect(input().value).toBe("https://github.com/Alphaexplora-Sandbox/logistics2cicd-fe.git");
    expect(input().readOnly).toBe(true);
    expect(container.textContent).not.toContain("Clone using the web URL.");
  });

  it("switches to SSH and GitHub CLI by click and by arrow keys", () => {
    act(() => root.render(<CloneCard repoFullName="acme/api" />));
    act(() => tab("SSH").click());
    expect(input().value).toBe("git@github.com:acme/api.git");
    expect(tab("SSH").getAttribute("aria-selected")).toBe("true");

    act(() => {
      tab("SSH").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab("GitHub CLI").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("GitHub CLI"));
    expect(input().value).toBe("gh repo clone acme/api");

    act(() => {
      tab("GitHub CLI").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(tab("HTTPS").getAttribute("aria-selected")).toBe("true");
  });

  it("copies the current value and says so", async () => {
    act(() => root.render(<CloneCard repoFullName="acme/api" />));
    const copy = container.querySelector<HTMLButtonElement>(".clone-card__copy")!;
    expect(copy.getAttribute("aria-label")).toBe("Copy URL to clipboard");
    await act(async () => copy.click());
    expect(writeText).toHaveBeenCalledWith("https://github.com/acme/api.git");
    expect(copy.getAttribute("aria-label")).toBe("Copied");
    expect(container.querySelector('[role="status"]')!.textContent).toBe("Copied to clipboard");
  });

  it("renders nothing for a repository name it cannot clone", () => {
    act(() => root.render(<CloneCard repoFullName="not-owner-slash-repo" />));
    expect(container.querySelector(".clone-card")).toBeNull();
  });
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDomainsView } from "../../../../../src/features/projects/domains";
import type { CustomDomain } from "../../../../../src/lib/api/contracts";

function domain(overrides: Partial<CustomDomain> = {}): CustomDomain {
  return {
    id: "domain-1",
    projectId: "project-1",
    deploymentTargetId: "target-1",
    provider: "vercel",
    hostname: "app.example.com",
    apexDomain: "example.com",
    gitBranch: null,
    verified: false,
    verification: [
      { type: "TXT", domain: "_vercel.example.com", value: "abc123", reason: "ns" },
    ],
    misconfigured: null,
    lastCheckedAt: null,
    lastErrorSafeMessage: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

const TARGETS = [{ id: "target-1", label: "Vercel · web-app" }];

describe("ProjectDomainsView", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
  });

  function render(node: React.ReactElement) {
    act(() => {
      root = createRoot(container);
      root.render(node);
    });
  }

  const noop = () => {};
  const noopAdd = async () => true;

  /* The record is pasted into a DNS console character-for-character, so it has
   * to appear exactly as the provider gave it. */
  it("shows the provider's DNS record verbatim", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain()]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("TXT");
    expect(container.textContent).toContain("_vercel.example.com");
    expect(container.textContent).toContain("abc123");
  });

  it("tells the reader to add the record while unverified", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain()]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("Add the record below");
  });

  it("does not call a verified-but-unpointed domain live", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain({ verified: true, misconfigured: true, verification: [] })]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("DNS not pointed here");
    expect(container.textContent).not.toContain("Live");
  });

  it("marks a fully working domain live", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain({ verified: true, misconfigured: false, verification: [] })]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("Live");
  });

  it("names the branch a hostname serves", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain({ gitBranch: "feat/checkout" })]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("branch: feat/checkout");
  });

  /* A domain attaches to a deployment target, so offering the form without one
   * would let someone fill it in only to be rejected. */
  it("explains that hosting is needed before a domain can be added", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={[]}
      />,
    );

    expect(container.textContent).toContain("Add a hosting service first");
    expect(container.querySelector("form")).toBeNull();
  });

  it("requires a confirmation before removing", () => {
    const onRemove = jest.fn();
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[domain()]}
        error={null}
        isAdding={false}
        onAdd={noopAdd}
        onRemove={onRemove}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent === "Remove")!
        .click();
    });
    expect(onRemove).not.toHaveBeenCalled();

    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent === "Yes, remove")!
        .click();
    });
    expect(onRemove).toHaveBeenCalledWith("domain-1");
  });

  it("surfaces the error message", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        domains={[]}
        error="app.example.com is already assigned to a Vercel project."
        isAdding={false}
        onAdd={noopAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    expect(container.textContent).toContain("already assigned");
  });
});

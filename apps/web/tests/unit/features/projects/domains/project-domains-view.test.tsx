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
        canManage
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
        canManage
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
        canManage
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
        canManage
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
        canManage
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
        canManage
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
        canManage
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
        canManage
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

  it("hides the add form and row actions for a viewer who cannot manage, keeping the list", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        canManage={false}
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

    expect(container.querySelector("form")).toBeNull();
    const labels = Array.from(container.querySelectorAll("button")).map(
      (b) => b.textContent,
    );
    expect(labels).not.toContain("Remove");
    expect(labels).not.toContain("Check again");
    expect(container.textContent).toContain("app.example.com");
    expect(container.textContent).toContain("Developers and admins can change hosting");
  });

  it("shows the add form and row actions when the viewer can manage", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        canManage
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

    expect(container.querySelector("form")).not.toBeNull();
    const labels = Array.from(container.querySelectorAll("button")).map(
      (b) => b.textContent,
    );
    expect(labels).toContain("Remove");
    expect(labels).toContain("Check again");
  });

  /* The Hosting tab: the list first, the form behind "+ Add domain". */
  it("keeps the add form behind + Add domain when asked to, after the list", () => {
    const onAdd = jest.fn(async () => true);
    render(
      <ProjectDomainsView
        busyDomainId={null}
        canManage
        collapseAddForm
        domains={[domain()]}
        error={null}
        isAdding={false}
        onAdd={onAdd}
        onRemove={noop}
        onVerify={noop}
        status="ready"
        targets={TARGETS}
      />,
    );

    const button = (label: string) =>
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);
    expect(container.querySelector("form")).toBeNull();
    const open = button("+ Add domain")!;
    expect(container.querySelector(".project-domain")!.compareDocumentPosition(open)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    act(() => open.click());
    expect(container.querySelector("form")).not.toBeNull();
    act(() => button("Cancel")!.click());
    expect(container.querySelector("form")).toBeNull();
    expect(button("+ Add domain")).toBeDefined();
  });

  it("offers no + Add domain to a viewer who cannot manage, and can leave the note to the host", () => {
    render(
      <ProjectDomainsView
        busyDomainId={null}
        canManage={false}
        collapseAddForm
        showReadOnlyNote={false}
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

    expect(container.textContent).not.toContain("+ Add domain");
    expect(container.textContent).not.toContain("Developers and admins can change hosting");
    expect(container.textContent).toContain("app.example.com");
  });
});

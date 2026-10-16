import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { useHostsViewModel } from "../view-models/use-hosts-view-model";
import { EnrollmentCard } from "./host-cards";

type Vm = ReturnType<typeof useHostsViewModel>;

const code = "Qz9_-".repeat(8) + "Qz9";
let root: Root;
let container: HTMLDivElement;

function vmWith(overrides: Partial<Vm> = {}): Vm {
  return {
    receipt: {
      apiUrl: "https://api.example.com",
      id: "e",
      code,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      installer: {
        version: "0.1.0",
        url: "https://download.example.com/agent.tar.gz",
        sha256: "a".repeat(64),
      },
    },
    enrolled: { name: "Office", platform: "ubuntu" },
    progress: "waiting",
    now: Date.now(),
    downloadInstallFile: jest.fn(),
    dismiss: jest.fn(),
    ...overrides,
  } as unknown as Vm;
}

function buttonNamed(label: string) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === label,
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("offers the install file beside the copy-paste command, and keeps the command and code", () => {
  const vm = vmWith();
  act(() => root.render(<EnrollmentCard vm={vm} />));

  act(() => buttonNamed("Download install file")!.click());
  expect(vm.downloadInstallFile).toHaveBeenCalledTimes(1);

  expect(container.querySelector(".hosts-code pre")?.textContent).toContain(
    "install.sh",
  );
  expect(
    container.querySelector(".hosts-code--secret pre")?.textContent,
  ).toBe(code);
});

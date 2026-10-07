import {
  defaultRepoForFolder,
  hasRepoSwitch,
  manageProjectHref,
  nextEnabledIndex,
  normaliseProjectFolder,
  repoShortName,
  repoSwitchOptions,
  repoSwitchPresentation,
  roleLabel,
  SINGLE_REPO_PRESENTATION,
  switchHref,
} from "../../../../../../src/features/projects/detail/model/project-folder-rules";
import type { ProjectDetailTab } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type {
  ProjectFolderRepository,
  ProjectFolderSummary,
} from "../../../../../../src/features/projects/detail/model/project-folder-types";

function repo(overrides: Partial<ProjectFolderRepository> = {}): ProjectFolderRepository {
  return {
    projectId: "proj-fe",
    name: "shop-frontend",
    repoFullName: "Org/shop-fe",
    role: "frontend",
    status: "provisioned",
    ...overrides,
  };
}

function folder(overrides: Partial<ProjectFolderSummary> = {}): ProjectFolderSummary {
  return {
    deliveryProjectId: "dp-1",
    groupId: "ws-1",
    name: "shop",
    repositories: [
      repo(),
      repo({ projectId: "proj-be", name: "shop-backend", repoFullName: "Org/shop-be", role: "backend" }),
    ],
    ...overrides,
  };
}

const ALL_TABS: ProjectDetailTab[] = ["overview", "code", "runs", "hosting", "environment", "qa", "settings"];

describe("normaliseProjectFolder", () => {
  it("reads the wire shape", () => {
    expect(
      normaliseProjectFolder({
        deliveryProjectId: "dp-1",
        groupId: "ws-1",
        name: " shop ",
        repositories: [
          { projectId: "proj-fe", name: "shop-frontend", repoFullName: "Org/shop-fe", role: "frontend", status: "provisioned" },
        ],
      }),
    ).toEqual({
      deliveryProjectId: "dp-1",
      groupId: "ws-1",
      name: "shop",
      repositories: [repo()],
    });
  });

  it("returns null for anything that is not a folder", () => {
    expect(normaliseProjectFolder(null)).toBeNull();
    expect(normaliseProjectFolder("nope")).toBeNull();
    expect(normaliseProjectFolder([])).toBeNull();
    expect(normaliseProjectFolder({ name: "shop" })).toBeNull();
  });

  it("keeps role order, frontend first, unknown roles last, stable within a role", () => {
    const result = normaliseProjectFolder({
      name: "shop",
      repositories: [
        { projectId: "a", name: "app-1", role: "app" },
        { projectId: "b", name: "mystery", role: "database" },
        { projectId: "c", name: "svc", role: "service" },
        { projectId: "d", name: "api", role: "backend" },
        { projectId: "e", name: "web", role: "frontend" },
        { projectId: "f", name: "app-2", role: "app" },
      ],
    });
    expect(result?.repositories.map((entry) => entry.name)).toEqual(["web", "api", "svc", "app-1", "app-2", "mystery"]);
    expect(result?.repositories.at(-1)?.role).toBeNull();
  });

  it("degrades malformed fields to safe defaults and drops unusable rows", () => {
    const result = normaliseProjectFolder({
      deliveryProjectId: 7,
      groupId: "",
      name: 42,
      repositories: [
        null,
        { name: "" },
        { repoFullName: "Org/only-full-name", projectId: "", status: 3 },
        { name: "unlinked", projectId: null },
      ],
    });
    expect(result).toEqual({
      deliveryProjectId: null,
      groupId: null,
      name: "",
      repositories: [
        { projectId: null, name: "Org/only-full-name", repoFullName: "Org/only-full-name", role: null, status: null },
        { projectId: null, name: "unlinked", repoFullName: null, role: null, status: null },
      ],
    });
  });
});

describe("roleLabel", () => {
  it("labels every role, and an unknown one as REPO", () => {
    expect(roleLabel("frontend")).toBe("FRONTEND");
    expect(roleLabel("backend")).toBe("BACKEND");
    expect(roleLabel("service")).toBe("SERVICE");
    expect(roleLabel("app")).toBe("APP");
    expect(roleLabel(null)).toBe("REPO");
    expect(roleLabel(undefined)).toBe("REPO");
  });
});

describe("repoShortName", () => {
  it("drops the owner, or falls back to the name", () => {
    expect(repoShortName({ name: "x", repoFullName: "Org/shop-fe" })).toBe("shop-fe");
    expect(repoShortName({ name: "x", repoFullName: null })).toBe("x");
    expect(repoShortName({ name: "x", repoFullName: "Org/" })).toBe("Org/");
  });
});

describe("defaultRepoForFolder", () => {
  it("opens on the linked frontend", () => {
    const shop = folder({
      repositories: [
        repo({ projectId: "proj-be", role: "backend" }),
        repo({ projectId: "proj-fe", role: "frontend" }),
      ],
    });
    expect(defaultRepoForFolder(shop)?.projectId).toBe("proj-fe");
  });

  it("skips an unlinked frontend for the first linked repository", () => {
    const shop = folder({
      repositories: [
        repo({ projectId: null, role: "frontend" }),
        repo({ projectId: "proj-svc", role: "service" }),
        repo({ projectId: "proj-be", role: "backend" }),
      ],
    });
    expect(defaultRepoForFolder(shop)?.projectId).toBe("proj-svc");
  });

  it("is null when nothing is linked, or there is no folder", () => {
    expect(defaultRepoForFolder(folder({ repositories: [repo({ projectId: null })] }))).toBeNull();
    expect(defaultRepoForFolder(folder({ repositories: [] }))).toBeNull();
    expect(defaultRepoForFolder(null)).toBeNull();
  });
});

describe("hasRepoSwitch", () => {
  it("needs two or more repositories", () => {
    expect(hasRepoSwitch(folder())).toBe(true);
    expect(hasRepoSwitch(folder({ repositories: [repo()] }))).toBe(false);
    expect(hasRepoSwitch(null)).toBe(false);
    expect(hasRepoSwitch(undefined)).toBe(false);
  });
});

describe("repoSwitchOptions", () => {
  it("marks the page on screen and disables the unlinked", () => {
    const shop = folder({
      repositories: [
        repo(),
        repo({ projectId: "proj-be", repoFullName: "Org/shop-be", role: "backend" }),
        repo({ projectId: null, name: "shop-worker", repoFullName: null, role: null }),
      ],
    });
    expect(repoSwitchOptions(shop, "proj-be")).toEqual([
      { key: "proj-fe", projectId: "proj-fe", role: "frontend", roleLabel: "FRONTEND", label: "shop-fe", repoFullName: "Org/shop-fe", current: false, disabled: false },
      { key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be", repoFullName: "Org/shop-be", current: true, disabled: false },
      { key: "repo:shop-worker", projectId: null, role: null, roleLabel: "REPO", label: "shop-worker", repoFullName: null, current: false, disabled: true },
    ]);
  });

  it("never marks an unlinked repository current", () => {
    const shop = folder({ repositories: [repo({ projectId: null }), repo({ projectId: null, name: "b" })] });
    expect(repoSwitchOptions(shop, "").some((option) => option.current)).toBe(false);
  });
});

describe("switchHref", () => {
  it("keeps the tab the viewer is on", () => {
    expect(switchHref("proj-be", "#hosting", ALL_TABS)).toBe("/projects/proj-be#hosting");
    expect(switchHref("proj-be", "settings", ALL_TABS)).toBe("/projects/proj-be#settings");
  });

  it("falls back to Overview for a hidden, unknown or empty tab", () => {
    expect(switchHref("proj-be", "#qa", ["overview", "code"])).toBe("/projects/proj-be#overview");
    expect(switchHref("proj-be", "#nope", ALL_TABS)).toBe("/projects/proj-be#overview");
    expect(switchHref("proj-be", "", ALL_TABS)).toBe("/projects/proj-be#overview");
    expect(switchHref("proj-be", null, ALL_TABS)).toBe("/projects/proj-be#overview");
  });

  it("encodes the project id", () => {
    expect(switchHref("a/b c", "#code", ALL_TABS)).toBe("/projects/a%2Fb%20c#code");
  });
});

describe("manageProjectHref", () => {
  it("links the Projects page opened on the Project, with its team", () => {
    expect(manageProjectHref(folder())).toBe("/workflows?group=ws-1&project=dp-1");
  });

  it("encodes the ids", () => {
    expect(manageProjectHref(folder({ groupId: "ws 1", deliveryProjectId: "dp&2" }))).toBe(
      "/workflows?group=ws+1&project=dp%262",
    );
  });

  it("is null without both the team and the Project", () => {
    expect(manageProjectHref(folder({ groupId: null }))).toBeNull();
    expect(manageProjectHref(folder({ deliveryProjectId: null }))).toBeNull();
    expect(manageProjectHref(null)).toBeNull();
  });
});

describe("repoSwitchPresentation", () => {
  it("titles the page with a multi-repository Project", () => {
    const shown = repoSwitchPresentation(folder(), "proj-fe");
    expect(shown.projectName).toBe("shop");
    expect(shown.options.map((option) => option.current)).toEqual([true, false]);
  });

  it("leaves the page as it was for one repository, no folder, or a nameless Project", () => {
    expect(repoSwitchPresentation(folder({ repositories: [repo()] }), "proj-fe")).toBe(SINGLE_REPO_PRESENTATION);
    expect(repoSwitchPresentation(null, "proj-fe")).toBe(SINGLE_REPO_PRESENTATION);
    expect(repoSwitchPresentation(undefined, "proj-fe")).toBe(SINGLE_REPO_PRESENTATION);
    expect(repoSwitchPresentation(folder({ name: "" }), "proj-fe")).toBe(SINGLE_REPO_PRESENTATION);
  });
});

describe("nextEnabledIndex", () => {
  const options = [{ disabled: false }, { disabled: true }, { disabled: false }, { disabled: false }];

  it("steps over disabled options and wraps", () => {
    expect(nextEnabledIndex(options, 0, 1)).toBe(2);
    expect(nextEnabledIndex(options, 3, 1)).toBe(0);
    expect(nextEnabledIndex(options, 0, -1)).toBe(3);
    expect(nextEnabledIndex(options, 2, -1)).toBe(0);
  });

  it("finds the first and last from outside the range (Home / End)", () => {
    expect(nextEnabledIndex(options, -1, 1)).toBe(0);
    expect(nextEnabledIndex(options, options.length, -1)).toBe(3);
  });

  it("stays put when nothing else is enabled", () => {
    expect(nextEnabledIndex([{ disabled: false }, { disabled: true }], 0, 1)).toBe(0);
  });
});

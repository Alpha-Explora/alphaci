import {
  attachPatch,
  attachableChecklists,
  checklistAttachment,
  checklistCountLabel,
  checklistPatchErrorMessage,
  createErrorMessage,
  createRepositoryHref,
  deleteConfirmMatches,
  deleteErrorMessage,
  deleteNoticeText,
  deletePartialFailure,
  detachPatch,
  findFolder,
  folderChecklists,
  folderProjectIds,
  isConflict,
  isDeleteConflict,
  loadErrorMessage,
  moveErrorMessage,
  moveTargets,
  MOVE_CONFLICT_MESSAGE,
  DELETE_NAME_MISMATCH_MESSAGE,
  normaliseChecklist,
  normaliseChecklists,
  normaliseDeleteOutcome,
  normaliseMoveOutcome,
  normaliseProjectFolders,
  projectDashboardHref,
  projectNameError,
  readRole,
  repoDisplayName,
  repoRoleLabel,
  repositoryCountLabel,
  verifyProjectId,
} from "../../../../../../src/features/teams/project-folders/model/project-folder-rules";
import type { ProjectFolder } from "../../../../../../src/features/teams/project-folders/model/project-folder-types";
import { apiError, folderChecklist, foldersSnapshot, foldersWire, GROUP_ID } from "../folder-fixtures";

function pair(): ProjectFolder {
  return foldersSnapshot().folders[0];
}

describe("normaliseProjectFolders", () => {
  it("reads the contract shape, keeping the server's order", () => {
    const snapshot = foldersSnapshot();
    expect(snapshot.groupId).toBe(GROUP_ID);
    expect(snapshot.canManage).toBe(true);
    expect(snapshot.folders.map((folder) => folder.name)).toEqual(["testfinals", "wallet"]);
    expect(snapshot.folders[0].repositories.map((repo) => repo.repositoryId)).toEqual(["repo-fe", "repo-be"]);
    expect(snapshot.folders[1].repositories).toEqual([]);
    expect(snapshot.unfiled[0]).toEqual({
      id: "proj-blaine",
      name: "blaine",
      repoFullName: "Org/blaine",
      role: "app",
      status: "provisioned",
      repoShape: "standalone",
    });
  });

  it("degrades a missing or malformed body to an empty, read-only explorer", () => {
    for (const body of [null, undefined, "nope", [], { folders: "x", unfiled: 3 }]) {
      expect(normaliseProjectFolders(body, "ws-9")).toEqual({
        groupId: "ws-9",
        canManage: false,
        folders: [],
        unfiled: [],
      });
    }
  });

  it("never hands out lead actions unless canManage is exactly true", () => {
    expect(normaliseProjectFolders({ canManage: "true" }, GROUP_ID).canManage).toBe(false);
    expect(normaliseProjectFolders({ canManage: 1 }, GROUP_ID).canManage).toBe(false);
  });

  it("fills defaults for missing fields and drops rows without ids", () => {
    const snapshot = normaliseProjectFolders(
      {
        folders: [
          { name: "no id" },
          {
            deliveryProjectId: "dp-9",
            repositories: [
              { name: "no id" },
              { repositoryId: "r-1", repoFullName: "Org/api", project: { role: "backend" } },
              { repositoryId: "r-2", project: { id: "p-2", role: "mystery" } },
            ],
          },
        ],
        unfiled: [{ name: "no id" }, { id: "p-3" }],
      },
      GROUP_ID,
    );
    expect(snapshot.folders).toHaveLength(1);
    const folder = snapshot.folders[0];
    expect(folder).toMatchObject({ name: "Untitled Project", systemId: "", createdAt: null });
    expect(folder.repositories).toEqual([
      { repositoryId: "r-1", name: "Org/api", repoFullName: "Org/api", status: "unknown", project: null },
      {
        repositoryId: "r-2",
        name: "Unnamed repository",
        repoFullName: null,
        status: "unknown",
        project: { id: "p-2", role: "app", status: "unknown", repoShape: null },
      },
    ]);
    expect(snapshot.unfiled).toEqual([
      { id: "p-3", name: "Unnamed project", repoFullName: null, role: "app", status: "unknown", repoShape: null },
    ]);
  });
});

describe("roles and labels", () => {
  it("labels every role and reads unknown roles as App", () => {
    expect(["frontend", "backend", "service", "app"].map((role) => repoRoleLabel(readRole(role)))).toEqual([
      "Frontend",
      "Backend",
      "Service",
      "App",
    ]);
    expect(readRole("database")).toBe("app");
    expect(readRole(undefined)).toBe("app");
  });

  it("pluralises counts and shortens repository names", () => {
    expect(repositoryCountLabel(1)).toBe("1 repository");
    expect(repositoryCountLabel(0)).toBe("0 repositories");
    expect(checklistCountLabel(1)).toBe("1 checklist");
    expect(checklistCountLabel(2)).toBe("2 checklists");
    expect(repoDisplayName({ name: "x", repoFullName: "Org/testfinals-fe" })).toBe("testfinals-fe");
    expect(repoDisplayName({ name: "local", repoFullName: null })).toBe("local");
  });
});

describe("folder checklists", () => {
  it("collects linked project ids once, skipping unlinked repositories", () => {
    const folder = pair();
    folder.repositories.push({ ...folder.repositories[0], repositoryId: "dup" });
    folder.repositories.push({ repositoryId: "r-x", name: "x", repoFullName: null, status: "active", project: null });
    expect(folderProjectIds(folder)).toEqual(["proj-fe", "proj-be"]);
  });

  it("counts only live checklists that share at least one repository project", () => {
    const folder = pair();
    const checklists = [
      folderChecklist({ id: "all" }),
      folderChecklist({ id: "some", sharedProjectIds: ["proj-be", "elsewhere"] }),
      folderChecklist({ id: "other", sharedProjectIds: ["elsewhere"] }),
      folderChecklist({ id: "archived", archived: true }),
    ];
    expect(folderChecklists(folder, checklists).map((c) => c.id)).toEqual(["all", "some"]);
    expect(folderChecklists(foldersSnapshot().folders[1], checklists)).toEqual([]);
  });

  it("classifies attachment and offers only what is not fully attached", () => {
    const folder = pair();
    const all = folderChecklist({ id: "all" });
    const some = folderChecklist({ id: "some", sharedProjectIds: ["proj-fe"] });
    const none = folderChecklist({ id: "none", sharedProjectIds: [] });
    expect(checklistAttachment(folder, all)).toBe("attached");
    expect(checklistAttachment(folder, some)).toBe("partial");
    expect(checklistAttachment(folder, none)).toBe("none");
    expect(checklistAttachment(foldersSnapshot().folders[1], all)).toBe("none");
    expect(
      attachableChecklists(folder, [all, some, none, folderChecklist({ id: "gone", archived: true, sharedProjectIds: [] })]).map((c) => c.id),
    ).toEqual(["some", "none"]);
  });

  it("builds PATCH bodies with exactly this Project's repository projects", () => {
    expect(attachPatch(pair())).toEqual({ add: ["proj-fe", "proj-be"] });
    expect(detachPatch(pair())).toEqual({ remove: ["proj-fe", "proj-be"] });
  });

  it("normalises team checklists defensively", () => {
    expect(
      normaliseChecklist({ id: "c", name: "", items: [{}, {}], archivedAt: "2026-01-01", sharedProjectIds: ["a", 3] }),
    ).toEqual({ id: "c", name: "Untitled checklist", itemCount: 2, archived: true, sharedProjectIds: ["a"] });
    expect(normaliseChecklist({ name: "no id" })).toBeNull();
    expect(normaliseChecklists("x")).toEqual([]);
    expect(normaliseChecklists([{ id: "a" }, null])).toHaveLength(1);
  });
});

describe("verify, move and links", () => {
  it("verifies the frontend repository, else an app, else nothing", () => {
    expect(verifyProjectId(pair())).toBe("proj-fe");
    const appOnly = foldersSnapshot({
      folders: [
        {
          ...foldersWire().folders[0],
          repositories: [
            { ...foldersWire().folders[0].repositories[1] },
            { repositoryId: "r-app", name: "site", repoFullName: null, status: "active", project: { id: "proj-app", role: "app", status: "provisioned", repoShape: null } },
          ],
        },
      ],
    }).folders[0];
    expect(verifyProjectId(appOnly)).toBe("proj-app");
    const backendOnly = { ...pair(), repositories: [pair().repositories[1]] };
    expect(verifyProjectId(backendOnly)).toBeNull();
  });

  it("offers every other Project as a move target", () => {
    const { folders } = foldersSnapshot();
    expect(moveTargets(folders, "dp-1").map((f) => f.deliveryProjectId)).toEqual(["dp-2"]);
    expect(findFolder(folders, "dp-2")?.name).toBe("wallet");
    expect(findFolder(folders, null)).toBeNull();
    expect(findFolder(folders, "missing")).toBeNull();
  });

  it("links the dashboard and the pre-scoped wizard", () => {
    expect(projectDashboardHref("p 1")).toBe("/projects/p%201");
    expect(createRepositoryHref("ws-1", "dp-1")).toBe("/workflows?tab=setup&group=ws-1&project=dp-1");
    expect(createRepositoryHref("ws-1")).toBe("/workflows?tab=setup&group=ws-1");
  });

  it("reads a move outcome defensively", () => {
    expect(normaliseMoveOutcome({ moved: true, sourceDeliveryProjectId: "dp-1", sourceDeliveryProjectEmpty: true })).toEqual({
      moved: true,
      sourceDeliveryProjectId: "dp-1",
      sourceDeliveryProjectEmpty: true,
    });
    expect(normaliseMoveOutcome(null)).toEqual({ moved: true, sourceDeliveryProjectId: null, sourceDeliveryProjectEmpty: false });
  });
});

describe("validation and errors", () => {
  it("requires a 1-200 character Project name", () => {
    expect(projectNameError("  ")).toMatch(/name/);
    expect(projectNameError("x".repeat(201))).toMatch(/200/);
    expect(projectNameError(" checkout ")).toBeNull();
  });

  it("maps load failures, with a non-member 404 as not available", () => {
    expect(loadErrorMessage(apiError(404))).toBe("This team's Projects are not available.");
    expect(loadErrorMessage(apiError(401))).toMatch(/sign in/);
    expect(loadErrorMessage(apiError(500))).toMatch(/could not be loaded/);
    expect(loadErrorMessage(new Error("offline"))).toMatch(/could not be loaded/);
  });

  it("maps move failures, including the concurrent-move 409", () => {
    expect(moveErrorMessage(apiError(409))).toBe(MOVE_CONFLICT_MESSAGE);
    expect(MOVE_CONFLICT_MESSAGE).toBe("This repository was moved by someone else. Refresh and try again.");
    expect(moveErrorMessage(apiError(404))).toMatch(/no longer exists/);
    expect(moveErrorMessage(apiError(400))).toMatch(/Archived/);
    expect(moveErrorMessage(apiError(503))).toMatch(/could not be moved/);
    expect(isConflict(apiError(409))).toBe(true);
    expect(isConflict(apiError(400))).toBe(false);
  });

  it("maps create and checklist failures", () => {
    expect(createErrorMessage(apiError(403))).toMatch(/Team lead/);
    expect(createErrorMessage(null)).toMatch(/could not be created/);
    expect(checklistPatchErrorMessage(apiError(409))).toMatch(/archived/);
    expect(checklistPatchErrorMessage(apiError(500))).toMatch(/could not be updated/);
  });
});

describe("delete Project", () => {
  it("requires an exact name match to submit", () => {
    expect(deleteConfirmMatches("testfinals", "testfinals")).toBe(true);
    expect(deleteConfirmMatches("Testfinals", "testfinals")).toBe(false);
    expect(deleteConfirmMatches("testfinals ", "testfinals")).toBe(false);
    expect(deleteConfirmMatches("", "testfinals")).toBe(false);
  });

  it("reads the 200 outcome defensively, falling back to the requested id", () => {
    expect(
      normaliseDeleteOutcome(
        {
          deliveryProjectId: "dp-1",
          name: "testfinals",
          deletedRepositories: [
            { repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true },
            { repositoryId: "repo-be", name: "testfinals-be", projectId: null, githubRepoDeleted: false },
          ],
        },
        "dp-1",
      ),
    ).toEqual({
      deliveryProjectId: "dp-1",
      name: "testfinals",
      deletedRepositories: [
        { repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true },
        { repositoryId: "repo-be", name: "testfinals-be", projectId: null, githubRepoDeleted: false },
      ],
    });
    expect(normaliseDeleteOutcome(null, "dp-9")).toEqual({
      deliveryProjectId: "dp-9",
      name: "",
      deletedRepositories: [],
    });
    expect(normaliseDeleteOutcome({ deletedRepositories: [{ name: "no id" }, {}] }, "dp-9").deletedRepositories).toEqual(
      [],
    );
  });

  it("builds the explorer's status notice", () => {
    expect(
      deleteNoticeText({ deliveryProjectId: "dp-1", name: "testfinals", deletedRepositories: [{ repositoryId: "r-1", name: "x", projectId: null, githubRepoDeleted: false }] }),
    ).toBe("Deleted testfinals and 1 repository.");
    expect(deleteNoticeText({ deliveryProjectId: "dp-1", name: "wallet", deletedRepositories: [] })).toBe(
      "Deleted wallet and 0 repositories.",
    );
  });

  it("maps every non-409 delete failure, including the named 400 mismatch code", () => {
    expect(deleteErrorMessage(apiError(400, { code: "DELIVERY_PROJECT_NAME_MISMATCH" }))).toBe(
      DELETE_NAME_MISMATCH_MESSAGE,
    );
    expect(deleteErrorMessage(apiError(400, { code: "SOMETHING_ELSE" }))).toMatch(/could not be deleted/);
    expect(deleteErrorMessage(apiError(403))).toMatch(/Team lead or admin/);
    expect(deleteErrorMessage(apiError(404))).toMatch(/no longer exists/);
    expect(deleteErrorMessage(apiError(429))).toMatch(/Too many requests/);
    expect(deleteErrorMessage(new Error("offline"))).toMatch(/could not be deleted/);
    expect(isDeleteConflict(apiError(409))).toBe(true);
    expect(isDeleteConflict(apiError(400))).toBe(false);
  });

  it("reads the 409 partial-failure body, keeping what was actually deleted", () => {
    const failure = deletePartialFailure(
      apiError(409, {
        code: "PROVIDER_DELETE_FAILED",
        message: "testfinals-be could not be removed from Render. Try again.",
        deletedRepositories: [
          { repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true },
        ],
        failedRepository: { repositoryId: "repo-be", name: "testfinals-be" },
      }),
    );
    expect(failure).toEqual({
      code: "PROVIDER_DELETE_FAILED",
      message: "testfinals-be could not be removed from Render. Try again.",
      deletedRepositories: [
        { repositoryId: "repo-fe", name: "testfinals-fe", projectId: "proj-fe", githubRepoDeleted: true },
      ],
      failedRepository: { repositoryId: "repo-be", name: "testfinals-be" },
    });
  });

  it("falls back to a generic message and empty lists when the 409 body is malformed", () => {
    expect(deletePartialFailure(apiError(409))).toEqual({
      code: "",
      message: "Some repositories could not be deleted. Try again in a moment.",
      deletedRepositories: [],
      failedRepository: null,
    });
    expect(deletePartialFailure(apiError(409, { failedRepository: { name: "no id" } })).failedRepository).toBeNull();
  });
});

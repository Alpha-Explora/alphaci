import { switchRepositories } from "./project-folder-rules";
import type { ProjectFolderSummary } from "./project-folder-types";

describe("switchRepositories", () => {
  it("includes every repository even when roles repeat", () => {
    const folder: ProjectFolderSummary = {
      deliveryProjectId: "delivery-1",
      groupId: "group-1",
      name: "Storefront",
      repositories: [
        {
          projectId: "p1",
          name: "store-web",
          repoFullName: "org/store-web",
          role: "frontend",
          status: "active",
        },
        {
          projectId: "p2",
          name: "admin-web",
          repoFullName: "org/admin-web",
          role: "frontend",
          status: "active",
        },
        {
          projectId: "p3",
          name: "store-api",
          repoFullName: "org/store-api",
          role: "backend",
          status: "active",
        },
      ],
    };

    expect(switchRepositories(folder).map((repo) => repo.name)).toEqual([
      "store-web",
      "admin-web",
      "store-api",
    ]);
  });
});

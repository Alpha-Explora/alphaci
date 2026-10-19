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

  it("keeps every repository and puts each -fe/-be pair side by side, frontend first", () => {
    const repo = (projectId: string, name: string, role: "frontend" | "backend") => ({
      projectId,
      name,
      repoFullName: `org/${name}`,
      role,
      status: "active",
    });
    const folder: ProjectFolderSummary = {
      deliveryProjectId: "delivery-1",
      groupId: "group-1",
      name: "Shop",
      repositories: [
        repo("p1", "shop-fe", "frontend"),
        repo("p2", "shopv2-fe", "frontend"),
        repo("p3", "shop-be", "backend"),
        repo("p4", "shopv2-be", "backend"),
      ],
    };

    expect(switchRepositories(folder).map((r) => r.name)).toEqual([
      "shop-fe",
      "shop-be",
      "shopv2-fe",
      "shopv2-be",
    ]);
  });
});

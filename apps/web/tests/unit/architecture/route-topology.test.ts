import { existsSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(process.cwd(), "src", "app");

const routeFiles: Record<string, string> = {
  "/": "page.tsx",
  "/login": "(access)/login/page.tsx",
  "/signup": "(access)/signup/page.tsx",
  "/auth/callback": "(access)/auth/callback/page.tsx",
  "/guide": "(public)/guide/page.tsx",
  "/home": "(platform)/home/page.tsx",
  "/inbox": "(platform)/inbox/page.tsx",
  "/runs": "(platform)/runs/page.tsx",
  "/runs/report": "(platform)/runs/report/page.tsx",
  "/settings": "(platform)/settings/page.tsx",
  "/teams": "(platform)/teams/page.tsx",
  "/checklists": "(platform)/checklists/page.tsx",
  "/activity": "(platform)/activity/page.tsx",
  "/workflows": "(platform)/workflows/page.tsx",
  "/projects/[projectId]": "(platform)/projects/[projectId]/page.tsx",
  "/projects/[projectId]/qa/report/[runId]":
    "(platform)/projects/[projectId]/qa/report/[runId]/page.tsx",
  "/qa/project-report/[deliveryProjectId]/[runId]":
    "(platform)/qa/project-report/[deliveryProjectId]/[runId]/page.tsx",
  "/admin": "(platform)/admin/page.tsx",
  "/admin/feedback": "(platform)/admin/feedback/page.tsx",
  "/admin/users/[id]": "(platform)/admin/users/[id]/page.tsx",
  "/groups/[groupId]": "(platform)/groups/[groupId]/page.tsx",
  "/groups/[groupId]/activity":
    "(platform)/groups/[groupId]/activity/page.tsx",
  "/groups/[groupId]/delivery-projects/[deliveryProjectId]":
    "(platform)/groups/[groupId]/delivery-projects/[deliveryProjectId]/page.tsx",
  "/groups/[groupId]/members": "(platform)/groups/[groupId]/members/page.tsx",
  "/groups/[groupId]/repositories/[repositoryId]":
    "(platform)/groups/[groupId]/repositories/[repositoryId]/page.tsx",
  "/groups/[groupId]/systems": "(platform)/groups/[groupId]/systems/page.tsx",
  "/groups/[groupId]/systems/[systemId]":
    "(platform)/groups/[groupId]/systems/[systemId]/page.tsx",
};

describe("App Router topology", () => {
  it("keeps every URL mapped to its intended route-group file", () => {
    for (const [url, relativeFile] of Object.entries(routeFiles)) {
      const fileExists = existsSync(join(appRoot, relativeFile));
      if (!fileExists) {
        throw new Error(`Missing route file for ${url}: ${relativeFile}`);
      }
      expect(fileExists).toBe(true);
    }
  });

  it("uses route groups only for organization, without group-level layouts", () => {
    expect(existsSync(join(appRoot, "(access)", "layout.tsx"))).toBe(false);
    expect(existsSync(join(appRoot, "(public)", "layout.tsx"))).toBe(false);
    expect(existsSync(join(appRoot, "(platform)", "layout.tsx"))).toBe(false);
  });
});

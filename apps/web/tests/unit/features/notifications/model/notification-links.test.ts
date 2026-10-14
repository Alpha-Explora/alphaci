import { notificationHref } from "../../../../../src/features/notifications/model/notification-links";
import type { NotificationItem } from "../../../../../src/features/notifications/model/notifications-types";

type LinkItem = Pick<NotificationItem, "eventCode" | "projectId" | "groupId" | "deliveryProjectId">;

function item(overrides: Partial<LinkItem> & Pick<LinkItem, "eventCode">): LinkItem {
  return {
    projectId: null,
    groupId: null,
    deliveryProjectId: null,
    ...overrides,
  };
}

describe("notificationHref", () => {
  describe("qa.item.returned_to_dev (spec §6)", () => {
    it("sends the developer to Overview with the My QA items focus flag", () => {
      expect(
        notificationHref(item({ eventCode: "qa.item.returned_to_dev", projectId: "proj-1" }), "member"),
      ).toBe("/projects/proj-1?focus=my-qa-items#overview");
    });

    it("is not clickable without a projectId", () => {
      expect(notificationHref(item({ eventCode: "qa.item.returned_to_dev" }), "member")).toBeNull();
    });

    it("ignores appRole entirely — every developer lands on Overview", () => {
      expect(
        notificationHref(item({ eventCode: "qa.item.returned_to_dev", projectId: "proj-1" }), "admin"),
      ).toBe("/projects/proj-1?focus=my-qa-items#overview");
    });
  });

  describe("project_created (spec §7)", () => {
    it("deep-links into the project folder when both ids are present", () => {
      expect(
        notificationHref(
          item({
            eventCode: "project_created",
            projectId: "proj-1",
            groupId: "group-1",
            deliveryProjectId: "dp-1",
          }),
          "member",
        ),
      ).toBe("/groups/group-1/delivery-projects/dp-1");
    });

    it("prefers the folder link over the plain project path when both are available", () => {
      const href = notificationHref(
        item({
          eventCode: "project_created",
          projectId: "proj-1",
          groupId: "group-1",
          deliveryProjectId: "dp-1",
        }),
        null,
      );
      expect(href).not.toContain("/projects/proj-1");
      expect(href).toBe("/groups/group-1/delivery-projects/dp-1");
    });

    it("falls back to the plain project page when only projectId is known", () => {
      expect(
        notificationHref(item({ eventCode: "project_created", projectId: "proj-1" }), "member"),
      ).toBe("/projects/proj-1");
    });

    it("falls back to the plain project page when the folder ids are only half-present", () => {
      expect(
        notificationHref(
          item({ eventCode: "project_created", projectId: "proj-1", groupId: "group-1" }),
          "member",
        ),
      ).toBe("/projects/proj-1");
    });

    it("is not clickable with no ids at all", () => {
      expect(notificationHref(item({ eventCode: "project_created" }), "member")).toBeNull();
    });
  });

  describe("QA Studio deep-links (qa.run.signed_off, qa.item.retest_requested, qa.item.blocked, qa.promotion.merged)", () => {
    const qaStudioEvents = [
      "qa.run.signed_off",
      "qa.item.retest_requested",
      "qa.item.blocked",
      "qa.promotion.merged",
    ] as const;

    it.each(qaStudioEvents)("sends %s to the viewer's studio: #qa for qa and admin, #po for a lead", (eventCode) => {
      for (const role of ["qa", "admin"] as const) {
        expect(notificationHref(item({ eventCode, projectId: "proj-1" }), role)).toBe(
          "/projects/proj-1#qa",
        );
      }
      expect(notificationHref(item({ eventCode, projectId: "proj-1" }), "lead")).toBe("/projects/proj-1#po");
    });

    it.each(qaStudioEvents)("sends %s to #overview for a developer", (eventCode) => {
      expect(notificationHref(item({ eventCode, projectId: "proj-1" }), "member")).toBe(
        "/projects/proj-1#overview",
      );
    });

    it.each(qaStudioEvents)("sends %s to #overview for a null/undefined role", (eventCode) => {
      expect(notificationHref(item({ eventCode, projectId: "proj-1" }), null)).toBe(
        "/projects/proj-1#overview",
      );
      expect(notificationHref(item({ eventCode, projectId: "proj-1" }), undefined)).toBe(
        "/projects/proj-1#overview",
      );
    });

    it.each(qaStudioEvents)("is not clickable without a projectId (%s)", (eventCode) => {
      expect(notificationHref(item({ eventCode }), "lead")).toBeNull();
    });
  });

  describe("any other event code with a projectId", () => {
    it("goes to the plain project page", () => {
      for (const eventCode of ["pull_request_created", "pull_request_merged", "deployment_target_failed"]) {
        expect(notificationHref(item({ eventCode, projectId: "proj-1" }), "member")).toBe(
          "/projects/proj-1",
        );
      }
    });

    it("is not clickable with no projectId", () => {
      expect(notificationHref(item({ eventCode: "deployment_target_failed" }), "member")).toBeNull();
    });
  });

  describe("tolerates fields an older backend never sends at all (not just null)", () => {
    it("treats an absent projectId the same as an explicit null", () => {
      const legacyItem = { eventCode: "qa.item.returned_to_dev" } as unknown as LinkItem;
      expect(notificationHref(legacyItem, "member")).toBeNull();
    });

    it("treats absent groupId/deliveryProjectId the same as explicit null on project_created", () => {
      const legacyItem = { eventCode: "project_created", projectId: "proj-1" } as unknown as LinkItem;
      expect(notificationHref(legacyItem, "member")).toBe("/projects/proj-1");
    });
  });

  it("URI-encodes every id it interpolates", () => {
    expect(
      notificationHref(item({ eventCode: "project_created", projectId: "proj one" }), "member"),
    ).toBe("/projects/proj%20one");
    expect(
      notificationHref(
        item({
          eventCode: "project_created",
          groupId: "group one",
          deliveryProjectId: "dp one",
        }),
        "member",
      ),
    ).toBe("/groups/group%20one/delivery-projects/dp%20one");
  });
});

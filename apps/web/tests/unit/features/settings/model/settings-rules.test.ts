import {
  canDeleteAccount,
  canSeeTeamSettingsTab,
  settingsNavSections,
  settingsSectionFromSearch,
  visibleSettingsSection,
} from "../../../../../src/features/settings/model/settings-rules";

describe("canSeeTeamSettingsTab", () => {
  it("shows the Team tab to the team's Lead or Delegated lead", () => {
    expect(canSeeTeamSettingsTab("admin", "member")).toBe(true);
    expect(canSeeTeamSettingsTab("delegated_lead", "member")).toBe(true);
  });

  it("shows it to a lead or admin app role on their team", () => {
    expect(canSeeTeamSettingsTab("member", "lead")).toBe(true);
    expect(canSeeTeamSettingsTab("member", "admin")).toBe(true);
  });

  /* Allow-lists on both axes: a role nobody named gets nothing. */
  it("hides it from members, viewers, QA and unknown roles", () => {
    expect(canSeeTeamSettingsTab("member", "member")).toBe(false);
    expect(canSeeTeamSettingsTab("viewer", "member")).toBe(false);
    expect(canSeeTeamSettingsTab("member", "qa")).toBe(false);
    expect(canSeeTeamSettingsTab("owner", "superuser")).toBe(false);
    expect(canSeeTeamSettingsTab("member", null)).toBe(false);
  });

  it("hides it while there is no team to configure", () => {
    expect(canSeeTeamSettingsTab(null, "admin")).toBe(false);
    expect(canSeeTeamSettingsTab(undefined, "lead")).toBe(false);
  });
});

describe("settingsNavSections", () => {
  it("puts Team under Account only when it may be shown", () => {
    expect(settingsNavSections(true)).toEqual([
      "account",
      "team",
      "appearance",
      "connections",
      "guide",
      "danger",
    ]);
    expect(settingsNavSections(false)).toEqual([
      "account",
      "appearance",
      "connections",
      "guide",
      "danger",
    ]);
  });
});

describe("settingsSectionFromSearch", () => {
  it("opens the section a ?tab= link names", () => {
    expect(settingsSectionFromSearch("?tab=team&workspace=ws-1")).toBe("team");
    expect(settingsSectionFromSearch("tab=appearance")).toBe("appearance");
  });

  it("opens Account for no tab or an unknown one", () => {
    expect(settingsSectionFromSearch("")).toBe("account");
    expect(settingsSectionFromSearch("?tab=billing")).toBe("account");
  });
});

describe("visibleSettingsSection", () => {
  it("falls back from a hidden Team tab to Account", () => {
    expect(visibleSettingsSection("team", false)).toBe("account");
    expect(visibleSettingsSection("team", true)).toBe("team");
    expect(visibleSettingsSection("guide", false)).toBe("guide");
  });
});

describe("canDeleteAccount", () => {
  it("arms only on the exact login", () => {
    expect(canDeleteAccount("tone", "tone")).toBe(true);
    expect(canDeleteAccount("Tone", "tone")).toBe(false);
    expect(canDeleteAccount("", undefined)).toBe(false);
  });
});

import {
  previewHostLabel,
  previewSurface,
} from "../../../../../src/features/projects/model/projects-rules";

describe("preview surface rules", () => {
  it("shows logs only when the backend says so, and the page otherwise", () => {
    expect(previewSurface({ surface: "logs" })).toBe("logs");
    expect(previewSurface({ surface: "page" })).toBe("page");
    // An older backend omits the field.
    expect(previewSurface({})).toBe("page");
  });

  it("labels the host from the backend's descriptor, else the older rule", () => {
    expect(previewHostLabel({ provider: "render", providerLabel: "Render (Oregon)" })).toBe("Render (Oregon)");
    expect(previewHostLabel({ provider: "vercel" })).toBe("Vercel");
    expect(previewHostLabel({ provider: "render", providerLabel: "" })).toBe("Render");
  });
});

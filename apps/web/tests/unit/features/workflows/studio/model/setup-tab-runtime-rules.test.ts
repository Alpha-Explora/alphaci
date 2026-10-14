import {
  repoNamePlaceholder,
  stackRuntimeLabel,
} from "../../../../../../src/features/workflows/studio/model/setup-tab-rules";

describe("stackRuntimeLabel", () => {
  it("names the runtime with its language, not the language alone", () => {
    expect(
      stackRuntimeLabel({ runtime: "dotnet", language: "C#", framework: ".NET", label: ".NET" }),
    ).toBe(".NET (C#)");
  });

  it("does not repeat a language that is the framework's own name", () => {
    expect(stackRuntimeLabel({ runtime: "go", language: "Go", framework: "Go" })).toBe("Go");
  });

  it("falls back to the label, then the runtime id, then a generic line", () => {
    expect(stackRuntimeLabel({ runtime: "dotnet", label: ".NET" })).toBe(".NET");
    expect(stackRuntimeLabel({ runtime: "dotnet" })).toBe("dotnet");
    expect(stackRuntimeLabel(undefined)).toBe("Runtime from catalog");
  });
});

describe("repoNamePlaceholder", () => {
  it("suggests a Node app name for Node stacks and an API name otherwise", () => {
    expect(repoNamePlaceholder("node")).toBe("my-next-app");
    expect(repoNamePlaceholder(undefined)).toBe("my-next-app");
    expect(repoNamePlaceholder("dotnet")).toBe("my-api");
  });
});

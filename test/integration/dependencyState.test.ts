import { describe, expect, it } from "vitest";

import { classifyDependency } from "../../src/integration/dependencyState";

describe("Custom UI Style dependency detection abstraction", () => {
  it("reports an unavailable dependency", () => {
    expect(classifyDependency(undefined)).toEqual({ status: "unavailable" });
  });

  it("distinguishes available inactive and active dependencies", () => {
    expect(classifyDependency({ isActive: false })).toEqual({
      status: "available-inactive",
    });
    expect(classifyDependency({ isActive: true })).toEqual({
      status: "available-active",
    });
  });
});

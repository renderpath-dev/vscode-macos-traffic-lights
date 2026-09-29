import { describe, expect, it } from "vitest";

import { classifyEnvironment } from "../../src/compatibility/environment";

describe("runtime environment support", () => {
  it("supports Microsoft VS Code Desktop on Windows", () => {
    expect(
      classifyEnvironment({
        applicationName: "Visual Studio Code",
        platform: "win32",
        uiKind: "desktop",
      }),
    ).toEqual({ status: "supported" });
  });

  it.each([
    {
      applicationName: "Visual Studio Code",
      platform: "linux",
      uiKind: "desktop" as const,
    },
    {
      applicationName: "Visual Studio Code",
      platform: "win32",
      uiKind: "web" as const,
    },
    {
      applicationName: "VSCodium",
      platform: "win32",
      uiKind: "desktop" as const,
    },
  ])("rejects unsupported environment %#", (environment) => {
    expect(classifyEnvironment(environment).status).toBe("unsupported");
  });
});

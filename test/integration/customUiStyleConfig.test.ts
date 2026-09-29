import { describe, expect, it } from "vitest";

import {
  invalidExternalImportIndexes,
  isSupportedExternalImport,
  parseExternalLoadStrategy,
} from "../../src/integration/customUiStyleConfig";

describe("Custom UI Style external import validation", () => {
  it("accepts the upstream local-string and HTTPS-object formats", () => {
    expect(isSupportedExternalImport("file:///C:/styles/local.css")).toBe(true);
    expect(isSupportedExternalImport("file://${userHome}/local.css")).toBe(
      true,
    );
    expect(
      isSupportedExternalImport("file://${env:stylesRoot:C:/styles}/local.css"),
    ).toBe(true);
    expect(isSupportedExternalImport("https://example.com/module.js")).toBe(
      true,
    );
    expect(
      isSupportedExternalImport({
        type: "css",
        url: "https://example.com/theme.css",
      }),
    ).toBe(true);
    expect(
      isSupportedExternalImport({
        type: "css",
        url: "https://fonts.googleapis.com/css?family=Sofia",
      }),
    ).toBe(true);
  });

  it("rejects entries that would make upstream resource parsing fail", () => {
    expect(isSupportedExternalImport(42)).toBe(false);
    expect(isSupportedExternalImport({ futureSchema: true })).toBe(false);
    expect(
      isSupportedExternalImport({
        type: "css",
        url: "file:///C:/styles/not-supported-as-an-object.css",
      }),
    ).toBe(false);
    expect(
      isSupportedExternalImport("https://exa mple.com/malformed.css"),
    ).toBe(false);
    expect(isSupportedExternalImport("file:///C:/styles/bad%ZZ.css")).toBe(
      false,
    );
    expect(isSupportedExternalImport("file://${unclosed/local.css")).toBe(
      false,
    );
    expect(
      invalidExternalImportIndexes([
        "file:///valid.css",
        42,
        { futureSchema: true },
        {
          type: "js-module",
          url: "https://exa mple.com/malformed.js",
        },
        "file:// bad.css",
      ]),
    ).toEqual([1, 2, 3, 4]);
  });

  it("parses all documented load strategies and rejects drift", () => {
    expect(parseExternalLoadStrategy("refetch")).toBe("refetch");
    expect(parseExternalLoadStrategy("cache")).toBe("cache");
    expect(parseExternalLoadStrategy("disable")).toBe("disable");
    expect(parseExternalLoadStrategy("future-strategy")).toBe("invalid");
  });
});

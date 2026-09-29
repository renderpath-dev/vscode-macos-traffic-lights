import { describe, expect, it } from "vitest";

import {
  classifyVersion,
  compareVersions,
  parseVersion,
} from "../../src/compatibility/vscodeVersion";

describe("VS Code version comparison", () => {
  it("parses release and prerelease version strings", () => {
    expect(parseVersion("1.99.3")).toEqual({
      major: 1,
      minor: 99,
      patch: 3,
      prerelease: undefined,
    });
    expect(parseVersion("1.133.0-insider")).toMatchObject({
      major: 1,
      minor: 133,
      patch: 0,
      prerelease: "insider",
    });
    expect(parseVersion("not-a-version")).toBeUndefined();
    expect(parseVersion("1.99.0garbage")).toBeUndefined();
  });

  it("compares numeric components instead of lexicographic strings", () => {
    const version1100 = parseVersion("1.100.0");
    const version199 = parseVersion("1.99.9");
    expect(version1100).toBeDefined();
    expect(version199).toBeDefined();
    if (version1100 !== undefined && version199 !== undefined) {
      expect(compareVersions(version1100, version199)).toBe(1);
      expect(compareVersions(version199, version1100)).toBe(-1);
      expect(compareVersions(version199, version199)).toBe(0);
    }
  });

  it("classifies unsupported, tested, and newer untested versions", () => {
    expect(classifyVersion("1.98.2", "1.99.0", ["1.99.1"])).toEqual({
      minimumVersion: "1.99.0",
      status: "unsupported",
      version: "1.98.2",
    });
    expect(classifyVersion("1.99.1", "1.99.0", ["1.99.1"])).toEqual({
      status: "supported-and-tested",
      version: "1.99.1",
    });
    expect(classifyVersion("1.134.0", "1.99.0", ["1.132.0"])).toEqual({
      status: "supported-but-untested",
      version: "1.134.0",
    });
  });
});

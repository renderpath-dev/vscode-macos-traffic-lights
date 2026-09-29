import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const verifier = path.resolve("scripts/verify-upstream.mjs");

function runVerifier(...arguments_: string[]) {
  return spawnSync(process.execPath, [verifier, ...arguments_], {
    encoding: "utf8",
  });
}

describe("upstream verifier argument validation", () => {
  it.each(["dead", "deadbeef", "a".repeat(39)])(
    "rejects abbreviated hexadecimal ref %s before source selection",
    (ref) => {
      const result = runVerifier("--ref", ref);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain(
        "Abbreviated hexadecimal VS Code refs are unsupported: " +
          JSON.stringify(ref),
      );
      expect(result.stderr).toContain("Use the full 40-character commit SHA");
    },
  );

  it("allows a full 40-character commit SHA through argument validation", () => {
    const missingRepository = path.join(
      process.cwd(),
      ".definitely-missing-vscode-reference",
    );
    const result = runVerifier(
      "--ref",
      "a".repeat(40),
      "--repo",
      missingRepository,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(
      "Abbreviated hexadecimal VS Code refs are unsupported",
    );
    expect(result.stderr).toContain(
      "Local VS Code repository does not exist: " + missingRepository,
    );
  });

  it("documents the full commit-SHA requirement", () => {
    const result = runVerifier("--help");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Use all 40 hexadecimal characters for a commit ID.",
    );
  });
});

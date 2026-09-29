import { describe, expect, it } from "vitest";

import type { JsonValue } from "../../src/json";
import {
  isOwnedExternalImport,
  reconcileExternalImports,
  removeOwnedExternalImports,
  type ImportOwnership,
} from "../../src/resources/externalImports";

const extensionId = "renderpath-dev.vscode-macos-traffic-lights";
const currentUri =
  "file:///C:/Users/example/.vscode/extensions/renderpath-dev.vscode-macos-traffic-lights-0.2.0/assets/macos-traffic-lights.css";
const staleUri =
  "file:///C:/Users/example/.vscode/extensions/renderpath-dev.vscode-macos-traffic-lights-0.1.0/assets/macos-traffic-lights.css";
const unrelatedUri = "file:///C:/styles/unrelated.css";
const unrelatedObject: JsonValue = {
  type: "css",
  url: "https://example.com/theme.css",
};

function ownership(knownUris: readonly string[] = []): ImportOwnership {
  return {
    assetFileName: "macos-traffic-lights.css",
    assetParentDirectory: "assets",
    currentUri,
    extensionId,
    knownUris,
  };
}

describe("external import ownership", () => {
  it("recognizes exact known and tightly versioned extension URIs", () => {
    expect(isOwnedExternalImport(currentUri, ownership())).toBe(true);
    expect(isOwnedExternalImport(staleUri, ownership())).toBe(true);

    const developmentUri =
      "file:///workspace/vscode-macos-traffic-lights/assets/macos-traffic-lights.css";
    expect(
      isOwnedExternalImport(developmentUri, ownership([developmentUri])),
    ).toBe(true);
  });

  it("does not use a broad extension-name substring", () => {
    const similarPublisher =
      "file:///C:/Users/example/.vscode/extensions/other.vscode-macos-traffic-lights-0.2.0/assets/macos-traffic-lights.css";
    const nestedCoincidence =
      "file:///C:/renderpath-dev.vscode-macos-traffic-lights-0.2.0/not-assets/macos-traffic-lights.css";
    const spoofedDifferentRoot =
      "file:///C:/tmp/extensions/renderpath-dev.vscode-macos-traffic-lights-0.1.0/assets/macos-traffic-lights.css";
    expect(isOwnedExternalImport(similarPublisher, ownership())).toBe(false);
    expect(isOwnedExternalImport(nestedCoincidence, ownership())).toBe(false);
    expect(isOwnedExternalImport(spoofedDifferentRoot, ownership())).toBe(
      false,
    );
    expect(isOwnedExternalImport(unrelatedObject, ownership())).toBe(false);
  });
});

describe("reconcileExternalImports", () => {
  it("inserts the current import", () => {
    const result = reconcileExternalImports(
      [unrelatedUri, unrelatedObject],
      ownership(),
    );
    expect(result.imports).toEqual([unrelatedUri, unrelatedObject, currentUri]);
    expect(result.changed).toBe(true);
  });

  it("prevents duplicates and is idempotent", () => {
    const duplicated = reconcileExternalImports(
      [currentUri, unrelatedUri, currentUri],
      ownership(),
    );
    expect(duplicated.imports).toEqual([currentUri, unrelatedUri]);
    expect(duplicated.ownedRemoved).toBe(2);

    const repeated = reconcileExternalImports(duplicated.imports, ownership());
    expect(repeated.imports).toEqual(duplicated.imports);
    expect(repeated.changed).toBe(false);
  });

  it("replaces stale owned imports at their first position", () => {
    const result = reconcileExternalImports(
      [unrelatedUri, staleUri, unrelatedObject],
      ownership(),
    );
    expect(result.imports).toEqual([unrelatedUri, currentUri, unrelatedObject]);
    expect(result.staleRemoved).toBe(1);
    expect(result.currentWasRegistered).toBe(false);
  });

  it("preserves unrelated string, object, and malformed-looking entries", () => {
    const unfamiliarEntries: JsonValue[] = [
      unrelatedUri,
      unrelatedObject,
      { futureSchema: true },
      42,
    ];
    const result = reconcileExternalImports(unfamiliarEntries, ownership());
    expect(result.imports.slice(0, -1)).toEqual(unfamiliarEntries);
  });
});

describe("removeOwnedExternalImports", () => {
  it("removes every owned URI and no unrelated import", () => {
    const result = removeOwnedExternalImports(
      [staleUri, unrelatedUri, currentUri, unrelatedObject],
      ownership(),
    );
    expect(result.imports).toEqual([unrelatedUri, unrelatedObject]);
    expect(result.ownedRemoved).toBe(2);
    expect(result.staleRemoved).toBe(1);
  });

  it("is idempotent when no owned import remains", () => {
    const result = removeOwnedExternalImports([unrelatedUri], ownership());
    expect(result.changed).toBe(false);
    expect(result.imports).toEqual([unrelatedUri]);
  });
});

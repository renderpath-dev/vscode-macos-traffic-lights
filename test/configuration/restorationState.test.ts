import { describe, expect, it } from "vitest";

import {
  captureManagedSetting,
  createEmptyState,
  decideRestoration,
  parseExtensionState,
  withKnownOwnedUri,
  withManagedSetting,
  type ManagedSettingRecord,
} from "../../src/configuration/restorationState";

function writtenRecord(
  baseline: ManagedSettingRecord["baseline"],
): ManagedSettingRecord {
  return {
    baseline,
    desiredValue: "custom",
    extensionWrote: true,
    key: "window.controlsStyle",
    pendingWrite: false,
  };
}

describe("managed setting baseline capture", () => {
  it("distinguishes an absent global value", () => {
    expect(
      captureManagedSetting("window.controlsStyle", undefined),
    ).toMatchObject({
      baseline: { kind: "absent" },
      extensionWrote: false,
    });
  });

  it("records an explicit global user value", () => {
    expect(
      captureManagedSetting("window.titleBarStyle", "native"),
    ).toMatchObject({
      baseline: { kind: "value", value: "native" },
      extensionWrote: false,
    });
  });
});

describe("managed setting restoration", () => {
  it("restores an explicit user value", () => {
    expect(
      decideRestoration(
        writtenRecord({ kind: "value", value: "native" }),
        "custom",
      ),
    ).toEqual({ kind: "restore-value", value: "native" });
  });

  it("restores an absent baseline by removing the explicit value", () => {
    expect(
      decideRestoration(writtenRecord({ kind: "absent" }), "custom"),
    ).toEqual({ kind: "remove-explicit-value" });
  });

  it("preserves a value the user changed after Enable", () => {
    expect(
      decideRestoration(
        writtenRecord({ kind: "value", value: "native" }),
        "hidden",
      ),
    ).toEqual({ kind: "preserve-user-change" });
  });

  it("does nothing when the extension never wrote the setting", () => {
    const record = captureManagedSetting("window.titleBarStyle", "custom");
    expect(decideRestoration(record, "custom")).toEqual({
      kind: "no-extension-write",
    });
  });

  it("can recover a recorded write that was pending during interruption", () => {
    const pending: ManagedSettingRecord = {
      ...writtenRecord({ kind: "absent" }),
      extensionWrote: false,
      pendingWrite: true,
    };
    expect(decideRestoration(pending, "custom")).toEqual({
      kind: "remove-explicit-value",
    });
  });
});

describe("extension state parsing and updates", () => {
  it("round-trips valid explicit state and deduplicates known URIs", () => {
    let state = createEmptyState();
    state = withKnownOwnedUri(state, "file:///current.css");
    state = withKnownOwnedUri(state, "file:///current.css");
    state = withManagedSetting(
      state,
      captureManagedSetting("window.controlsStyle", undefined),
    );
    expect(parseExtensionState(state)).toEqual(state);
    expect(state.knownOwnedUris).toEqual(["file:///current.css"]);
  });

  it("rejects unknown or malformed state", () => {
    expect(parseExtensionState({ schemaVersion: 99 })).toBeUndefined();
    expect(
      parseExtensionState({
        enabled: true,
        externalImports: null,
        knownOwnedUris: [42],
        managedSettings: [],
        schemaVersion: 1,
      }),
    ).toBeUndefined();
  });

  it("rejects duplicate managed-setting records", () => {
    const state = createEmptyState();
    const record = captureManagedSetting("window.controlsStyle", undefined);
    expect(
      parseExtensionState({
        ...state,
        managedSettings: [record, record],
      }),
    ).toBeUndefined();
  });

  it("migrates pre-transaction schema-1 state conservatively", () => {
    const state = createEmptyState();
    const old = {
      enabled: state.enabled,
      externalImports: state.externalImports,
      knownOwnedUris: state.knownOwnedUris,
      managedSettings: state.managedSettings,
      schemaVersion: state.schemaVersion,
    };
    expect(parseExtensionState(old)).toMatchObject({
      disablePending: false,
      pendingReload: false,
      schemaVersion: 1,
    });
  });
});

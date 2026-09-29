import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, Memento, OutputChannel } from "vscode";

import type {
  ExtensionState,
  ManagedSettingRecord,
} from "../../src/configuration/restorationState";

const mocks = vi.hoisted(() => ({
  globalValues: new Map<string, string | undefined>(),
  inspectManagedSetting: vi.fn(),
  lines: [] as string[],
  readExternalImports: vi.fn(),
  reloadCustomUiStyle: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  updateManagedSetting: vi.fn(),
}));

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: mocks.showInformationMessage,
    showWarningMessage: mocks.showWarningMessage,
  },
}));

vi.mock("../../src/configuration/managedSettings", () => ({
  inspectManagedSetting: mocks.inspectManagedSetting,
  updateManagedSetting: mocks.updateManagedSetting,
}));

vi.mock("../../src/integration/customUiStyle", () => ({
  getCustomUiStyleExtension: vi.fn(() => ({})),
  readExternalImports: mocks.readExternalImports,
  reloadCustomUiStyle: mocks.reloadCustomUiStyle,
  updateExternalImports: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/resources/externalImports", () => ({
  removeOwnedExternalImports: vi.fn(() => ({
    changed: false,
    imports: [],
    ownedRemoved: 0,
  })),
}));

vi.mock("../../src/commands/shared", () => ({
  createImportOwnership: vi.fn(() => ({})),
  cssAssetUri: vi.fn(() => "file:///current.css"),
}));

import { disable } from "../../src/commands/disable";

const titleBarRecord: ManagedSettingRecord = {
  baseline: { kind: "value", value: "native" },
  desiredValue: "custom",
  extensionWrote: true,
  key: "window.titleBarStyle",
  pendingWrite: false,
};

const controlsRecord: ManagedSettingRecord = {
  baseline: { kind: "absent" },
  desiredValue: "custom",
  extensionWrote: true,
  key: "window.controlsStyle",
  pendingWrite: false,
};

function extensionState(
  managedSettings: readonly ManagedSettingRecord[],
  enabled = true,
): ExtensionState {
  return {
    disablePending: false,
    enabled,
    externalImports: null,
    knownOwnedUris: [],
    managedSettings,
    pendingReload: false,
    schemaVersion: 1,
  };
}

function createHarness(
  initialState: ExtensionState,
  updateError?: Error,
): {
  readonly context: ExtensionContext;
  readonly currentState: () => ExtensionState;
} {
  let persisted: unknown = initialState;
  const globalState = {
    get: vi.fn(() => persisted),
    update: vi.fn((_key: string, value: unknown) => {
      if (updateError !== undefined) {
        return Promise.reject(updateError);
      }
      persisted = value;
      return Promise.resolve();
    }),
  } as unknown as Memento;
  return {
    context: {
      extension: { id: "renderpath-dev.vscode-macos-traffic-lights" },
      extensionUri: { scheme: "file" },
      globalState,
      subscriptions: [],
    } as unknown as ExtensionContext,
    currentState: () => persisted as ExtensionState,
  };
}

function output(): OutputChannel {
  return {
    appendLine: vi.fn((line: string) => mocks.lines.push(line)),
  } as unknown as OutputChannel;
}

describe("Disable recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.globalValues.clear();
    mocks.lines.length = 0;

    mocks.inspectManagedSetting.mockReset();
    mocks.inspectManagedSetting.mockImplementation((key: string) => ({
      globalValue: mocks.globalValues.get(key),
    }));

    mocks.updateManagedSetting.mockReset();
    mocks.updateManagedSetting.mockImplementation(
      (key: string, value: string | undefined) => {
        mocks.globalValues.set(key, value);
        return Promise.resolve();
      },
    );

    mocks.readExternalImports.mockReset();
    mocks.readExternalImports.mockReturnValue({
      effective: [],
      global: undefined,
    });

    mocks.reloadCustomUiStyle.mockReset();
    mocks.reloadCustomUiStyle.mockResolvedValue(undefined);
    mocks.showInformationMessage.mockReset();
    mocks.showInformationMessage.mockResolvedValue(undefined);
    mocks.showWarningMessage.mockReset();
    mocks.showWarningMessage.mockResolvedValue(undefined);
  });

  it("persists a retry transaction when inspection fails from a non-pending state", async () => {
    const harness = createHarness(extensionState([titleBarRecord], false));
    mocks.inspectManagedSetting.mockImplementation(() => {
      throw new Error("inspection unavailable");
    });

    await expect(disable(harness.context, output())).resolves.toBeUndefined();

    expect(harness.currentState()).toMatchObject({
      disablePending: true,
      enabled: false,
      pendingReload: true,
    });
    expect(harness.currentState().managedSettings).toEqual([titleBarRecord]);
    expect(mocks.reloadCustomUiStyle).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      "macOS Traffic Lights Disable is incomplete. " +
        "Could not inspect or restore window.titleBarStyle: inspection unavailable " +
        "Retained cleanup progress: removed 0 owned CSS imports and restored 0 settings. " +
        "Correct the problem and run Disable again.",
    );
  });

  it("does not promise retry recovery when persisting the transaction fails", async () => {
    const harness = createHarness(
      extensionState([titleBarRecord], false),
      new Error("state persistence unavailable"),
    );
    mocks.inspectManagedSetting.mockImplementation(() => {
      throw new Error("inspection unavailable");
    });

    await expect(disable(harness.context, output())).rejects.toThrow(
      "state persistence unavailable",
    );

    expect(mocks.reloadCustomUiStyle).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.showWarningMessage).not.toHaveBeenCalled();
  });

  it("continues with an independent setting after an inspection failure", async () => {
    const harness = createHarness(
      extensionState([titleBarRecord, controlsRecord]),
    );
    mocks.globalValues.set("window.titleBarStyle", "custom");
    mocks.globalValues.set("window.controlsStyle", "custom");
    mocks.inspectManagedSetting.mockImplementation((key: string) => {
      if (key === "window.titleBarStyle") {
        throw new Error("inspection unavailable");
      }
      return { globalValue: mocks.globalValues.get(key) };
    });

    await expect(disable(harness.context, output())).resolves.toBeUndefined();

    expect(mocks.updateManagedSetting).toHaveBeenCalledOnce();
    expect(mocks.updateManagedSetting).toHaveBeenCalledWith(
      "window.controlsStyle",
      undefined,
    );
    expect(mocks.globalValues.get("window.controlsStyle")).toBeUndefined();
    expect(harness.currentState()).toMatchObject({
      disablePending: true,
      enabled: false,
      pendingReload: true,
    });
    expect(mocks.reloadCustomUiStyle).not.toHaveBeenCalled();
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining(
        "Retained cleanup progress: removed 0 owned CSS imports and restored 1 setting.",
      ),
    );
  });

  it("accumulates cleanup errors, retains progress, and completes a corrected retry", async () => {
    const harness = createHarness(
      extensionState([titleBarRecord, controlsRecord]),
    );
    mocks.globalValues.set("window.titleBarStyle", "custom");
    mocks.globalValues.set("window.controlsStyle", "custom");
    mocks.readExternalImports.mockImplementationOnce(() => {
      throw new Error("import inspection unavailable");
    });
    mocks.updateManagedSetting.mockRejectedValueOnce(
      new Error("configuration write denied"),
    );

    await expect(disable(harness.context, output())).resolves.toBeUndefined();

    expect(mocks.updateManagedSetting.mock.calls).toEqual([
      ["window.titleBarStyle", "native"],
      ["window.controlsStyle", undefined],
    ]);
    expect(mocks.globalValues.get("window.titleBarStyle")).toBe("custom");
    expect(mocks.globalValues.get("window.controlsStyle")).toBeUndefined();
    expect(harness.currentState()).toMatchObject({
      disablePending: true,
      enabled: false,
      pendingReload: true,
    });
    expect(harness.currentState().managedSettings).toEqual([
      titleBarRecord,
      controlsRecord,
    ]);
    expect(mocks.reloadCustomUiStyle).not.toHaveBeenCalled();

    const expectedWarning =
      "macOS Traffic Lights Disable is incomplete. " +
      "Could not inspect or remove the owned CSS import: import inspection unavailable; " +
      "Could not inspect or restore window.titleBarStyle: configuration write denied " +
      "Retained cleanup progress: removed 0 owned CSS imports and restored 1 setting. " +
      "Correct the problem and run Disable again.";
    expect(mocks.showWarningMessage).toHaveBeenCalledWith(expectedWarning);
    expect(mocks.lines).toContain(expectedWarning);

    mocks.updateManagedSetting.mockClear();
    mocks.showWarningMessage.mockClear();

    await expect(disable(harness.context, output())).resolves.toBeUndefined();

    expect(mocks.updateManagedSetting).toHaveBeenCalledOnce();
    expect(mocks.updateManagedSetting).toHaveBeenCalledWith(
      "window.titleBarStyle",
      "native",
    );
    expect(mocks.reloadCustomUiStyle).toHaveBeenCalledOnce();
    expect(harness.currentState()).toEqual({
      disablePending: false,
      enabled: false,
      externalImports: null,
      knownOwnedUris: ["file:///current.css"],
      managedSettings: [],
      pendingReload: false,
      schemaVersion: 1,
    });
    expect(mocks.showWarningMessage).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("disable configuration applied"),
    );
  });
});

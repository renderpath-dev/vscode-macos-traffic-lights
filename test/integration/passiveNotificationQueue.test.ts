import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";

const mocks = vi.hoisted(() => {
  const lines: string[] = [];
  const callbacks: Record<string, () => Promise<void>> = {};
  const output = {
    appendLine: vi.fn((line: string) => lines.push(line)),
    clear: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
  };

  return {
    applyError: undefined as Error | undefined,
    callbacks,
    dependencyAvailable: true,
    executeCommand: vi.fn(() => Promise.resolve()),
    lines,
    output,
    reloadCustomUiStyle: vi.fn(() => Promise.resolve()),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    state: {
      current: {
        disablePending: false,
        enabled: false,
        externalImports: null,
        knownOwnedUris: [] as string[],
        managedSettings: [],
        pendingReload: false,
        schemaVersion: 1 as const,
      },
    },
  };
});

vi.mock("vscode", () => ({
  commands: {
    executeCommand: mocks.executeCommand,
    registerCommand: vi.fn((command: string, callback: () => Promise<void>) => {
      mocks.callbacks[command] = callback;
      return { dispose: vi.fn() };
    }),
  },
  ConfigurationTarget: { Global: 1 },
  env: { appHost: "desktop", appName: "Visual Studio Code", uiKind: 1 },
  extensions: { getExtension: vi.fn(() => ({ isActive: true })) },
  UIKind: { Desktop: 1 },
  Uri: {
    joinPath: vi.fn(() => ({
      scheme: "file",
      toString: () => "file:///current.css",
    })),
  },
  version: "1.132.0",
  window: {
    createOutputChannel: vi.fn(() => mocks.output),
    showErrorMessage: mocks.showErrorMessage,
    showInformationMessage: mocks.showInformationMessage,
    showWarningMessage: mocks.showWarningMessage,
  },
  workspace: { getConfiguration: vi.fn() },
}));

vi.mock("../../src/configuration/managedSettings", () => ({
  assertNoManagedSettingOverride: vi.fn(),
  inspectManagedSetting: vi.fn(),
  MANAGED_SETTINGS: [],
  updateManagedSetting: vi.fn(),
}));

vi.mock("../../src/configuration/restorationState", () => ({
  captureManagedSetting: vi.fn(),
  createEmptyState: vi.fn((knownOwnedUris: readonly string[] = []) => ({
    disablePending: false,
    enabled: false,
    externalImports: null,
    knownOwnedUris: [...knownOwnedUris],
    managedSettings: [],
    pendingReload: false,
    schemaVersion: 1,
  })),
  decideRestoration: vi.fn(),
  loadExtensionState: vi.fn(() => mocks.state.current),
  saveExtensionState: vi.fn(
    (_globalState: unknown, state: typeof mocks.state.current) => {
      mocks.state.current = state;
      return Promise.resolve();
    },
  ),
  withKnownOwnedUri: vi.fn(
    (state: typeof mocks.state.current, uri: string) => ({
      ...state,
      knownOwnedUris: [...new Set([...state.knownOwnedUris, uri])],
    }),
  ),
  withManagedSetting: vi.fn((state: typeof mocks.state.current) => state),
}));

vi.mock("../../src/integration/customUiStyle", () => ({
  assertExternalLoadingEnabled: vi.fn(() => {
    if (mocks.applyError !== undefined) {
      throw mocks.applyError;
    }
    return "refetch";
  }),
  getCustomUiStyleExtension: vi.fn(() =>
    mocks.dependencyAvailable ? {} : undefined,
  ),
  readExternalImports: vi.fn(() => ({ effective: [], global: undefined })),
  reloadCustomUiStyle: mocks.reloadCustomUiStyle,
  requireCustomUiStyleExtension: vi.fn(),
  updateExternalImports: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/resources/externalImports", () => ({
  reconcileExternalImports: vi.fn(() => ({
    changed: false,
    imports: [],
    staleRemoved: 0,
  })),
  removeOwnedExternalImports: vi.fn(() => ({
    changed: false,
    imports: [],
    ownedRemoved: 0,
  })),
}));

vi.mock("../../src/commands/shared", () => ({
  assertSupportedRuntime: vi.fn(),
  createImportOwnership: vi.fn(() => ({})),
  cssAssetUri: vi.fn(() => "file:///current.css"),
}));

vi.mock("../../src/compatibility/environment", () => ({
  classifyEnvironment: vi.fn(() => ({ status: "supported" })),
}));

vi.mock("../../src/compatibility/runtime", () => ({
  detectRuntimeEnvironment: vi.fn(() => ({})),
}));

import { executeApply } from "../../src/commands/apply";
import { disable } from "../../src/commands/disable";
import { activate } from "../../src/extension";
import { reconcileOnActivation } from "../../src/lifecycle";
import { OperationQueue } from "../../src/operationQueue";

function context(): ExtensionContext {
  return {
    extension: { id: "renderpath-dev.vscode-macos-traffic-lights" },
    extensionUri: { scheme: "file" },
    globalState: {},
    subscriptions: [],
  } as unknown as ExtensionContext;
}

function unresolvedNotification(): Promise<undefined> {
  return new Promise<undefined>(() => undefined);
}

async function expectLaterOperationStarts(
  firstOperation: () => Promise<void>,
  notification: ReturnType<typeof vi.fn>,
): Promise<void> {
  const queue = new OperationQueue();
  let laterStarted = false;
  const first = queue.run(firstOperation);

  await vi.waitFor(() => expect(notification).toHaveBeenCalledOnce());
  const later = queue.run(() => {
    laterStarted = true;
    return Promise.resolve();
  });

  await vi.waitFor(() => expect(laterStarted).toBe(true));
  await Promise.all([first, later]);
}

describe("passive notification operation queue boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showErrorMessage.mockReset();
    mocks.showInformationMessage.mockReset();
    mocks.showWarningMessage.mockReset();
    mocks.executeCommand.mockReset();
    mocks.executeCommand.mockResolvedValue(undefined);
    mocks.callbacks = {};
    mocks.lines.length = 0;
    mocks.applyError = undefined;
    mocks.dependencyAvailable = true;
    mocks.state.current = {
      disablePending: false,
      enabled: false,
      externalImports: null,
      knownOwnedUris: [],
      managedSettings: [],
      pendingReload: false,
      schemaVersion: 1,
    };
  });

  it("does not let an unresolved Enable result banner delay a later operation", async () => {
    mocks.state.current = { ...mocks.state.current, enabled: true };
    mocks.showInformationMessage.mockReturnValue(unresolvedNotification());

    await expectLaterOperationStarts(
      () =>
        executeApply(
          context(),
          mocks.output as unknown as OutputChannel,
          "enable",
        ),
      mocks.showInformationMessage,
    );
  });

  it("does not let an unresolved incomplete-Disable warning delay a retry", async () => {
    mocks.state.current = { ...mocks.state.current, enabled: true };
    mocks.dependencyAvailable = false;
    mocks.showWarningMessage.mockReturnValue(unresolvedNotification());

    await expectLaterOperationStarts(
      () => disable(context(), mocks.output as unknown as OutputChannel),
      mocks.showWarningMessage,
    );
    expect(mocks.state.current).toMatchObject({
      disablePending: true,
      enabled: false,
      pendingReload: true,
    });
  });

  it("does not let an unresolved completed-Disable banner delay a later operation", async () => {
    mocks.state.current = { ...mocks.state.current, enabled: true };
    mocks.showInformationMessage.mockReturnValue(unresolvedNotification());

    await expectLaterOperationStarts(
      () => disable(context(), mocks.output as unknown as OutputChannel),
      mocks.showInformationMessage,
    );
    expect(mocks.state.current).toMatchObject({
      disablePending: false,
      enabled: false,
      pendingReload: false,
    });
  });

  it("does not let an unresolved command-error banner delay a corrected retry", async () => {
    mocks.applyError = new Error("temporary configuration failure");
    mocks.showErrorMessage.mockReturnValue(unresolvedNotification());
    const extensionContext = context();
    activate(extensionContext);
    const enableCommand = mocks.callbacks["macosTrafficLights.enable"];
    expect(enableCommand).toBeDefined();
    if (enableCommand === undefined) {
      throw new Error("Enable command was not registered.");
    }

    const first = enableCommand();
    await vi.waitFor(() =>
      expect(mocks.showErrorMessage).toHaveBeenCalledOnce(),
    );

    mocks.applyError = undefined;
    const second = enableCommand();
    await vi.waitFor(() =>
      expect(
        mocks.lines.filter((line) => line.includes("Enable started.")),
      ).toHaveLength(2),
    );
    await Promise.all([first, second]);
  });

  it("does not let an unresolved interrupted-Disable startup action delay a later operation", async () => {
    mocks.state.current = {
      ...mocks.state.current,
      disablePending: true,
      pendingReload: true,
    };
    mocks.showWarningMessage.mockReturnValue(unresolvedNotification());

    await expectLaterOperationStarts(
      () =>
        reconcileOnActivation(
          context(),
          mocks.output as unknown as OutputChannel,
        ),
      mocks.showWarningMessage,
    );
  });

  it("does not let an unresolved pending-reload startup action delay a later operation", async () => {
    mocks.state.current = {
      ...mocks.state.current,
      enabled: true,
      pendingReload: true,
    };
    mocks.showWarningMessage.mockReturnValue(unresolvedNotification());

    await expectLaterOperationStarts(
      () =>
        reconcileOnActivation(
          context(),
          mocks.output as unknown as OutputChannel,
        ),
      mocks.showWarningMessage,
    );
  });

  it.each([
    {
      action: "Resume Disable",
      command: "macosTrafficLights.disable",
      state: { disablePending: true, pendingReload: true },
    },
    {
      action: "Reapply now",
      command: "macosTrafficLights.reapply",
      state: { enabled: true, pendingReload: true },
    },
  ])(
    "queues $command only when its exact startup action is selected",
    async ({ action, command, state }) => {
      mocks.state.current = { ...mocks.state.current, ...state };
      mocks.showWarningMessage.mockResolvedValue(action);

      await reconcileOnActivation(
        context(),
        mocks.output as unknown as OutputChannel,
      );

      await vi.waitFor(() =>
        expect(mocks.executeCommand).toHaveBeenCalledWith(command),
      );
    },
  );

  it("records a rejected startup action notification without retaining the queue", async () => {
    mocks.state.current = {
      ...mocks.state.current,
      disablePending: true,
      pendingReload: true,
    };
    mocks.showWarningMessage.mockRejectedValue(
      new Error("notification transport unavailable"),
    );

    await expectLaterOperationStarts(
      () =>
        reconcileOnActivation(
          context(),
          mocks.output as unknown as OutputChannel,
        ),
      mocks.showWarningMessage,
    );
    await vi.waitFor(() =>
      expect(mocks.lines).toContain(
        "Startup action notification failed safely: notification transport unavailable",
      ),
    );
  });

  it("records a rejected Enable result banner without failing the command", async () => {
    mocks.state.current = { ...mocks.state.current, enabled: true };
    mocks.showInformationMessage.mockRejectedValue(
      new Error("notification transport unavailable"),
    );

    await executeApply(
      context(),
      mocks.output as unknown as OutputChannel,
      "enable",
    );
    await vi.waitFor(() =>
      expect(mocks.lines).toContain(
        "Enable/Reapply result notification failed safely: notification transport unavailable",
      ),
    );
  });

  it("records a rejected incomplete-Disable banner without failing recovery", async () => {
    mocks.state.current = { ...mocks.state.current, enabled: true };
    mocks.dependencyAvailable = false;
    mocks.showWarningMessage.mockRejectedValue(
      new Error("notification transport unavailable"),
    );

    await disable(context(), mocks.output as unknown as OutputChannel);
    await vi.waitFor(() =>
      expect(mocks.lines).toContain(
        "Disable result notification failed safely: notification transport unavailable",
      ),
    );
    expect(mocks.state.current).toMatchObject({
      disablePending: true,
      enabled: false,
      pendingReload: true,
    });
  });

  it("records a rejected command-error banner without rejecting the command", async () => {
    mocks.applyError = new Error("temporary configuration failure");
    mocks.showErrorMessage.mockRejectedValue(
      new Error("notification transport unavailable"),
    );
    activate(context());
    const enableCommand = mocks.callbacks["macosTrafficLights.enable"];
    expect(enableCommand).toBeDefined();
    if (enableCommand === undefined) {
      throw new Error("Enable command was not registered.");
    }

    await enableCommand();
    await vi.waitFor(() =>
      expect(mocks.lines).toContain(
        "Command error notification failed safely: notification transport unavailable",
      ),
    );
  });
});

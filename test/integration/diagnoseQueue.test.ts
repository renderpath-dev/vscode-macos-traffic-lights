import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";

const vscodeMocks = vi.hoisted(() => {
  const currentUri =
    "file:///c%3A/extensions/renderpath-dev.vscode-macos-traffic-lights-0.1.0/assets/macos-traffic-lights.css";
  const defaultGet = (key: string, defaultValue?: unknown): unknown => {
    switch (key) {
      case "custom-ui-style.external.imports":
        return [];
      case "custom-ui-style.external.loadStrategy":
        return "refetch";
      case "window.controlsStyle":
        return "native";
      case "window.titleBarStyle":
        return "custom";
      default:
        return defaultValue;
    }
  };
  const defaultInspect = (key: string): object | undefined => {
    switch (key) {
      case "custom-ui-style.external.imports":
        return { defaultValue: [] };
      case "window.controlsStyle":
        return { defaultValue: "native" };
      case "window.titleBarStyle":
        return { defaultValue: "custom" };
      default:
        return undefined;
    }
  };
  const configuration = {
    get: vi.fn(defaultGet),
    inspect: vi.fn(defaultInspect),
    update: vi.fn(),
  };

  return {
    configuration,
    currentUri,
    defaultGet,
    defaultInspect,
    showInformationMessage: vi.fn(),
  };
});

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  ConfigurationTarget: { Global: 1 },
  env: {
    appHost: "desktop",
    appName: "Visual Studio Code",
    uiKind: 1,
  },
  extensions: {
    getExtension: vi.fn(() => ({ isActive: true })),
  },
  UIKind: { Desktop: 1 },
  Uri: {
    joinPath: vi.fn(() => ({
      scheme: "file",
      toString: () => vscodeMocks.currentUri,
    })),
  },
  version: "1.132.0",
  window: {
    showInformationMessage: vscodeMocks.showInformationMessage,
  },
  workspace: {
    getConfiguration: vi.fn(() => vscodeMocks.configuration),
  },
}));

import { diagnose } from "../../src/commands/diagnose";
import { OperationQueue } from "../../src/operationQueue";

describe("Diagnose operation queue boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vscodeMocks.configuration.get.mockImplementation(vscodeMocks.defaultGet);
    vscodeMocks.configuration.inspect.mockImplementation(
      vscodeMocks.defaultInspect,
    );
  });

  it("reports effective imports when a narrower scope overrides the global value", async () => {
    vscodeMocks.configuration.get.mockImplementation(
      (key: string, defaultValue?: unknown): unknown =>
        key === "custom-ui-style.external.imports"
          ? [vscodeMocks.currentUri, "https://example.com/effective.css"]
          : vscodeMocks.defaultGet(key, defaultValue),
    );
    vscodeMocks.configuration.inspect.mockImplementation((key: string) =>
      key === "custom-ui-style.external.imports"
        ? {
            defaultValue: [],
            globalValue: [
              "file:///c%3A/extensions/renderpath-dev.vscode-macos-traffic-lights-0.0.9/assets/macos-traffic-lights.css",
            ],
          }
        : vscodeMocks.defaultInspect(key),
    );
    vscodeMocks.showInformationMessage.mockResolvedValue(undefined);

    const appendedLines: string[] = [];
    const output = {
      appendLine: vi.fn((line: string) => appendedLines.push(line)),
      clear: vi.fn(),
      show: vi.fn(),
    } as unknown as OutputChannel;
    const context = {
      extension: { id: "renderpath-dev.vscode-macos-traffic-lights" },
      extensionUri: { scheme: "file" },
      globalState: { get: vi.fn(() => undefined) },
    } as unknown as ExtensionContext;

    await diagnose(context, output);

    expect(appendedLines[0]).toContain(
      "Current extension CSS import registered: yes",
    );
    expect(appendedLines[0]).toContain("Stale owned CSS imports: 0");
    expect(appendedLines[0]).toContain("Unrelated external imports: 1");
  });

  it("does not let an unresolved passive notification delay Enable", async () => {
    let notificationSettled = false;
    const unresolvedNotification = new Promise<undefined>(() => undefined).then(
      (value) => {
        notificationSettled = true;
        return value;
      },
    );
    vscodeMocks.showInformationMessage.mockReturnValue(unresolvedNotification);

    const appendedLines: string[] = [];
    const appendLine = vi.fn((line: string) => appendedLines.push(line));
    const clearOutput = vi.fn();
    const showOutput = vi.fn();
    const output = {
      appendLine,
      clear: clearOutput,
      show: showOutput,
    } as unknown as OutputChannel;
    const context = {
      extension: {
        id: "renderpath-dev.vscode-macos-traffic-lights",
      },
      extensionUri: { scheme: "file" },
      globalState: {
        get: vi.fn(() => undefined),
      },
    } as unknown as ExtensionContext;
    const queue = new OperationQueue();
    let enableStarted = false;

    const diagnoseCommand = queue.run(() => diagnose(context, output));

    await vi.waitFor(() => {
      expect(clearOutput).toHaveBeenCalledOnce();
      expect(appendLine).toHaveBeenCalled();
      expect(showOutput).toHaveBeenCalledWith(true);
      expect(vscodeMocks.showInformationMessage).toHaveBeenCalledOnce();
    });
    expect(appendedLines[0]).toContain("macOS Traffic Lights diagnostics");
    expect(notificationSettled).toBe(false);

    const enableCommand = queue.run(() => {
      enableStarted = true;
      output.appendLine("[test] Enable started.");
      return Promise.resolve();
    });

    await vi.waitFor(() => expect(enableStarted).toBe(true), {
      timeout: 250,
    });
    await Promise.all([diagnoseCommand, enableCommand]);

    expect(appendedLines.at(-1)).toBe("[test] Enable started.");
    expect(notificationSettled).toBe(false);
  });
});

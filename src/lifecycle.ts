import {
  commands,
  window,
  type ExtensionContext,
  type OutputChannel,
} from "vscode";

import { classifyEnvironment } from "./compatibility/environment";
import { detectRuntimeEnvironment } from "./compatibility/runtime";
import {
  loadExtensionState,
  saveExtensionState,
  withKnownOwnedUri,
} from "./configuration/restorationState";
import { COMMANDS } from "./constants";
import { errorMessage } from "./errors";
import {
  getCustomUiStyleExtension,
  readExternalImports,
  updateExternalImports,
} from "./integration/customUiStyle";
import { reconcileExternalImports } from "./resources/externalImports";
import { createImportOwnership, cssAssetUri } from "./commands/shared";

export async function reconcileOnActivation(
  context: ExtensionContext,
  output: OutputChannel,
): Promise<void> {
  const state = loadExtensionState(context.globalState);
  if (state.disablePending) {
    const action = "Resume Disable";
    showQueuedCommandNotification(
      "macOS Traffic Lights has an interrupted Disable operation. Resume it to finish removing generated CSS safely.",
      action,
      COMMANDS.disable,
      output,
    );
    return;
  }
  if (
    !state.enabled ||
    classifyEnvironment(detectRuntimeEnvironment()).status === "unsupported" ||
    getCustomUiStyleExtension() === undefined
  ) {
    return;
  }

  try {
    const currentUri = cssAssetUri(context);
    const nextState = withKnownOwnedUri(state, currentUri);
    await saveExtensionState(context.globalState, nextState);
    const imports = readExternalImports();
    const initialReconciliation = reconcileExternalImports(
      imports.global ?? imports.effective,
      createImportOwnership(context, currentUri, nextState.knownOwnedUris),
    );
    if (!initialReconciliation.changed && !state.pendingReload) {
      return;
    }

    if (initialReconciliation.changed) {
      await saveExtensionState(context.globalState, {
        ...nextState,
        pendingReload: true,
      });
      const latestImports = readExternalImports();
      const latestReconciliation = reconcileExternalImports(
        latestImports.global ?? latestImports.effective,
        createImportOwnership(context, currentUri, nextState.knownOwnedUris),
      );
      if (latestReconciliation.changed) {
        await updateExternalImports(latestReconciliation.imports);
      }
    }
    const action = "Reapply now";
    showQueuedCommandNotification(
      initialReconciliation.changed
        ? "macOS Traffic Lights updated its versioned CSS import. Reapply to rebuild Custom UI Style; select Cancel on every Restart APP prompt, inspect Custom UI Style output, then normally relaunch only the intended Visual Studio Code application."
        : "macOS Traffic Lights has a pending reload. Reapply to rebuild Custom UI Style; select Cancel on every Restart APP prompt, inspect Custom UI Style output, then normally relaunch only the intended Visual Studio Code application.",
      action,
      COMMANDS.reapply,
      output,
    );
  } catch (error) {
    output.appendLine(
      `Startup reconciliation did not complete: ${errorMessage(error)}`,
    );
  }
}

function showQueuedCommandNotification(
  message: string,
  action: string,
  command: string,
  output: OutputChannel,
): void {
  // Startup action banners are passive. Waiting for their selection lifetime
  // here would occupy the shared mutation queue and indefinitely delay an
  // explicit command after the toast moves into the notification center.
  void window.showWarningMessage(message, action).then(
    (selection) => {
      if (selection === action) {
        executeQueuedCommandWithoutWaiting(command, output);
      }
    },
    (error: unknown) => {
      output.appendLine(
        `Startup action notification failed safely: ${errorMessage(error)}`,
      );
    },
  );
}

function executeQueuedCommandWithoutWaiting(
  command: string,
  output: OutputChannel,
): void {
  void commands.executeCommand(command).then(undefined, (error: unknown) => {
    output.appendLine(
      `Could not start queued command ${command}: ${errorMessage(error)}`,
    );
  });
}

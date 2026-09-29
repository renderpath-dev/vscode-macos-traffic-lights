import { window, type ExtensionContext, type OutputChannel } from "vscode";

import {
  inspectManagedSetting,
  updateManagedSetting,
} from "../configuration/managedSettings";
import {
  createEmptyState,
  decideRestoration,
  loadExtensionState,
  saveExtensionState,
  type ExtensionState,
} from "../configuration/restorationState";
import { errorMessage } from "../errors";
import {
  getCustomUiStyleExtension,
  readExternalImports,
  reloadCustomUiStyle,
  updateExternalImports,
} from "../integration/customUiStyle";
import { jsonEquals } from "../json";
import { removeOwnedExternalImports } from "../resources/externalImports";
import { createImportOwnership, cssAssetUri } from "./shared";

export async function disable(
  context: ExtensionContext,
  output: OutputChannel,
): Promise<void> {
  const originalState = loadExtensionState(context.globalState);
  const currentUri = cssAssetUri(context);
  const ownership = createImportOwnership(
    context,
    currentUri,
    originalState.knownOwnedUris,
  );
  let state: ExtensionState = originalState;
  let transactionStarted =
    state.enabled || state.disablePending || state.pendingReload;
  let changed = false;
  let importsRemoved = 0;
  let restoredSettings = 0;
  const preservedSettings: string[] = [];
  let cleanupError: string | undefined;

  const recordCleanupError = (message: string): void => {
    cleanupError =
      cleanupError === undefined ? message : `${cleanupError}; ${message}`;
  };

  const beginTransaction = async (): Promise<void> => {
    if (transactionStarted && state.disablePending && state.pendingReload) {
      return;
    }
    state = {
      ...state,
      disablePending: true,
      enabled: false,
      pendingReload: true,
    };
    await saveExtensionState(context.globalState, state);
    transactionStarted = true;
  };

  if (transactionStarted) {
    await beginTransaction();
  }

  try {
    const initialImports = readExternalImports();
    const initialRemoval = removeOwnedExternalImports(
      initialImports.global ?? initialImports.effective,
      ownership,
    );
    if (initialRemoval.changed) {
      await beginTransaction();

      // Re-read after persisting the transaction so no awaited state write sits
      // between the final merge and the configuration update.
      const latestImports = readExternalImports();
      const latestRemoval = removeOwnedExternalImports(
        latestImports.global ?? latestImports.effective,
        ownership,
      );
      if (latestRemoval.changed) {
        let nextValue: typeof latestRemoval.imports | undefined =
          latestRemoval.imports;
        if (
          state.externalImports?.baselineGlobal.kind === "absent" &&
          jsonEquals(
            latestRemoval.imports,
            state.externalImports.baselineEffective,
          )
        ) {
          nextValue = undefined;
        }
        await updateExternalImports(nextValue);
        changed = true;
        importsRemoved = latestRemoval.ownedRemoved;
      }
    }
  } catch (error) {
    recordCleanupError(
      `Could not inspect or remove the owned CSS import: ${errorMessage(error)}`,
    );
  }

  for (const record of state.managedSettings) {
    let inspection: ReturnType<typeof inspectManagedSetting>;
    try {
      inspection = inspectManagedSetting(record.key);
    } catch (error) {
      await beginTransaction();
      recordCleanupError(
        `Could not inspect or restore ${record.key}: ${errorMessage(error)}`,
      );
      continue;
    }

    const decision = decideRestoration(record, inspection.globalValue);
    switch (decision.kind) {
      case "no-extension-write":
        break;
      case "preserve-user-change":
        preservedSettings.push(record.key);
        break;
      case "remove-explicit-value":
        await beginTransaction();
        try {
          await updateManagedSetting(record.key, undefined);
        } catch (error) {
          recordCleanupError(
            `Could not inspect or restore ${record.key}: ${errorMessage(error)}`,
          );
          break;
        }
        changed = true;
        restoredSettings += 1;
        break;
      case "restore-value":
        await beginTransaction();
        try {
          await updateManagedSetting(record.key, decision.value);
        } catch (error) {
          recordCleanupError(
            `Could not inspect or restore ${record.key}: ${errorMessage(error)}`,
          );
          break;
        }
        changed = true;
        restoredSettings += 1;
        break;
    }
  }

  const shouldReload = transactionStarted || changed;
  let reloadError: string | undefined;
  let completed = !shouldReload && cleanupError === undefined;
  if (shouldReload && cleanupError === undefined) {
    if (getCustomUiStyleExtension() === undefined) {
      reloadError =
        "Custom UI Style is unavailable, so its generated CSS could not be rebuilt.";
    } else {
      try {
        await reloadCustomUiStyle();
        completed = true;
      } catch (error) {
        reloadError = `Custom UI Style reload could not be requested: ${errorMessage(error)}`;
      }
    }
  }

  if (completed && shouldReload) {
    await saveExtensionState(
      context.globalState,
      createEmptyState([...state.knownOwnedUris, currentUri]),
    );
  }

  const preservationNote =
    preservedSettings.length === 0
      ? ""
      : ` Preserved user changes to ${preservedSettings.join(" and ")}.`;
  let message: string;
  if (!shouldReload && cleanupError === undefined) {
    message = `macOS Traffic Lights was already disabled.${preservationNote}`;
  } else if (completed) {
    message =
      `macOS Traffic Lights disable configuration applied: removed ${importsRemoved} owned CSS import${importsRemoved === 1 ? "" : "s"} and restored ${restoredSettings} setting${restoredSettings === 1 ? "" : "s"}. ` +
      `Custom UI Style reload was requested; select Cancel on every Restart APP prompt, inspect Custom UI Style output, then normally relaunch only the intended Visual Studio Code application.${preservationNote}`;
  } else {
    const reason = cleanupError ?? reloadError ?? "Reload remains pending.";
    message =
      `macOS Traffic Lights Disable is incomplete. ${reason} ` +
      `Retained cleanup progress: removed ${importsRemoved} owned CSS import${importsRemoved === 1 ? "" : "s"} and restored ${restoredSettings} setting${restoredSettings === 1 ? "" : "s"}. ` +
      `Correct the problem and run Disable again.${preservationNote}`;
  }

  output.appendLine(message);
  const notification = completed
    ? window.showInformationMessage(message)
    : window.showWarningMessage(message);
  // Result banners are passive. The persisted transaction is already final,
  // so notification lifetime must not occupy the shared command queue.
  void notification.then(undefined, (error: unknown) => {
    output.appendLine(
      `Disable result notification failed safely: ${errorMessage(error)}`,
    );
  });
}

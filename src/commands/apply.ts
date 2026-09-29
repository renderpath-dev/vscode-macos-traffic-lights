import { window, type ExtensionContext, type OutputChannel } from "vscode";

import {
  assertNoManagedSettingOverride,
  inspectManagedSetting,
  MANAGED_SETTINGS,
  updateManagedSetting,
} from "../configuration/managedSettings";
import {
  captureManagedSetting,
  loadExtensionState,
  saveExtensionState,
  withKnownOwnedUri,
  withManagedSetting,
  type ExplicitValue,
  type ExtensionState,
  type ExternalImportsRecord,
  type ManagedSettingRecord,
} from "../configuration/restorationState";
import {
  assertExternalLoadingEnabled,
  readExternalImports,
  reloadCustomUiStyle,
  requireCustomUiStyleExtension,
  updateExternalImports,
  type ExternalLoadStrategy,
} from "../integration/customUiStyle";
import { errorMessage, UserFacingError } from "../errors";
import type { JsonValue } from "../json";
import { reconcileExternalImports } from "../resources/externalImports";
import {
  assertSupportedRuntime,
  createImportOwnership,
  cssAssetUri,
} from "./shared";

export type ApplyMode = "enable" | "reapply";

interface ApplyResult {
  readonly importChanged: boolean;
  readonly loadStrategy: ExternalLoadStrategy;
  readonly settingsChanged: number;
  readonly staleImportsRemoved: number;
}

function externalImportsBaseline(
  globalValue: JsonValue[] | undefined,
  effectiveValue: JsonValue[],
): ExternalImportsRecord {
  const baselineGlobal: ExplicitValue<JsonValue[]> =
    globalValue === undefined
      ? { kind: "absent" }
      : { kind: "value", value: globalValue };
  return {
    baselineEffective: effectiveValue,
    baselineGlobal,
  };
}

async function prepareState(
  context: ExtensionContext,
  currentUri: string,
): Promise<ExtensionState> {
  const previous = loadExtensionState(context.globalState);
  if (previous.enabled) {
    const state = {
      ...withKnownOwnedUri(previous, currentUri),
      disablePending: false,
      pendingReload: true,
    };
    await saveExtensionState(context.globalState, state);
    return state;
  }

  const inspections = MANAGED_SETTINGS.map((definition) =>
    inspectManagedSetting(definition.key),
  );
  inspections.forEach(assertNoManagedSettingOverride);
  const imports = readExternalImports();

  const state: ExtensionState = {
    disablePending: false,
    enabled: true,
    externalImports: externalImportsBaseline(imports.global, imports.effective),
    knownOwnedUris: [...new Set([...previous.knownOwnedUris, currentUri])],
    managedSettings: inspections.map((inspection) =>
      captureManagedSetting(inspection.key, inspection.globalValue),
    ),
    pendingReload: true,
    schemaVersion: 1,
  };
  await saveExtensionState(context.globalState, state);
  return state;
}

async function applyManagedSettings(
  context: ExtensionContext,
  initialState: ExtensionState,
): Promise<{ readonly changed: number; readonly state: ExtensionState }> {
  let state = initialState;
  let changed = 0;
  const preflightInspections = new Map(
    MANAGED_SETTINGS.map((definition) => {
      const inspection = inspectManagedSetting(definition.key);
      assertNoManagedSettingOverride(inspection);
      return [definition.key, inspection] as const;
    }),
  );

  for (const definition of MANAGED_SETTINGS) {
    const inspection = preflightInspections.get(definition.key);
    if (inspection === undefined) {
      throw new Error(`Missing preflight inspection for ${definition.key}.`);
    }
    let record = state.managedSettings.find(
      (candidate) => candidate.key === definition.key,
    );
    if (record === undefined) {
      record = captureManagedSetting(definition.key, inspection.globalValue);
      state = withManagedSetting(state, record);
      await saveExtensionState(context.globalState, state);
    }

    if (inspection.effectiveValue !== definition.value) {
      const pending: ManagedSettingRecord = {
        ...record,
        pendingWrite: true,
      };
      state = withManagedSetting(state, pending);
      await saveExtensionState(context.globalState, state);

      await updateManagedSetting(definition.key, definition.value);
      const written: ManagedSettingRecord = {
        ...pending,
        extensionWrote: true,
        pendingWrite: false,
      };
      state = withManagedSetting(state, written);
      await saveExtensionState(context.globalState, state);
      changed += 1;
    } else if (record.pendingWrite) {
      const recovered: ManagedSettingRecord = {
        ...record,
        extensionWrote: true,
        pendingWrite: false,
      };
      state = withManagedSetting(state, recovered);
      await saveExtensionState(context.globalState, state);
    }

    const effective = inspectManagedSetting(definition.key).effectiveValue;
    if (effective !== definition.value) {
      throw new Error(
        `${definition.key} did not become “${definition.value}”; an overriding configuration scope may be active.`,
      );
    }
  }

  return { changed, state };
}

async function applyConfiguration(
  context: ExtensionContext,
): Promise<ApplyResult> {
  assertSupportedRuntime();
  requireCustomUiStyleExtension();
  const loadStrategy = assertExternalLoadingEnabled();
  const currentUri = cssAssetUri(context);
  let state = await prepareState(context, currentUri);

  const managed = await applyManagedSettings(context, state);
  state = managed.state;

  const ownership = createImportOwnership(
    context,
    currentUri,
    state.knownOwnedUris,
  );

  state = withKnownOwnedUri(state, currentUri);
  await saveExtensionState(context.globalState, state);
  const latestImports = readExternalImports();
  const latestSourceImports = latestImports.global ?? latestImports.effective;
  const latestReconciliation = reconcileExternalImports(
    latestSourceImports,
    ownership,
  );
  if (latestReconciliation.changed) {
    await updateExternalImports(latestReconciliation.imports);
  }

  await reloadCustomUiStyle();
  state = { ...state, pendingReload: false };
  await saveExtensionState(context.globalState, state);
  return {
    importChanged: latestReconciliation.changed,
    loadStrategy,
    settingsChanged: managed.changed,
    staleImportsRemoved: latestReconciliation.staleRemoved,
  };
}

function resultMessage(mode: ApplyMode, result: ApplyResult): string {
  const action = mode === "enable" ? "Enable" : "Reapply";
  const repairs = [
    result.settingsChanged === 1
      ? "1 titlebar setting updated"
      : `${result.settingsChanged} titlebar settings updated`,
    result.importChanged
      ? "CSS import reconciled"
      : "CSS import already current",
  ];
  if (result.staleImportsRemoved > 0) {
    repairs.push(
      `${result.staleImportsRemoved} stale owned import${result.staleImportsRemoved === 1 ? "" : "s"} removed`,
    );
  }
  if (result.loadStrategy === "cache") {
    repairs.push("Custom UI Style cache mode retained");
  }
  return `macOS Traffic Lights ${action} configuration registered: ${repairs.join("; ")}. Custom UI Style reload was requested; select Cancel on every Restart APP prompt, inspect Custom UI Style output, then normally relaunch only the intended Visual Studio Code application and verify the result.`;
}

export async function executeApply(
  context: ExtensionContext,
  output: OutputChannel,
  mode: ApplyMode,
): Promise<void> {
  const existing = loadExtensionState(context.globalState);
  if (existing.disablePending) {
    throw new UserFacingError(
      "Disable cleanup is still pending. Run Disable again before enabling or reapplying so the original restoration baseline is not lost.",
    );
  }
  if (mode === "reapply" && !existing.enabled) {
    throw new UserFacingError(
      "macOS Traffic Lights is disabled. Run Enable first.",
    );
  }

  const result = await applyConfiguration(context);
  const message = resultMessage(mode, result);
  output.appendLine(message);
  // Result banners are passive. Keeping this promise unresolved must not hold
  // the shared command queue and make a later mutation appear unresponsive.
  void window
    .showInformationMessage(message)
    .then(undefined, (error: unknown) => {
      output.appendLine(
        `Enable/Reapply result notification failed safely: ${errorMessage(error)}`,
      );
    });
}

import type { Memento } from "vscode";

import { EXTENSION_STATE_KEY } from "../constants";
import { UserFacingError } from "../errors";
import { isJsonValue, type JsonValue } from "../json";

export type ManagedSettingKey = "window.controlsStyle" | "window.titleBarStyle";

export type ExplicitValue<T> =
  { readonly kind: "absent" } | { readonly kind: "value"; readonly value: T };

export interface ManagedSettingRecord {
  readonly baseline: ExplicitValue<string>;
  readonly desiredValue: "custom";
  readonly extensionWrote: boolean;
  readonly key: ManagedSettingKey;
  readonly pendingWrite: boolean;
}

export interface ExternalImportsRecord {
  readonly baselineEffective: JsonValue[];
  readonly baselineGlobal: ExplicitValue<JsonValue[]>;
}

export interface ExtensionState {
  readonly disablePending: boolean;
  readonly enabled: boolean;
  readonly externalImports: ExternalImportsRecord | null;
  readonly knownOwnedUris: readonly string[];
  readonly managedSettings: readonly ManagedSettingRecord[];
  readonly pendingReload: boolean;
  readonly schemaVersion: 1;
}

export type ExtensionStateInspection =
  | { readonly state: ExtensionState; readonly status: "absent" | "valid" }
  | { readonly status: "invalid" };

export type RestorationDecision =
  | { readonly kind: "no-extension-write" }
  | { readonly kind: "preserve-user-change" }
  | { readonly kind: "remove-explicit-value" }
  | { readonly kind: "restore-value"; readonly value: string };

export function createEmptyState(
  knownOwnedUris: readonly string[] = [],
): ExtensionState {
  return {
    disablePending: false,
    enabled: false,
    externalImports: null,
    knownOwnedUris: [...new Set(knownOwnedUris)],
    managedSettings: [],
    pendingReload: false,
    schemaVersion: 1,
  };
}

export function captureManagedSetting(
  key: ManagedSettingKey,
  globalValue: string | undefined,
): ManagedSettingRecord {
  return {
    baseline:
      globalValue === undefined
        ? { kind: "absent" }
        : { kind: "value", value: globalValue },
    desiredValue: "custom",
    extensionWrote: false,
    key,
    pendingWrite: false,
  };
}

export function decideRestoration(
  record: ManagedSettingRecord,
  currentGlobalValue: string | undefined,
): RestorationDecision {
  if (!record.extensionWrote && !record.pendingWrite) {
    return { kind: "no-extension-write" };
  }

  if (currentGlobalValue !== record.desiredValue) {
    return { kind: "preserve-user-change" };
  }

  return record.baseline.kind === "absent"
    ? { kind: "remove-explicit-value" }
    : { kind: "restore-value", value: record.baseline.value };
}

export function withManagedSetting(
  state: ExtensionState,
  record: ManagedSettingRecord,
): ExtensionState {
  const records = state.managedSettings.filter(
    (candidate) => candidate.key !== record.key,
  );
  records.push(record);
  return { ...state, managedSettings: records };
}

export function withKnownOwnedUri(
  state: ExtensionState,
  uri: string,
): ExtensionState {
  return {
    ...state,
    knownOwnedUris: [...new Set([...state.knownOwnedUris, uri])],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringExplicitValue(
  value: unknown,
): ExplicitValue<string> | undefined {
  if (
    !isObject(value) ||
    (value["kind"] !== "absent" && value["kind"] !== "value")
  ) {
    return undefined;
  }
  if (value["kind"] === "absent") {
    return { kind: "absent" };
  }
  return typeof value["value"] === "string"
    ? { kind: "value", value: value["value"] }
    : undefined;
}

function parseJsonArrayExplicitValue(
  value: unknown,
): ExplicitValue<JsonValue[]> | undefined {
  if (
    !isObject(value) ||
    (value["kind"] !== "absent" && value["kind"] !== "value")
  ) {
    return undefined;
  }
  if (value["kind"] === "absent") {
    return { kind: "absent" };
  }
  if (!Array.isArray(value["value"]) || !value["value"].every(isJsonValue)) {
    return undefined;
  }
  return { kind: "value", value: value["value"] };
}

function parseManagedSetting(value: unknown): ManagedSettingRecord | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  if (
    value["key"] !== "window.controlsStyle" &&
    value["key"] !== "window.titleBarStyle"
  ) {
    return undefined;
  }
  const baseline = parseStringExplicitValue(value["baseline"]);
  if (
    baseline === undefined ||
    value["desiredValue"] !== "custom" ||
    typeof value["extensionWrote"] !== "boolean" ||
    typeof value["pendingWrite"] !== "boolean"
  ) {
    return undefined;
  }
  return {
    baseline,
    desiredValue: "custom",
    extensionWrote: value["extensionWrote"],
    key: value["key"],
    pendingWrite: value["pendingWrite"],
  };
}

function parseExternalImports(
  value: unknown,
): ExternalImportsRecord | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isObject(value)) {
    return undefined;
  }
  const baselineGlobal = parseJsonArrayExplicitValue(value["baselineGlobal"]);
  if (
    baselineGlobal === undefined ||
    !Array.isArray(value["baselineEffective"]) ||
    !value["baselineEffective"].every(isJsonValue)
  ) {
    return undefined;
  }
  return {
    baselineEffective: value["baselineEffective"],
    baselineGlobal,
  };
}

export function parseExtensionState(
  value: unknown,
): ExtensionState | undefined {
  if (
    !isObject(value) ||
    value["schemaVersion"] !== 1 ||
    typeof value["enabled"] !== "boolean" ||
    !Array.isArray(value["knownOwnedUris"]) ||
    !value["knownOwnedUris"].every((uri) => typeof uri === "string") ||
    !Array.isArray(value["managedSettings"])
  ) {
    return undefined;
  }
  const managedSettings = value["managedSettings"].map(parseManagedSetting);
  if (managedSettings.some((entry) => entry === undefined)) {
    return undefined;
  }
  const parsedManagedSettings = managedSettings as ManagedSettingRecord[];
  if (
    new Set(parsedManagedSettings.map((record) => record.key)).size !==
    parsedManagedSettings.length
  ) {
    return undefined;
  }
  const externalImports = parseExternalImports(value["externalImports"]);
  if (externalImports === undefined) {
    return undefined;
  }
  const disablePending = value["disablePending"] ?? false;
  const pendingReload = value["pendingReload"] ?? false;
  if (
    typeof disablePending !== "boolean" ||
    typeof pendingReload !== "boolean"
  ) {
    return undefined;
  }
  return {
    disablePending,
    enabled: value["enabled"],
    externalImports,
    knownOwnedUris: [...new Set(value["knownOwnedUris"])],
    managedSettings: parsedManagedSettings,
    pendingReload,
    schemaVersion: 1,
  };
}

export function inspectExtensionState(
  globalState: Memento,
): ExtensionStateInspection {
  const rawState = globalState.get<unknown>(EXTENSION_STATE_KEY);
  if (rawState === undefined) {
    return { state: createEmptyState(), status: "absent" };
  }
  const state = parseExtensionState(rawState);
  if (state === undefined) {
    return { status: "invalid" };
  }
  return { state, status: "valid" };
}

export function loadExtensionState(globalState: Memento): ExtensionState {
  const inspection = inspectExtensionState(globalState);
  if (inspection.status === "invalid") {
    throw new UserFacingError(
      "Saved restoration metadata is invalid or from an unsupported schema. Run Diagnose and preserve that metadata before attempting recovery; no settings were changed.",
    );
  }
  return inspection.state;
}

export async function saveExtensionState(
  globalState: Memento,
  state: ExtensionState,
): Promise<void> {
  await globalState.update(EXTENSION_STATE_KEY, state);
}

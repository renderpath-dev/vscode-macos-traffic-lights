import { ConfigurationTarget, workspace } from "vscode";

import { UserFacingError } from "../errors";
import type { ManagedSettingKey } from "./restorationState";

export interface ManagedSettingDefinition {
  readonly key: ManagedSettingKey;
  readonly value: "custom";
}

export interface ManagedSettingInspection {
  readonly defaultValue: string | undefined;
  readonly effectiveValue: string | undefined;
  readonly globalValue: string | undefined;
  readonly key: ManagedSettingKey;
  readonly workspaceFolderValue: string | undefined;
  readonly workspaceValue: string | undefined;
}

export const MANAGED_SETTINGS: readonly ManagedSettingDefinition[] = [
  { key: "window.titleBarStyle", value: "custom" },
  { key: "window.controlsStyle", value: "custom" },
];

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new UserFacingError(
      `${label} has an unexpected non-string value. Correct that setting before continuing.`,
    );
  }
  return value;
}

export function inspectManagedSetting(
  key: ManagedSettingKey,
): ManagedSettingInspection {
  const configuration = workspace.getConfiguration();
  const inspection = configuration.inspect<unknown>(key);
  if (inspection === undefined) {
    throw new UserFacingError(
      `VS Code does not expose the ${key} setting. This build is not compatible with macOS Traffic Lights.`,
    );
  }

  return {
    defaultValue: optionalString(inspection.defaultValue, `${key} default`),
    effectiveValue: optionalString(configuration.get<unknown>(key), key),
    globalValue: optionalString(inspection.globalValue, `${key} global value`),
    key,
    workspaceFolderValue: optionalString(
      inspection.workspaceFolderValue,
      `${key} workspace-folder value`,
    ),
    workspaceValue: optionalString(
      inspection.workspaceValue,
      `${key} workspace value`,
    ),
  };
}

export function assertNoManagedSettingOverride(
  inspection: ManagedSettingInspection,
): void {
  const conflictingScope =
    inspection.workspaceFolderValue !== undefined
      ? "workspace-folder"
      : inspection.workspaceValue !== undefined
        ? "workspace"
        : undefined;
  const conflictingValue =
    inspection.workspaceFolderValue ?? inspection.workspaceValue;

  if (conflictingScope !== undefined && conflictingValue !== "custom") {
    throw new UserFacingError(
      `${inspection.key} is overridden at ${conflictingScope} scope. Remove that override or set it to “custom”, then run Enable again.`,
    );
  }
}

export async function updateManagedSetting(
  key: ManagedSettingKey,
  value: string | undefined,
): Promise<void> {
  await workspace
    .getConfiguration()
    .update(key, value, ConfigurationTarget.Global);
}

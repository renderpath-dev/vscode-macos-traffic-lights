import {
  commands,
  ConfigurationTarget,
  extensions,
  workspace,
  type Extension,
} from "vscode";

import { CUSTOM_UI_STYLE } from "../constants";
import { UserFacingError } from "../errors";
import { isJsonValue, type JsonValue } from "../json";
import {
  invalidExternalImportIndexes,
  parseExternalLoadStrategy,
  type ExternalLoadStrategy,
} from "./customUiStyleConfig";
import { classifyDependency, type DependencyState } from "./dependencyState";

export type { ExternalLoadStrategy } from "./customUiStyleConfig";

export interface ExternalImportsInspection {
  readonly effective: JsonValue[];
  readonly global: JsonValue[] | undefined;
}

function jsonArray(value: unknown, label: string): JsonValue[] {
  if (!Array.isArray(value) || !value.every(isJsonValue)) {
    throw new UserFacingError(
      `${label} must be an array of valid Custom UI Style import entries.`,
    );
  }
  const invalidIndexes = invalidExternalImportIndexes(value);
  if (invalidIndexes.length > 0) {
    const displayedIndexes = invalidIndexes
      .slice(0, 3)
      .map((index) => index + 1)
      .join(", ");
    throw new UserFacingError(
      `${label} contains unsupported entr${invalidIndexes.length === 1 ? "y" : "ies"} at one-based index${invalidIndexes.length === 1 ? "" : "es"} ${displayedIndexes}. Use Custom UI Style’s documented string or HTTPS object format before continuing.`,
    );
  }
  return value;
}

export function readExternalImports(): ExternalImportsInspection {
  const configuration = workspace.getConfiguration();
  const inspection = configuration.inspect<unknown>(
    CUSTOM_UI_STYLE.externalImportsSetting,
  );
  if (inspection === undefined) {
    throw new UserFacingError(
      "Custom UI Style is unavailable or does not expose its external imports setting.",
    );
  }

  const effectiveValue = configuration.get<unknown>(
    CUSTOM_UI_STYLE.externalImportsSetting,
    [],
  );
  return {
    effective: jsonArray(
      effectiveValue,
      CUSTOM_UI_STYLE.externalImportsSetting,
    ),
    global:
      inspection.globalValue === undefined
        ? undefined
        : jsonArray(
            inspection.globalValue,
            `${CUSTOM_UI_STYLE.externalImportsSetting} global value`,
          ),
  };
}

export function readExternalLoadStrategy(): ExternalLoadStrategy {
  const value = workspace
    .getConfiguration()
    .get<unknown>(CUSTOM_UI_STYLE.externalLoadStrategySetting, "refetch");
  return parseExternalLoadStrategy(value);
}

export async function updateExternalImports(
  value: JsonValue[] | undefined,
): Promise<void> {
  await workspace
    .getConfiguration()
    .update(
      CUSTOM_UI_STYLE.externalImportsSetting,
      value,
      ConfigurationTarget.Global,
    );
}

export function getCustomUiStyleExtension(): Extension<unknown> | undefined {
  return extensions.getExtension<unknown>(CUSTOM_UI_STYLE.extensionId);
}

export function getCustomUiStyleDependencyState(): DependencyState {
  return classifyDependency(getCustomUiStyleExtension());
}

export function requireCustomUiStyleExtension(): Extension<unknown> {
  const extension = getCustomUiStyleExtension();
  if (extension === undefined) {
    throw new UserFacingError(
      `Install and enable ${CUSTOM_UI_STYLE.extensionId}, then run the command again.`,
    );
  }
  return extension;
}

export async function reloadCustomUiStyle(): Promise<void> {
  const extension = requireCustomUiStyleExtension();
  if (!extension.isActive) {
    await extension.activate();
  }
  await commands.executeCommand(CUSTOM_UI_STYLE.reloadCommand);
}

export function assertExternalLoadingEnabled(): ExternalLoadStrategy {
  const strategy = readExternalLoadStrategy();
  if (strategy === "disable") {
    throw new UserFacingError(
      `${CUSTOM_UI_STYLE.externalLoadStrategySetting} is “disable”. Choose “refetch” (recommended) or “cache”, then run the command again.`,
    );
  }
  if (strategy === "invalid") {
    throw new UserFacingError(
      `${CUSTOM_UI_STYLE.externalLoadStrategySetting} has an unsupported value. Choose “refetch” or “cache”.`,
    );
  }
  return strategy;
}

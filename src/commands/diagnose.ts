import {
  env,
  version as vscodeVersion,
  window,
  type ExtensionContext,
  type OutputChannel,
} from "vscode";

import { classifyEnvironment } from "../compatibility/environment";
import { compatibilityRecord } from "../compatibility/record";
import { detectRuntimeEnvironment } from "../compatibility/runtime";
import { classifyVersion } from "../compatibility/vscodeVersion";
import {
  inspectManagedSetting,
  MANAGED_SETTINGS,
} from "../configuration/managedSettings";
import {
  createEmptyState,
  inspectExtensionState,
} from "../configuration/restorationState";
import { errorMessage } from "../errors";
import {
  getCustomUiStyleDependencyState,
  readExternalImports,
  readExternalLoadStrategy,
} from "../integration/customUiStyle";
import { countOwnedExternalImports } from "../resources/externalImports";
import {
  applicationHostLabel,
  createImportOwnership,
  cssAssetUri,
} from "./shared";

function settingValue(value: string | undefined): string {
  return value ?? "<no explicit value>";
}

function dependencyLabel(
  status: "available-active" | "available-inactive" | "unavailable",
): string {
  switch (status) {
    case "available-active":
      return "installed/enabled and active";
    case "available-inactive":
      return "installed/enabled but not active";
    case "unavailable":
      return "not available (not installed or disabled)";
  }
}

export function diagnose(
  context: ExtensionContext,
  output: OutputChannel,
): Promise<void> {
  const runtime = detectRuntimeEnvironment();
  const environmentSupport = classifyEnvironment(runtime);
  const versionCompatibility = classifyVersion(
    vscodeVersion,
    compatibilityRecord.minimumSupportedVersion,
    compatibilityRecord.visuallyTestedVersions,
  );
  const dependency = getCustomUiStyleDependencyState();
  const stateInspection = inspectExtensionState(context.globalState);
  const state =
    stateInspection.status === "invalid"
      ? createEmptyState()
      : stateInspection.state;

  const lines = [
    "macOS Traffic Lights diagnostics",
    `Generated: ${new Date().toISOString()}`,
    `Operating system: ${runtime.platform}`,
    `VS Code version: ${vscodeVersion}`,
    `VS Code application: ${env.appName}`,
    `Application host: ${applicationHostLabel()} (${runtime.uiKind})`,
    `Environment support: ${
      environmentSupport.status === "supported"
        ? "supported"
        : `unsupported — ${environmentSupport.reason}`
    }`,
    `Version compatibility: ${
      versionCompatibility === undefined
        ? "unknown (unparseable version)"
        : versionCompatibility.status.replaceAll("-", " ")
    }`,
    `Custom UI Style: ${dependencyLabel(dependency.status)}`,
    `Extension lifecycle state: ${
      stateInspection.status === "invalid"
        ? "INVALID — mutating commands are blocked to protect restoration data"
        : state.disablePending
          ? "disable pending"
          : state.pendingReload
            ? "reload pending"
            : state.enabled
              ? "enabled"
              : "disabled"
    }`,
  ];

  for (const definition of MANAGED_SETTINGS) {
    try {
      const inspection = inspectManagedSetting(definition.key);
      lines.push(
        `${definition.key}: effective=${settingValue(inspection.effectiveValue)}, global=${settingValue(inspection.globalValue)}`,
      );
    } catch (error) {
      lines.push(`${definition.key}: unavailable — ${errorMessage(error)}`);
    }
  }

  if (dependency.status === "unavailable") {
    lines.push(
      "Custom UI Style configuration: not inspected because the dependency is unavailable.",
    );
  } else {
    try {
      const strategy = readExternalLoadStrategy();
      lines.push(
        `Custom UI Style external load strategy: ${strategy}${
          strategy === "disable"
            ? " — conflict: choose refetch or cache before enabling"
            : strategy === "cache"
              ? " — same-URI file edits may remain cached"
              : ""
        }`,
      );
      const imports = readExternalImports();
      const currentUri = cssAssetUri(context);
      const ownership = createImportOwnership(
        context,
        currentUri,
        state.knownOwnedUris,
      );
      const counts = countOwnedExternalImports(imports.effective, ownership);
      lines.push(
        `Current extension CSS import registered: ${counts.current === 1 ? "yes" : `no (count=${counts.current})`}`,
        `Stale owned CSS imports: ${counts.stale}`,
        `Unrelated external imports: ${imports.effective.length - counts.current - counts.stale}`,
      );
    } catch (error) {
      lines.push(
        `Custom UI Style configuration: unavailable — ${errorMessage(error)}`,
      );
    }
  }

  lines.push(
    `Minimum supported VS Code: ${compatibilityRecord.minimumSupportedVersion}`,
    `Upstream source verified through: ${compatibilityRecord.sourceVerifiedThroughVersion}`,
    "No filesystem paths are included in this report.",
  );

  output.clear();
  output.appendLine(lines.join("\n"));
  output.show(true);
  // Passive notifications must not keep the shared OperationQueue occupied.
  void window
    .showInformationMessage(
      "macOS Traffic Lights diagnostics were written to the output panel.",
    )
    .then(undefined, (error: unknown) => {
      output.appendLine(
        `Diagnose result notification failed safely: ${errorMessage(error)}`,
      );
    });
  return Promise.resolve();
}

import {
  env,
  Uri,
  version as vscodeVersion,
  type ExtensionContext,
} from "vscode";

import { classifyEnvironment } from "../compatibility/environment";
import { compatibilityRecord } from "../compatibility/record";
import { detectRuntimeEnvironment } from "../compatibility/runtime";
import { classifyVersion } from "../compatibility/vscodeVersion";
import { CSS_ASSET_PATH } from "../constants";
import { UserFacingError } from "../errors";
import type { ImportOwnership } from "../resources/externalImports";

export function assertSupportedRuntime(): void {
  const environment = classifyEnvironment(detectRuntimeEnvironment());
  if (environment.status === "unsupported") {
    throw new UserFacingError(environment.reason);
  }

  const compatibility = classifyVersion(
    vscodeVersion,
    compatibilityRecord.minimumSupportedVersion,
    compatibilityRecord.visuallyTestedVersions,
  );
  if (compatibility === undefined) {
    throw new UserFacingError(
      `The VS Code version “${vscodeVersion}” could not be evaluated. Run Diagnose for details.`,
    );
  }
  if (compatibility.status === "unsupported") {
    throw new UserFacingError(
      `VS Code ${compatibility.version} is unsupported. Install VS Code ${compatibility.minimumVersion} or newer.`,
    );
  }
}

export function cssAssetUri(context: ExtensionContext): string {
  const uri = Uri.joinPath(context.extensionUri, ...CSS_ASSET_PATH);
  if (uri.scheme !== "file") {
    throw new UserFacingError(
      "The packaged CSS is not exposed as a local file URI. This extension must run in the local desktop UI extension host.",
    );
  }
  return uri.toString();
}

export function createImportOwnership(
  context: ExtensionContext,
  currentUri: string,
  knownUris: readonly string[],
): ImportOwnership {
  return {
    assetFileName: CSS_ASSET_PATH[1],
    assetParentDirectory: CSS_ASSET_PATH[0],
    currentUri,
    extensionId: context.extension.id,
    knownUris,
  };
}

export function applicationHostLabel(): string {
  return "appHost" in env && typeof env.appHost === "string"
    ? env.appHost
    : "desktop";
}

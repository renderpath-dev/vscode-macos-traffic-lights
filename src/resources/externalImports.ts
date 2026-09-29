import { jsonEquals, type JsonValue } from "../json";

export interface ImportOwnership {
  readonly assetFileName: string;
  readonly assetParentDirectory: string;
  readonly currentUri: string;
  readonly extensionId: string;
  readonly knownUris: readonly string[];
}

export interface ImportReconciliation {
  readonly changed: boolean;
  readonly currentWasRegistered: boolean;
  readonly imports: JsonValue[];
  readonly ownedRemoved: number;
  readonly staleRemoved: number;
}

function normalizedUri(value: string): string | undefined {
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function decodedPathSegments(url: URL): string[] | undefined {
  try {
    return decodeURIComponent(url.pathname)
      .replaceAll("\\", "/")
      .split("/")
      .filter((segment) => segment.length > 0);
  } catch {
    return undefined;
  }
}

/**
 * Matches only an exact recorded URI or VS Code's exact versioned extension
 * directory convention plus this project's exact asset tail.
 */
export function isOwnedExternalImport(
  entry: JsonValue,
  ownership: ImportOwnership,
): boolean {
  if (typeof entry !== "string") {
    return false;
  }

  const candidate = normalizedUri(entry);
  if (candidate === undefined) {
    return false;
  }

  const exactUris = [ownership.currentUri, ...ownership.knownUris]
    .map((value) => normalizedUri(value))
    .filter((value): value is string => value !== undefined);
  if (exactUris.includes(candidate)) {
    return true;
  }

  const url = new URL(candidate);
  if (url.protocol !== "file:") {
    return false;
  }

  const segments = decodedPathSegments(url);
  const current = normalizedUri(ownership.currentUri);
  const currentUrl = current === undefined ? undefined : new URL(current);
  const currentSegments =
    currentUrl === undefined ? undefined : decodedPathSegments(currentUrl);
  if (
    segments === undefined ||
    segments.length < 3 ||
    currentUrl?.protocol !== "file:" ||
    currentSegments === undefined ||
    currentSegments.length < 3 ||
    url.host.toLowerCase() !== currentUrl.host.toLowerCase()
  ) {
    return false;
  }

  const candidateParent = segments.slice(0, -3);
  const currentParent = currentSegments.slice(0, -3);
  if (
    candidateParent.length !== currentParent.length ||
    !candidateParent.every(
      (segment, index) =>
        segment.toLowerCase() === currentParent[index]?.toLowerCase(),
    )
  ) {
    return false;
  }

  const assetFile = segments.at(-1);
  const assetDirectory = segments.at(-2);
  const extensionDirectory = segments.at(-3);
  if (
    assetFile !== ownership.assetFileName ||
    assetDirectory !== ownership.assetParentDirectory ||
    extensionDirectory === undefined
  ) {
    return false;
  }

  const extensionId = escapeRegularExpression(ownership.extensionId);
  const versionedDirectory = new RegExp(
    `^${extensionId}-\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:-(?:win32|darwin|linux)-[0-9A-Za-z_-]+)?$`,
    "iu",
  );
  return versionedDirectory.test(extensionDirectory);
}

export function reconcileExternalImports(
  imports: readonly JsonValue[],
  ownership: ImportOwnership,
): ImportReconciliation {
  const currentUri =
    normalizedUri(ownership.currentUri) ?? ownership.currentUri;
  const remaining: JsonValue[] = [];
  let firstOwnedIndex: number | undefined;
  let currentWasRegistered = false;
  let ownedRemoved = 0;
  let staleRemoved = 0;

  for (const entry of imports) {
    if (!isOwnedExternalImport(entry, ownership)) {
      remaining.push(entry);
      continue;
    }

    firstOwnedIndex ??= remaining.length;
    ownedRemoved += 1;
    const entryUri =
      typeof entry === "string" ? normalizedUri(entry) : undefined;
    if (entryUri === currentUri) {
      currentWasRegistered = true;
    } else {
      staleRemoved += 1;
    }
  }

  remaining.splice(
    firstOwnedIndex ?? remaining.length,
    0,
    ownership.currentUri,
  );
  const changed = !jsonEquals(imports as JsonValue[], remaining);
  return {
    changed,
    currentWasRegistered,
    imports: remaining,
    ownedRemoved,
    staleRemoved,
  };
}

export function removeOwnedExternalImports(
  imports: readonly JsonValue[],
  ownership: ImportOwnership,
): Omit<ImportReconciliation, "currentWasRegistered"> {
  const remaining = imports.filter(
    (entry) => !isOwnedExternalImport(entry, ownership),
  );
  let staleRemoved = 0;
  let ownedRemoved = 0;
  const currentUri =
    normalizedUri(ownership.currentUri) ?? ownership.currentUri;

  for (const entry of imports) {
    if (!isOwnedExternalImport(entry, ownership)) {
      continue;
    }
    ownedRemoved += 1;
    const entryUri =
      typeof entry === "string" ? normalizedUri(entry) : undefined;
    if (entryUri !== currentUri) {
      staleRemoved += 1;
    }
  }

  return {
    changed: !jsonEquals(imports as JsonValue[], remaining),
    imports: remaining,
    ownedRemoved,
    staleRemoved,
  };
}

export function countOwnedExternalImports(
  imports: readonly JsonValue[],
  ownership: ImportOwnership,
): { readonly current: number; readonly stale: number } {
  const currentUri =
    normalizedUri(ownership.currentUri) ?? ownership.currentUri;
  let current = 0;
  let stale = 0;

  for (const entry of imports) {
    if (!isOwnedExternalImport(entry, ownership)) {
      continue;
    }

    const candidate =
      typeof entry === "string" ? normalizedUri(entry) : undefined;
    if (candidate === currentUri) {
      current += 1;
    } else {
      stale += 1;
    }
  }

  return { current, stale };
}

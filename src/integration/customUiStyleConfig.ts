import { fileURLToPath } from "node:url";

import type { JsonValue } from "../json";

export type ExternalLoadStrategy = "cache" | "disable" | "invalid" | "refetch";

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function isParseableFileUrl(value: string): boolean {
  try {
    // Custom UI Style resolves these variables before converting the URL to a
    // path. Substitute an absolute placeholder so its documented variable
    // forms can still be validated without depending on the current machine.
    const normalized = value.replace(/\$\{[^{}]+\}/g, "/placeholder");
    if (normalized.includes("${")) {
      return false;
    }
    const url = new URL(normalized);
    if (url.protocol !== "file:") {
      return false;
    }
    fileURLToPath(url);
    return true;
  } catch {
    return false;
  }
}

export function isSupportedExternalImport(entry: JsonValue): boolean {
  if (typeof entry === "string") {
    if (!entry.endsWith(".css") && !entry.endsWith(".js")) {
      return false;
    }
    if (entry.startsWith("file://")) {
      return isParseableFileUrl(entry);
    }
    return entry.startsWith("https://") && parseHttpsUrl(entry) !== undefined;
  }

  if (!isRecord(entry)) {
    return false;
  }
  return (
    (entry["type"] === "css" ||
      entry["type"] === "js" ||
      entry["type"] === "js-module") &&
    typeof entry["url"] === "string" &&
    entry["url"].startsWith("https://") &&
    parseHttpsUrl(entry["url"]) !== undefined
  );
}

export function invalidExternalImportIndexes(
  imports: readonly JsonValue[],
): number[] {
  return imports.flatMap((entry, index) =>
    isSupportedExternalImport(entry) ? [] : [index],
  );
}

export function parseExternalLoadStrategy(
  value: unknown,
): ExternalLoadStrategy {
  return value === "refetch" || value === "cache" || value === "disable"
    ? value
    : "invalid";
}

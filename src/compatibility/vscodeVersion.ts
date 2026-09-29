export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | undefined;
}

export type VersionCompatibility =
  | {
      readonly minimumVersion: string;
      readonly status: "unsupported";
      readonly version: string;
    }
  | {
      readonly status: "supported-and-tested" | "supported-but-untested";
      readonly version: string;
    };

const VERSION_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u;

export function parseVersion(value: string): SemanticVersion | undefined {
  const match = VERSION_PATTERN.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) {
    return undefined;
  }

  return {
    major,
    minor,
    patch,
    prerelease: match[4],
  };
}

export function compareVersions(
  left: SemanticVersion,
  right: SemanticVersion,
): -1 | 0 | 1 {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] < right[key]) {
      return -1;
    }
    if (left[key] > right[key]) {
      return 1;
    }
  }
  return 0;
}

export function normalizedVersion(version: SemanticVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function classifyVersion(
  currentValue: string,
  minimumValue: string,
  visuallyTestedVersions: readonly string[],
): VersionCompatibility | undefined {
  const current = parseVersion(currentValue);
  const minimum = parseVersion(minimumValue);
  if (current === undefined || minimum === undefined) {
    return undefined;
  }

  const version = normalizedVersion(current);
  if (compareVersions(current, minimum) < 0) {
    return {
      minimumVersion: normalizedVersion(minimum),
      status: "unsupported",
      version,
    };
  }

  const tested = visuallyTestedVersions.some((candidate) => {
    const parsed = parseVersion(candidate);
    return parsed !== undefined && normalizedVersion(parsed) === version;
  });

  return {
    status: tested ? "supported-and-tested" : "supported-but-untested",
    version,
  };
}

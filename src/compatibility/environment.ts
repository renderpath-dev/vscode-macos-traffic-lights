export type UiKindName = "desktop" | "web";

export interface RuntimeEnvironment {
  readonly applicationName: string;
  readonly platform: string;
  readonly uiKind: UiKindName;
}

export type EnvironmentSupport =
  | { readonly status: "supported" }
  | {
      readonly reason: string;
      readonly status: "unsupported";
    };

export function classifyEnvironment(
  environment: RuntimeEnvironment,
): EnvironmentSupport {
  if (environment.uiKind !== "desktop") {
    return {
      reason:
        "Browser-based VS Code is not supported; use Microsoft VS Code Desktop.",
      status: "unsupported",
    };
  }

  if (environment.platform !== "win32") {
    return {
      reason: "macOS Traffic Lights version 1 supports Windows only.",
      status: "unsupported",
    };
  }

  if (environment.applicationName !== "Visual Studio Code") {
    return {
      reason: `The application “${environment.applicationName}” is not supported; version 1 targets Microsoft Visual Studio Code.`,
      status: "unsupported",
    };
  }

  return { status: "supported" };
}

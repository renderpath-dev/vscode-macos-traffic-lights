import { env, UIKind } from "vscode";

import type { RuntimeEnvironment } from "./environment";

export function detectRuntimeEnvironment(): RuntimeEnvironment {
  return {
    applicationName: env.appName,
    platform: process.platform,
    uiKind: env.uiKind === UIKind.Desktop ? "desktop" : "web",
  };
}

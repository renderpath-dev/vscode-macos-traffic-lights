export const COMMANDS = {
  diagnose: "macosTrafficLights.diagnose",
  disable: "macosTrafficLights.disable",
  enable: "macosTrafficLights.enable",
  reapply: "macosTrafficLights.reapply",
} as const;

export const CUSTOM_UI_STYLE = {
  extensionId: "subframe7536.custom-ui-style",
  externalImportsSetting: "custom-ui-style.external.imports",
  externalLoadStrategySetting: "custom-ui-style.external.loadStrategy",
  reloadCommand: "custom-ui-style.reload",
} as const;

export const CSS_ASSET_PATH = ["assets", "macos-traffic-lights.css"] as const;

export const EXTENSION_STATE_KEY = "macosTrafficLights.restorationState";

export const OUTPUT_CHANNEL_NAME = "macOS Traffic Lights";

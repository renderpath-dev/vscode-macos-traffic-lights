import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface CommandContribution {
  readonly category: string;
  readonly command: string;
  readonly title: string;
}

interface ProjectManifest {
  readonly activationEvents: readonly string[];
  readonly bugs: {
    readonly url: string;
  };
  readonly contributes: {
    readonly commands: readonly CommandContribution[];
  };
  readonly extensionDependencies?: readonly string[];
  readonly extensionPack: readonly string[];
  readonly extensionKind: readonly string[];
  readonly homepage: string;
  readonly main: string;
  readonly publisher: string;
  readonly repository: {
    readonly type: string;
    readonly url: string;
  };
}

async function manifest(): Promise<ProjectManifest> {
  const text = await readFile(resolve("package.json"), "utf8");
  return JSON.parse(text) as ProjectManifest;
}

describe("packaged extension contract", () => {
  it("is a local UI extension with dependency installation help and commands", async () => {
    const project = await manifest();
    expect(project.extensionKind).toEqual(["ui"]);
    expect(project.publisher).toBe("renderpath-dev");
    expect(project.extensionPack).toEqual(["subframe7536.custom-ui-style"]);
    expect(project.extensionDependencies).toBeUndefined();
    expect(project.repository).toEqual({
      type: "git",
      url: "https://github.com/renderpath-dev/vscode-macos-traffic-lights.git",
    });
    expect(project.homepage).toBe(
      "https://github.com/renderpath-dev/vscode-macos-traffic-lights#readme",
    );
    expect(project.bugs.url).toBe(
      "https://github.com/renderpath-dev/vscode-macos-traffic-lights/issues",
    );
    expect(project.main).toBe("./dist/extension.js");
    expect(project.contributes.commands.map(({ command }) => command)).toEqual([
      "macosTrafficLights.enable",
      "macosTrafficLights.disable",
      "macosTrafficLights.reapply",
      "macosTrafficLights.diagnose",
    ]);
  });

  it("contains only CSS in the injected visual asset", async () => {
    const css = await readFile(
      resolve("assets/macos-traffic-lights.css"),
      "utf8",
    );
    expect(css).toContain(".monaco-workbench.windows");
    expect(css).toContain(".window-close");
    expect(css).toContain(".window-minimize");
    expect(css).toContain(".window-max-restore");
    expect(css).toContain(".fullscreen");
    const nonCounterZoomReservation = css.search(
      /\.monaco-workbench\.windows\s+\.part\.titlebar\s+> \.titlebar-container:not\(\.counter-zoom\):has\(\.window-controls-container\)\s+> \.titlebar-left\s+\{\s+padding-left: calc\(/,
    );
    const fullscreenReset = css.search(
      /\.monaco-workbench\.windows\.fullscreen\s+\.part\.titlebar\s+> \.titlebar-container:has\(\.window-controls-container\)\s+> \.titlebar-left\s+\{\s+padding-left: 0;/,
    );
    expect(nonCounterZoomReservation).toBeGreaterThanOrEqual(0);
    expect(fullscreenReset).toBeGreaterThan(nonCounterZoomReservation);
    expect(css).not.toContain("data:application/javascript");
    expect(css).not.toContain("base64,");
  });

  it("keeps user-facing restart guidance path-scoped and cancellation-safe", async () => {
    const sources = await Promise.all([
      readFile(resolve("src/commands/apply.ts"), "utf8"),
      readFile(resolve("src/commands/disable.ts"), "utf8"),
      readFile(resolve("src/lifecycle.ts"), "utf8"),
    ]);

    for (const source of sources) {
      expect(source).toContain("select Cancel on every Restart APP prompt");
      expect(source).toContain(
        "normally relaunch only the intended Visual Studio Code application",
      );
      expect(source).not.toMatch(/follow its restart prompt/i);
      expect(source).not.toMatch(
        /restart VS Code|complete its restart|restart completes|select Restart APP|click Restart APP|accept (?:the )?Restart APP|allow .*restart/i,
      );
    }
  });
});

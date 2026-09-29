#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM_URL = "https://github.com/microsoft/vscode.git";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_LOCAL_REPOSITORY = path.join(
  PROJECT_ROOT,
  ".reference",
  "vscode",
);

const sourceGroups = {
  windowModel: {
    label: "window configuration model",
    paths: ["src/vs/platform/window/common/window.ts"],
  },
  workbenchTitlebar: {
    label: "workbench titlebar implementation",
    paths: ["src/vs/workbench/browser/parts/titlebar/titlebarPart.ts"],
  },
  titlebarStyles: {
    label: "workbench titlebar stylesheet",
    paths: ["src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css"],
  },
  desktopTitlebar: {
    label: "desktop titlebar implementation",
    paths: [
      "src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts",
      "src/vs/workbench/electron-sandbox/parts/titlebar/titlebarPart.ts",
    ],
  },
};

const contracts = [
  {
    name: "window.controlsStyle configuration property",
    group: "windowModel",
    pattern: /\bcontrolsStyle\s*\??\s*:\s*WindowControlsStyle\b/,
    expected:
      "`controlsStyle` remains represented by the `WindowControlsStyle` type",
  },
  {
    name: "WindowControlsStyle.CUSTOM option",
    group: "windowModel",
    pattern: /\bWindowControlsStyle\s*\.\s*CUSTOM\b/,
    expected: "`WindowControlsStyle.CUSTOM` remains a supported code path",
  },
  {
    name: ".window-controls-container DOM class",
    group: "workbenchTitlebar",
    pattern: /\bwindow-controls-container\b/,
    expected: "the titlebar still creates `window-controls-container`",
  },
  {
    name: ".window-controls-container base selector",
    group: "titlebarStyles",
    pattern: /\.window-controls-container(?![\w-])/,
    expected: "titlebar CSS still defines `.window-controls-container`",
  },
  {
    name: ".window-icon DOM class",
    group: "desktopTitlebar",
    pattern: /\bwindow-icon\b/,
    expected: "desktop titlebar controls still use `window-icon`",
  },
  {
    name: ".window-icon base selector",
    group: "titlebarStyles",
    pattern: /\.window-icon(?![\w-])/,
    expected: "titlebar CSS still defines `.window-icon`",
  },
  {
    name: ".window-minimize control class",
    group: "desktopTitlebar",
    pattern: /\bwindow-minimize\b/,
    expected: "the native minimize control still uses `window-minimize`",
  },
  {
    name: ".window-max-restore control class",
    group: "desktopTitlebar",
    pattern: /\bwindow-max-restore\b/,
    expected:
      "the native maximize/restore control still uses `window-max-restore`",
  },
  {
    name: ".window-close control class",
    group: "desktopTitlebar",
    pattern: /\bwindow-close\b/,
    expected: "the native close control still uses `window-close`",
  },
];

const sparsePaths = [
  ...new Set(Object.values(sourceGroups).flatMap((group) => group.paths)),
];

function usage() {
  return `Usage:
  node scripts/verify-upstream.mjs --ref <git-ref> [--repo <path>]
  node scripts/verify-upstream.mjs <git-ref> [--repo <path>]

Options:
  --ref <git-ref>  Required VS Code branch, tag, or commit to inspect.
                   Use all 40 hexadecimal characters for a commit ID.
  --repo <path>    Use this local VS Code git repository. No network fallback.
  --help           Show this help.

Without --repo, the checker uses .reference/vscode when the requested ref is
available there. Otherwise it creates a shallow sparse checkout of
microsoft/vscode in the system temporary directory and removes it afterward.`;
}

function parseArguments(argv) {
  let ref;
  let repository;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      return { help: true };
    }

    if (argument === "--ref" || argument === "--repo") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }

      if (argument === "--ref") {
        if (ref !== undefined) {
          throw new Error("The VS Code ref was provided more than once.");
        }
        ref = value;
      } else {
        if (repository !== undefined) {
          throw new Error("The local repository was provided more than once.");
        }
        repository = value;
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--ref=")) {
      if (ref !== undefined) {
        throw new Error("The VS Code ref was provided more than once.");
      }
      ref = argument.slice("--ref=".length);
      continue;
    }

    if (argument.startsWith("--repo=")) {
      if (repository !== undefined) {
        throw new Error("The local repository was provided more than once.");
      }
      repository = argument.slice("--repo=".length);
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (ref !== undefined) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    ref = argument;
  }

  if (!ref) {
    throw new Error("A VS Code git ref is required.");
  }

  if (
    ref.startsWith("-") ||
    ref.includes("\0") ||
    ref.includes("\n") ||
    ref.includes("\r")
  ) {
    throw new Error(`Invalid VS Code git ref: ${JSON.stringify(ref)}`);
  }

  if (/^[0-9a-f]{4,39}$/i.test(ref)) {
    throw new Error(
      "Abbreviated hexadecimal VS Code refs are unsupported: " +
        JSON.stringify(ref) +
        ". Use the full 40-character commit SHA, or a non-hexadecimal branch or tag name.",
    );
  }

  if (repository === "") {
    throw new Error("--repo requires a non-empty path.");
  }

  return {
    help: false,
    ref,
    repository: repository === undefined ? undefined : path.resolve(repository),
  };
}

function runGit(repository, arguments_, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", repository, ...arguments_], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Unable to run git: ${result.error.message}`);
  }

  if (result.status !== 0 && !allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim();
    const suffix = detail ? `\n${detail}` : "";
    throw new Error(`git ${arguments_.join(" ")} failed.${suffix}`);
  }

  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function assertGitRepository(repository) {
  if (!existsSync(repository)) {
    throw new Error(`Local VS Code repository does not exist: ${repository}`);
  }

  const result = runGit(repository, ["rev-parse", "--git-dir"], {
    allowFailure: true,
  });
  if (!result.ok) {
    throw new Error(`Not a git repository: ${repository}`);
  }
}

function resolveCommit(repository, ref) {
  const result = runGit(
    repository,
    ["rev-parse", "--verify", `${ref}^{commit}`],
    {
      allowFailure: true,
    },
  );
  return result.ok ? result.stdout : undefined;
}

async function createTemporaryCheckout(ref) {
  const repository = await mkdtemp(
    path.join(tmpdir(), "vscode-macos-traffic-lights-upstream-"),
  );

  try {
    runGit(repository, ["init", "--quiet"]);
    runGit(repository, ["remote", "add", "origin", UPSTREAM_URL]);
    runGit(repository, [
      "fetch",
      "--quiet",
      "--depth=1",
      "--filter=blob:none",
      "origin",
      ref,
    ]);
    runGit(repository, ["sparse-checkout", "init", "--no-cone"]);
    runGit(repository, ["sparse-checkout", "set", "--no-cone", ...sparsePaths]);
    runGit(repository, [
      "-c",
      "advice.detachedHead=false",
      "checkout",
      "--quiet",
      "--detach",
      "FETCH_HEAD",
    ]);

    const commit = resolveCommit(repository, "HEAD");
    if (!commit) {
      throw new Error(
        `Fetched VS Code ref ${JSON.stringify(ref)} has no commit.`,
      );
    }

    return {
      repository,
      commit,
      description: `shallow sparse checkout from ${UPSTREAM_URL}`,
      temporary: true,
    };
  } catch (error) {
    await rm(repository, { recursive: true, force: true });
    throw error;
  }
}

async function selectSource(ref, explicitRepository) {
  if (explicitRepository !== undefined) {
    assertGitRepository(explicitRepository);
    const commit = resolveCommit(explicitRepository, ref);
    if (!commit) {
      throw new Error(
        `VS Code ref ${JSON.stringify(ref)} is not available in ${explicitRepository}. ` +
          "An explicit --repo never falls back to the network.",
      );
    }

    return {
      repository: explicitRepository,
      commit,
      description: `local repository ${explicitRepository}`,
      temporary: false,
    };
  }

  if (existsSync(DEFAULT_LOCAL_REPOSITORY)) {
    assertGitRepository(DEFAULT_LOCAL_REPOSITORY);
    const commit = resolveCommit(DEFAULT_LOCAL_REPOSITORY, ref);
    if (commit) {
      return {
        repository: DEFAULT_LOCAL_REPOSITORY,
        commit,
        description: "local .reference/vscode repository",
        temporary: false,
      };
    }
  }

  return createTemporaryCheckout(ref);
}

function gitObjectExists(repository, objectName) {
  return runGit(repository, ["cat-file", "-e", objectName], {
    allowFailure: true,
  }).ok;
}

function readGitFile(repository, commit, relativePath) {
  const objectName = `${commit}:${relativePath}`;
  if (!gitObjectExists(repository, objectName)) {
    return undefined;
  }

  return runGit(repository, ["show", objectName]).stdout;
}

// Contract tokens in comments are not evidence. This small scanner preserves
// quoted strings (where DOM class names live) while removing source comments.
function stripComments(source) {
  let result = "";
  let index = 0;
  let quote;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (quote !== undefined) {
      result += character;

      if (character === "\\") {
        if (next !== undefined) {
          result += next;
          index += 2;
          continue;
        }
      } else if (character === quote) {
        quote = undefined;
      }

      index += 1;
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      result += character;
      index += 1;
      continue;
    }

    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        if (source[index] === "\n") {
          result += "\n";
        }
        index += 1;
      }
      index += 2;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

function inspectContracts(source) {
  const loadedGroups = new Map();
  const missing = [];

  for (const [key, group] of Object.entries(sourceGroups)) {
    const files = group.paths
      .map((relativePath) => ({
        relativePath,
        content: readGitFile(source.repository, source.commit, relativePath),
      }))
      .filter((file) => file.content !== undefined)
      .map((file) => ({
        relativePath: file.relativePath,
        content: stripComments(file.content),
      }));

    loadedGroups.set(key, files);

    if (files.length === 0) {
      missing.push({
        name: `${group.label} source`,
        expected:
          group.paths.length === 1
            ? `source file \`${group.paths[0]}\` exists`
            : `one of these source files exists: ${group.paths
                .map((candidate) => `\`${candidate}\``)
                .join(", ")}`,
        checked: group.paths,
      });
    }
  }

  for (const contract of contracts) {
    const files = loadedGroups.get(contract.group);
    if (files.length === 0) {
      continue;
    }

    if (!files.some((file) => contract.pattern.test(file.content))) {
      missing.push({
        name: contract.name,
        expected: contract.expected,
        checked: files.map((file) => file.relativePath),
      });
    }
  }

  return {
    loadedGroups,
    missing,
  };
}

function printResult(ref, source, inspection) {
  const metadata = [
    `VS Code ref: ${ref}`,
    `Resolved commit: ${source.commit}`,
    `Source: ${source.description}`,
  ];

  if (inspection.missing.length > 0) {
    const failure = [
      ...metadata,
      "",
      `FAIL: ${inspection.missing.length} required upstream contract${
        inspection.missing.length === 1 ? "" : "s"
      } missing.`,
    ];

    for (const missing of inspection.missing) {
      failure.push(
        "",
        `- ${missing.name}`,
        `  Expected: ${missing.expected}.`,
        `  Checked: ${missing.checked.join(", ")}`,
      );
    }

    console.error(failure.join("\n"));
    return false;
  }

  const desktopFiles = inspection.loadedGroups
    .get("desktopTitlebar")
    .map((file) => file.relativePath)
    .join(", ");
  console.log(
    [
      ...metadata,
      `Desktop titlebar source: ${desktopFiles}`,
      `PASS: all ${contracts.length} critical upstream contracts are present.`,
    ].join("\n"),
  );
  return true;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}\n`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  let source;
  try {
    source = await selectSource(options.ref, options.repository);
    const inspection = inspectContracts(source);
    if (!printResult(options.ref, source, inspection)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Upstream verification could not run: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (source?.temporary) {
      try {
        await rm(source.repository, { recursive: true, force: true });
      } catch (error) {
        console.error(
          `Warning: could not remove temporary checkout ${source.repository}: ${error.message}`,
        );
      }
    }
  }
}

await main();

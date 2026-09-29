# macOS Traffic Lights for VS Code on Windows

`vscode-macos-traffic-lights` gives Microsoft Visual Studio Code Desktop on
Windows macOS-style red, yellow, and green titlebar controls while keeping VS
Code's own minimize, maximize/restore, and close elements and handlers.

> [!IMPORTANT] This extension styles VS Code's internal workbench through
> [Custom UI Style](https://github.com/subframe7536/vscode-custom-ui-style).
> Those internal selectors are not a public VS Code theming API, and Custom UI
> Style modifies files in the VS Code installation. The design minimizes that
> unsupported surface, checks its upstream assumptions, and makes this
> extension's configuration changes reversible; it is not guaranteed to be
> update-proof.

> [!NOTE] Version 0.1.0 was release-qualified in an isolated Windows copy of VS
> Code 1.132.0. Compatibility Passes A-C and the release-blocking Pass D core
> scope completed with a clean final rollback. Deferred hardening cases are
> disclosed under [Known limitations](#known-limitations); this result is not a
> visual-test claim for any other VS Code version.

## What it changes

Enable makes three narrowly scoped global configuration changes:

- it sets `window.titleBarStyle` to `custom` when necessary;
- it sets `window.controlsStyle` to `custom` when necessary; and
- it adds the packaged `assets/macos-traffic-lights.css` file URI to
  `custom-ui-style.external.imports`.

The stylesheet moves the existing `.window-controls-container` to the upper
left, visually orders the existing controls as close, minimize, and
maximize/restore, and draws the traffic-light presentation. It does not create
replacement buttons or window-management JavaScript. A click still reaches VS
Code's existing native-host handler.

The extension does **not** change the menu bar, Command Center, Activity Bar,
fonts, editor colors, layout, webviews, Content Security Policy, or Electron
`BrowserWindow` options. It does not patch VS Code files itself; it asks Custom
UI Style to rebuild its managed injection after the configuration is updated.

See [Architecture](docs/architecture.md) for the complete decision record and
[Upstream analysis](docs/upstream-analysis.md) for the pinned source evidence.

## Requirements and supported scope

Version 0.1 supports only:

- Microsoft Visual Studio Code Desktop;
- Windows; and
- VS Code 1.99.0 or newer.

It also requires the installed and enabled extension
`subframe7536.custom-ui-style`. Custom UI Style 0.7.1 was inspected during
development.

Cursor, Windsurf, VSCodium, Code - OSS builds, browser-hosted VS Code, Linux,
and macOS are not supported. Enable and Reapply reject those environments
without intentionally changing configuration. Versions older than 1.99 are
rejected because they do not expose the required `window.controlsStyle`
contract.

Source inspection is not a visual test. VS Code 1.132.0 is recorded in
`visuallyTestedVersions` after its isolated Windows qualification. Every other
supported version is reported as **supported but untested** until it completes
an explicitly recorded qualification. See [Compatibility](docs/compatibility.md)
for the version-compatibility policy and exact qualification boundary.

## Installation

1. Install and enable **Custom UI Style** (`subframe7536.custom-ui-style`) in
   the local Windows VS Code UI.
2. Install **macOS Traffic Lights** from the Visual Studio Marketplace, or run:

   ```powershell
   code --install-extension renderpath-dev.vscode-macos-traffic-lights
   ```

   For an explicitly obtained local artifact, install
   `vscode-macos-traffic-lights.vsix` from **Extensions: Install from VSIX...**,
   or run:

   ```powershell
   code --install-extension .\dist\vscode-macos-traffic-lights.vsix
   ```

3. Confirm that `custom-ui-style.external.loadStrategy` is `refetch`
   (recommended) or `cache`, not `disable`.
4. Run **macOS Traffic Lights: Diagnose**, review the baseline, and then run
   **macOS Traffic Lights: Enable**.
5. Select **Cancel** on every Custom UI Style **Restart APP** prompt, inspect
   the **Custom UI Style** output, save your work, and then fully close and
   normally relaunch only the intended Visual Studio Code application. Do not
   use a process-name-wide restart.

The [manual-test guide](docs/manual-testing.md) explains how to do this first in
a disposable Windows VS Code copy. Installing an extension with isolated
`--user-data-dir` and `--extensions-dir` alone does **not** isolate Custom UI
Style's changes to the shared VS Code application files.

## Commands

### macOS Traffic Lights: Enable

Enable validates the application, platform, version, dependency, load strategy,
and managed setting scopes before applying anything. It captures the explicit
global baseline for each managed setting, registers exactly one current CSS
import, removes stale imports owned by older versions, preserves every unrelated
import, and invokes `custom-ui-style.reload`.

Running Enable repeatedly is safe: it does not duplicate the import or replace
the saved baseline. The command result proves that project configuration was
registered and the public reload command returned. Select **Cancel** on every
Custom UI Style **Restart APP** prompt, inspect its output, then normally
relaunch only the intended Visual Studio Code application and inspect the
renderer before treating the visual change as applied.

### macOS Traffic Lights: Disable

Disable removes only this extension's CSS imports. For each titlebar setting it
changed, it restores the previous explicit global value or removes the explicit
value if none existed before Enable—but only if the current global value still
equals the extension-written value, `custom`. If the user changed a managed
setting after Enable, Disable preserves that newer value and reports the
decision.

Unrelated Custom UI Style imports and options remain intact. Disable restores
managed window settings even if inspecting/removing the CSS import fails, keeps
the incomplete transaction in global state, and tells the user to correct the
problem and run Disable again. It requests Custom UI Style reload when cleanup
can complete and clears the pending transaction only after that command returns.
It remains useful for cleanup even if the current runtime would not pass
Enable's platform checks.

Run Disable before uninstalling this extension. Uninstalling first cannot
execute the rollback logic and can leave the global settings and a versioned CSS
URI behind.

### macOS Traffic Lights: Reapply

Reapply is an explicit repair operation for an already-enabled installation. It
restores the two managed settings to `custom`, replaces stale owned CSS URIs
with the current packaged URI, removes duplicates, preserves unrelated imports,
and invokes Custom UI Style reload.

Enable and Reapply refuse to run while a Disable transaction is pending. Run
Disable again first; this prevents a repair operation from discarding the
original restoration baseline.

Because Reapply intentionally repairs managed configuration, a manual change to
either managed setting made while enabled is set back to `custom`. If the goal
is to keep that manual change, use Disable instead.

### macOS Traffic Lights: Diagnose

Diagnose writes a path-redacted report to the **macOS Traffic Lights** output
channel. It includes:

- operating system, VS Code version, application name, and desktop/web host;
- supported/unsupported environment and version compatibility state;
- Custom UI Style availability and activation state;
- effective and explicit global values for both managed titlebar settings;
- Custom UI Style's external load strategy;
- current, duplicate/stale owned, and unrelated import counts; and
- the minimum version and upstream source-verification record.

Diagnose does not change configuration.

## Restart and Custom UI Style behavior

Enable, Reapply, and a changing Disable call Custom UI Style's public
`custom-ui-style.reload` command. A successful Custom UI Style run restores its
backup, rebuilds its patches and merged external resources, and asks to
restart/reload. For VS Code 1.95 and newer, the inspected implementation offers
a **full application restart**. On Windows, that implementation terminates
matching Visual Studio Code processes by executable image name, so it can affect
other installations as well as the initiating copy. Keep its
`reloadWithoutPrompting` option disabled and select **Cancel** on every
**Restart APP** prompt. Inspect the Custom UI Style output, save your work, and
then fully close and normally relaunch only the intended Visual Studio Code
application. The configuration can be correct while the old renderer remains
visible; use Reapply only when patching or managed-state repair is actually
incomplete.

The public command returning is not proof that every upstream patch succeeded:
the inspected Custom UI Style error path logs some internal patch failures
without rejecting the command. Always review its output, cancel every **Restart
APP** prompt, normally relaunch only the intended application, and then visually
verify the result. Custom UI Style's default configuration watcher may also
react to the titlebar setting writes while this extension explicitly requests
reload; multiple restart prompts were observed during the VS Code 1.132.0
qualification. Cancel every prompt, inspect the output, and perform one normal
intended-application relaunch after the operation settles.

The external load strategies have deliberately different behavior:

- `refetch` is the default and recommendation. Every reload reads the packaged
  CSS again.
- `cache` is allowed and never overridden. Its cache key is the resource type
  and URI, not the file contents. Editing CSS in place during extension
  development and then running Reapply can therefore retain cached content while
  the URI is unchanged. Switch to `refetch` for development. A packaged
  extension version change normally changes the versioned URI and invalidates
  this condition.
- `disable` tells Custom UI Style to omit external resources. Enable and Reapply
  stop with an actionable message and do not silently change this user choice.

Custom UI Style's own rollback is broader than this extension's Disable. Use
**macOS Traffic Lights: Disable** to remove this extension's state and imports;
use **Custom UI Style: Rollback** only when you intend to roll back all Custom
UI Style-managed patches.

## Rollback model

Restoration metadata is stored in the local UI extension host's
`ExtensionContext.globalState`. It distinguishes an absent explicit value from
an explicit global value and records whether this extension wrote each setting.
Pending-write, pending-reload, and pending-Disable markers make interrupted
operations retryable. Invalid or unsupported saved metadata causes a safe error
instead of being silently replaced with an empty baseline.

External imports are merged, not restored by replacing the entire array. This is
intentional: imports added or changed by the user while this extension is
enabled survive Disable. Ownership is limited to exact recorded URIs and the
exact VS Code versioned-extension-directory pattern ending in this project's
`assets/macos-traffic-lights.css` under the same extension-installation parent
and file-URL host as the current package; a broad filename substring or matching
path in another root is not used.

For a detailed state transition description, see
[Architecture: reversible state](docs/architecture.md#reversible-state-model).

## Remote - WSL

The repository can live in WSL and the open workspace can use Remote - WSL, but
the titlebar belongs to the local Windows VS Code application. The package
declares `"extensionKind": ["ui"]`, so this extension and Custom UI Style must
be installed in the **Local - Installed** side of the Extensions view. The
extension constructs the CSS URI from the local `ExtensionContext.extensionUri`
and refuses non-file resources.

Do not install or debug this as a Linux remote-host customization. Diagnose
should report `win32`, `desktop`, and `Visual Studio Code` even while the active
folder is in WSL.

## Known limitations

- The workbench selectors, state classes, zoom behavior, and titlebar layout are
  internal VS Code implementation details. A VS Code update can break the
  visuals without changing a public API.
- Custom UI Style modifies the VS Code installation and may require write
  permissions. VS Code updates can replace its patched files and require
  Reapply.
- The v0.1.0 release qualification covers VS Code 1.132.0 only. Other supported
  versions remain supported but untested until separately qualified.
- Literal titlebar drag was controller-limited, and dedicated screen-reader,
  accessibility-tree, and magnifier certification was not performed. The visual,
  keyboard, high-contrast, native-control, and focus checks completed during
  Passes A-C are not an accessibility-conformance claim.
- Non-release-blocking Pass D hardening for same-URI `cache` refresh behavior,
  live Reapply rejection while external loading is disabled, dependency-loss
  recovery, and persisted interrupted-Disable resume remains deferred. The
  release-blocking lifecycle core and final rollback passed.
- The visual circle is 12 px and each control's CSS width is approximately 20
  px, while the hit area spans the titlebar height. Accessibility and practical
  hit-target adequacy must be assessed in the manual matrix; no conformance
  claim is made yet.
- `cache` mode can serve stale same-URI content during development.
- Custom UI Style can log an internal reload/patch failure while its public
  command still returns. This extension can confirm that reload was requested,
  not that application files and the new renderer are correct.
- Custom UI Style's configuration watcher and this extension's explicit reload
  request can produce multiple restart prompts after Enable/Reapply. Cancel
  every prompt and perform one normal intended-application relaunch after the
  operation settles.
- The extension does not provide user-facing geometry or color settings in
  version 1.
- Unsupported products are rejected by exact application identity rather than
  optimistically applying internal selectors.

## Troubleshooting

### Enable says the environment is unsupported

Run Diagnose. Confirm that the report says `Operating system: win32`,
`Application host: ... (desktop)`, and
`VS Code application: Visual Studio Code`. VS Code forks, web hosts, and a Linux
remote extension host are outside version 1's scope. In Remote - WSL, install
both extensions locally.

### External loading is disabled

Set `custom-ui-style.external.loadStrategy` to `refetch` (recommended) or
`cache`, then run Enable or Reapply again. This extension will not override a
user-selected `disable` value.

### Enable succeeded but nothing changed

1. Select **Cancel** on every Custom UI Style **Restart APP** prompt and inspect
   the **Custom UI Style** output for a patch or permission error.
2. Save your work, fully close only the intended Visual Studio Code application
   normally, and start it again. Do not use a process-name-wide restart. Run
   Reapply only if the output or diagnostics show incomplete patching or
   managed-state repair.
3. Run Diagnose and confirm both titlebar settings are effectively `custom`, the
   current CSS import count is one, stale count is zero, and the load strategy
   is not `disable`.
4. If developing with `cache`, switch to `refetch` and Reapply.
5. Check the **Custom UI Style** output even if macOS Traffic Lights reported
   that its reload request returned; Custom UI Style can log an internal patch
   error without rejecting its public command.
6. If multiple restart prompts appeared, cancel each one, wait for the operation
   to settle, and verify diagnostics/visuals after one normal relaunch.

### The controls are stale after an extension or VS Code update

Run Reapply, select **Cancel** on every Custom UI Style **Restart APP** prompt,
inspect the output, and normally relaunch only the intended application. On
activation, an enabled extension also detects a changed versioned CSS URI,
registers the current URI, and offers to run Reapply. For a new VS Code version,
run the upstream contract check before assuming the selectors remain compatible.

### Controls overlap menus, navigation, the Command Center, or the title

Capture the VS Code version, display scale, VS Code zoom level, menu mode,
Command Center setting, theme, and a screenshot. Run Diagnose and include its
path-redacted output in the issue. Disable provides the safe rollback while the
CSS contract is investigated.

### Disable says cleanup is incomplete

Any setting restoration already completed is retained, and the Disable
transaction remains pending for a safe retry. Correct the reported import or
dependency problem, reinstall/enable `subframe7536.custom-ui-style` if needed,
then run **macOS Traffic Lights: Disable** again. Review Custom UI Style's
output, select **Cancel** on every **Restart APP** prompt, and normally relaunch
only the intended application. Do not uninstall macOS Traffic Lights while this
retryable cleanup state remains.

### VS Code reports installation corruption or Custom UI Style cannot write

Those effects come from Custom UI Style's installation-file patching layer, not
direct writes by this extension. Consult Custom UI Style's backup, rollback,
checksum, and permission guidance. Do not grant broad permissions to an
installation you do not understand; prefer a user-writable disposable copy for
the first test.

## Development

Prerequisites are Node.js 20 or newer and npm. From the repository root:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package
```

`npm run check` runs format checking, lint, type checking, unit tests, and the
bundle build in sequence. `npm run package` writes
`dist/vscode-macos-traffic-lights.vsix` after building.

Packaging requires the canonical repository metadata and uses no
missing-repository or link-rewrite exceptions. Before Marketplace publication,
verify that the `publisher` field remains the release account's exact owned
publisher ID, `renderpath-dev`, then inspect every rewritten documentation link
in the packaged VSIX. Do not publish under an inferred or unverified publisher
ID.

Launch the Extension Development Host with the **Run macOS Traffic Lights**
configuration. Do not exercise Enable against a production VS Code installation
as an automated test: invoking Custom UI Style reload patches the application
installation. Pure lifecycle, import ownership, platform, version, and
dependency-state logic is covered by unit tests.

### Upstream compatibility check

The network-dependent maintenance check is separate from deterministic CI:

```bash
npm run verify:upstream -- --ref 1.132.0
npm run verify:upstream -- --ref main
```

Use `--repo <path>` to force a local VS Code Git checkout. Without it, the
script reuses `.reference/vscode` when the ref resolves there; otherwise it
creates and cleans a shallow sparse temporary checkout. The check looks for
small semantic contracts rather than fixed line numbers or a large exact code
block and reports each missing setting, enum, DOM class, or stylesheet class
precisely.

Core CI does not call this network-dependent check. The separate **Upstream
compatibility** workflow is manually runnable and may also run on its
low-frequency schedule. See [Compatibility](docs/compatibility.md) for the full
maintenance procedure.

## Security

Normal activation performs no network request. The only registered resource is
the packaged local CSS file. This extension does not inject renderer JavaScript,
disable CSP, alter webview CSP, patch another extension, or set
`custom-ui-style.electron`. The optional upstream verifier is the only project
command designed to access GitHub, and it runs only when a maintainer invokes it
or its separate workflow runs.

## License and acknowledgements

This project is released under the [MIT License](LICENSE).

The implementation was informed by source inspection of Microsoft VS Code and
Custom UI Style, both MIT-licensed. `HealKnix/macos-titlebar-for-windows` was
consulted only as behavioral and visual prior art; its inspected revision has no
declared repository license, so none of its TypeScript, CSS, embedded SVGs, or
base64 assets was copied. Exact revisions and clean-room boundaries are in
[Upstream analysis](docs/upstream-analysis.md).

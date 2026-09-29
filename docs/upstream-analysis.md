# Upstream source and clean-room analysis

## Scope and method

The architecture was selected after source inspection of the three repositories
named in the project brief. Reference checkouts were shallow/sparse where
appropriate and kept under `.reference/`, which is excluded by both Git and VSIX
packaging. No reference repository is vendored into the extension.

The recorded revisions are immutable inputs to this analysis:

| Repository                                                                                                                                    | Inspected revision                         | Version context                                                       | License finding                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`microsoft/vscode`](https://github.com/microsoft/vscode/tree/78a7b6c291b5ac8d85fa32cfa3feacb649057b84)                                       | `78a7b6c291b5ac8d85fa32cfa3feacb649057b84` | `main` source package `1.133.0`; highest fetched stable tag `1.132.0` | MIT (`LICENSE.txt`)                                                                            |
| [`subframe7536/vscode-custom-ui-style`](https://github.com/subframe7536/vscode-custom-ui-style/tree/217c5167802e864005ca2d32e1cb9cf1b85713c6) | `217c5167802e864005ca2d32e1cb9cf1b85713c6` | package version `0.7.1`                                               | MIT (`LICENSE.md` and package metadata)                                                        |
| [`HealKnix/macos-titlebar-for-windows`](https://github.com/HealKnix/macos-titlebar-for-windows/tree/7d5f144d493cc09d1f509116c198394f7563f165) | `7d5f144d493cc09d1f509116c198394f7563f165` | package version `0.0.10`; deprecated                                  | No `LICENSE`/`COPYING` file or package license declaration was found in the inspected revision |

The reference commits were current in the local research checkout on 2026-08-08.
“Current” here means the pinned checkout used for development, not a promise
that a remote branch cannot advance later. The verifier can refresh the contract
at an explicit Git ref.

Source inspection and automated selector verification are not visual tests. VS
Code 1.132.0 was separately release-qualified with this extension in an isolated
Windows application copy and is listed in `visuallyTestedVersions`. The pinned
1.133.0 development snapshot remains source-inspection evidence only.

## Microsoft VS Code findings

### Files inspected

The current-revision analysis covered at least:

```text
src/vs/platform/window/common/window.ts
src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/electron-browser/desktop.contribution.ts
src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts
```

The `electron-browser` titlebar path is current at the pinned main revision. For
the 1.99-era boundary check, the equivalent native titlebar implementation may
be under the historical `electron-sandbox` path. Maintenance checks must follow
the equivalent source rather than treating a directory name as the contract.

### Window-control configuration contract

`src/vs/platform/window/common/window.ts` defines `WindowControlsStyle.NATIVE`,
`CUSTOM`, and `HIDDEN`, exposes `IWindowSettings.controlsStyle`, and resolves
`window.controlsStyle`. The resolver accepts custom/hidden controls only on
Windows or Linux desktop when the titlebar itself is custom; web, macOS, or a
native titlebar resolves to native controls. Native remains the default when no
supported explicit value is present.

That establishes the necessary configuration combination:

```json
{
  "window.titleBarStyle": "custom",
  "window.controlsStyle": "custom"
}
```

`src/vs/workbench/electron-browser/desktop.contribution.ts` registers
`window.controlsStyle` with the values `native`, `custom`, and `hidden`, and
states that changes require a full restart. The relauncher contribution also
observes this setting as a restart-relevant Windows/Linux change.

### Version boundary

The fetched `1.98.0` source does not contain the required `controlsStyle`
contract in `window.ts`; fetched `1.99.0` does contain
`IWindowSettings.controlsStyle`, the `WindowControlsStyle` enum,
`getWindowControlsStyle`, and the custom/hidden decision. That source boundary
supports a minimum version of **VS Code 1.99.0**.

The project does not turn the newest source-inspected version into a maximum. A
newer parseable version is normally “supported but untested,” not blocked,
unless it falls into a future explicit known-broken rule.

### Existing DOM and native behavior

The browser titlebar part creates `.titlebar-container` with left, center, and
right regions. When the titlebar is not native and controls are not hidden, it
creates `.window-controls-container`; on Windows the ordinary location is the
right region.

The Electron-browser titlebar part populates that container in this DOM order:

1. `.window-icon.window-minimize`;
2. `.window-icon.window-max-restore`; and
3. `.window-icon.window-close`.

It registers click listeners that call the existing native host service:

- minimize calls `minimizeWindow`;
- maximize/restore first asks `isMaximized`, then calls `unmaximizeWindow` or
  `maximizeWindow`; and
- close calls `closeWindow`.

It subscribes to the layout service's maximized-state event and swaps the
maximize control between `codicon-chrome-maximize` and `codicon-chrome-restore`.
This means the extension can preserve behavior and state by retaining the
elements, using CSS `order`, and drawing separate glyphs for those state
classes. There is no need to monkey-patch `INativeHostService`, dispatch
commands, or create replacement controls.

### Layout and CSS observations

The upstream titlebar stylesheet:

- makes the titlebar regions flex containers;
- defines the titlebar drag region with `-webkit-app-region: drag`;
- sizes the desktop non-macOS control container with `--zoom-factor` and a
  `.counter-zoom` variant;
- gives each `.window-icon` a full-height 46 px control box in the stock
  presentation;
- uses `.part.titlebar.inactive` for inactive foreground; and
- adds standard rectangular hover backgrounds, including a special close
  background.

The project stylesheet must therefore suppress only those control hover
backgrounds, keep the existing children non-draggable/clickable, handle both
zoom paths, and deliberately style inactive state. It reserves space in the left
titlebar region instead of reversing all left/right regions.

The current project also assumes fullscreen and high-contrast workbench classes.
Those are included in the manual matrix because the core source verifier
intentionally checks a small critical contract rather than claiming that a text
search proves the entire visual layout.

### What was reused from VS Code

Reused as a runtime contract:

- documented setting names and enum values;
- existing DOM class names;
- the existing control elements and their installed handlers;
- maximize/restore state classes; and
- the upstream zoom/titlebar state model needed for compatible CSS.

No VS Code TypeScript or CSS implementation was copied into this project.
Project code consumes observable configuration and selector contracts and
implements original reconciliation and presentation logic.

## Custom UI Style findings

### Files inspected

The analysis covered at least:

```text
README.md
package.json
src/path.ts
src/manager/base.ts
src/manager/css.ts
src/manager/main.ts
src/manager/external.ts
src/manager/index.ts
src/utils.ts
src/restart.ts
```

### Public integration surface

Package 0.7.1 declares the public command `custom-ui-style.reload` and the
settings:

```text
custom-ui-style.external.imports
custom-ui-style.external.loadStrategy
```

External imports accept local `file:` CSS/JavaScript URLs and HTTPS resources.
This project supplies only one local CSS string URI and never uses the
JavaScript variants. The README explicitly says resources are fetched and merged
during reload and are not live-watched.

Custom UI Style is listed in `extensionPack` so installation remains convenient
without making this extension impossible to activate when the dependency is
missing or disabled. Runtime code checks that it is available, activates it if
needed, and invokes only its public reload command.

### Load strategies

`src/manager/external.ts` implements three behaviors:

- `refetch` (the package default) parses and reads the imports on every reload;
- `cache` records resource type/URI keys and skips re-reading when that set is
  unchanged and the prior fetch set had no failure; and
- `disable` writes empty generated external resources and returns the unpatched
  workbench HTML content for this external-resource layer.

The cache does not compare local file contents. As a result, editing the CSS in
place under an unchanged development extension URI and running Reapply can serve
the old merged CSS in cache mode. The project allows this user choice but
recommends `refetch`, reports cache mode, and blocks Enable/Reapply when the
strategy is `disable`.

An extension upgrade normally changes the versioned installation directory and
therefore the resource URI. Project activation and Reapply replace the old owned
URI with the new one; that URI-set change also prevents Custom UI Style's
same-key cache shortcut.

### Backup, patch, rollback, and restart behavior

`src/path.ts` resolves VS Code installation paths for workbench CSS/JavaScript,
main JavaScript, product metadata, webview assets, workbench HTML, generated
external bundles, and versioned backup files. `BaseFileManager` creates a backup
when needed, builds patched content from that backup, and restores it on
rollback. The external manager generates merged external CSS/JS and inserts
links/scripts into workbench HTML.

This is why the project describes Custom UI Style as source-injection
infrastructure even though this project itself never opens or writes a VS Code
installation file. A Custom UI Style reload can require application-directory
write permissions and can interact with VS Code's installation-integrity
warning. Those risks belong in installation and recovery guidance.

`src/manager/index.ts` chooses a full restart for VS Code 1.95 and newer. Unless
`custom-ui-style.reloadWithoutPrompting` is enabled, its restart wrapper prompts
with **Restart APP**; cancellation leaves the generated/configuration work
without applying it to a fresh renderer. Custom UI Style's README likewise
advises closing all VS Code windows and restarting if changes appear to have no
effect.

On Windows, `restartWindows()` derives `exeName` from `process.execPath`, runs
`taskkill /F /IM "<exeName>.exe"`, waits on all processes returned by
`Get-Process <exeName>`, and then launches a binary resolved from the initiating
application directory. The termination step is image-name-wide, not
application-copy-, profile-, or path-scoped.

The inspected `runAndRestart` wrapper catches errors thrown while managers patch
files, logs them, marks its local operation unsuccessful, and does not rethrow
that action failure through the public command. Consequently, this project can
know that `custom-ui-style.reload` returned, but it cannot infer that every file
patch or restart succeeded. User guidance must require checking the Custom UI
Style output, selecting **Cancel** on every restart prompt, normally relaunching
only the intended application after the operation settles, and visually
confirming a fresh renderer.

Custom UI Style also enables a configuration watcher by default and describes
that watcher as ignoring import changes. The titlebar setting writes are not
imports, so a watcher-triggered reload may race with this project's explicit
reload request. Multiple prompts were observed during the isolated VS Code
1.132.0 qualification; every prompt was cancelled before one normal,
intended-application-only relaunch.

Both titlebar settings used by this project independently require a full
restart, so the project does not promise that an Enable result or returned
reload request is visible before a verified clean restart.

### Features intentionally not used

Custom UI Style can alter far more than this project needs. The implementation
does not write:

```text
custom-ui-style.electron
custom-ui-style.stylesheet
custom-ui-style.webview.*
custom-ui-style.extensions.*
```

It does not configure fonts, backgrounds, renderer JavaScript, other-extension
patches, Electron options, or remote external resources. It preserves all such
unrelated user configuration if already present.

### What was reused from Custom UI Style

Reused as documented integration concepts:

- the companion extension ID;
- external import and load-strategy setting names and values;
- the public reload command; and
- the dependency's backup/rebuild and restart-prompt lifecycle, while
  deliberately declining its broad Windows **Restart APP** action.

No manager, path, patch, cache, or restart implementation was copied. This
project's setting capture, exact import ownership, stale-version reconciliation,
diagnostics, and command orchestration are original.

## Behavioral prior-art findings

### Files inspected

The analysis covered:

```text
README.md
package.json
extension.ts
settings/active.ts
settings/disable.ts
```

The repository describes the target visual behavior and is explicitly deprecated
for VS Code releases after 1.92.2 because it depends on APC CustomizeUI++. Its
Enable path:

- writes an APC stylesheet object;
- configures APC Electron `titleBarStyle: hiddenInset`;
- changes `window.menuBarVisibility` to `compact`;
- styles generic `.window-icon` selectors;
- reverses broad titlebar left/right flex regions; and
- embeds glyph assets as opaque base64 SVG data.

Its Disable path writes a large set of null APC stylesheet entries and restores
the menu bar to a fixed `classic` value rather than recording the user's
baseline.

Those observations informed what this project must avoid: an APC dependency,
Electron main-process options, unrelated menu changes, broad layout inversion,
global selectors, copied opaque assets, and non-stateful rollback.

### Clean-room boundary

The inspected prior-art revision contains no identified license grant in a
repository license file or package metadata. It was therefore treated only as a
visual/behavioral reference:

- macOS-like red/yellow/green circles;
- close/minimize/maximize visual order; and
- glyphs revealed on hover.

None of its TypeScript, selector-value object, CSS strings, embedded SVGs,
base64 data, screenshots, or other assets was copied. The project-owned CSS uses
independently chosen values, scoped selectors, CSS gradients/borders for glyph
geometry, upstream maximize/restore state classes, and a different
container-positioning strategy. The TypeScript lifecycle was designed from the
project requirements and current VS Code/Custom UI Style contracts.

## Licensing conclusion

Microsoft VS Code and Custom UI Style may be studied under their MIT licenses.
No upstream source is redistributed in the VSIX; only original project code,
CSS, and documentation are packaged. The absence of an identified license for
the prior-art repository rules out code or asset reuse from that source.

The project itself uses the MIT license. Repository names, extension IDs,
setting names, command IDs, and internal selector names are documented only to
describe interoperability and maintenance contracts.

## Maintenance implications

After a VS Code update:

1. Run `npm run verify:upstream -- --ref <git-ref>`.
2. Investigate every missing semantic contract in the reported upstream path; do
   not merely relax the check.
3. Review the complete CSS assumption list in
   [Architecture](architecture.md#unsupported-surface-budget).
4. Build and package a new VSIX.
5. Execute the full Windows manual matrix in a disposable VS Code copy.
6. Add a version to `visuallyTestedVersions` only after that matrix passes and
   commit the evidence/result.

After a Custom UI Style update, repeat the external import, load-strategy,
backup, public reload, and restart analysis. Its package version and commit in
`compatibility.json` are development evidence, not a strict runtime version pin
unless a concrete incompatibility is discovered.

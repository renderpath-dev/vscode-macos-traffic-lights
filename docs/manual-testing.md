# Windows manual testing

## Verification status

**Release-qualified for VS Code 1.132.0.** Isolated Windows compatibility Passes
A-C and the release-blocking Pass D core scope completed for version 0.1.0 with
a clean final rollback, and `compatibility.json` records that exact version as
supported and tested. Literal controller-limited titlebar drag, dedicated
accessibility-tool certification, same-URI `cache` refresh, live Reapply
rejection with external loading disabled, dependency-loss recovery, and
persisted interrupted-Disable resume remain deferred non-release-blocking
hardening; they are not claimed as passed. This document remains the procedure
for every additional VS Code version; completion on 1.132.0 does not qualify
later versions.

Do not mark a VS Code version “supported and tested” until every case in the
declared release-qualification scope has an observed result on that exact
version, every release-blocking case passes, and any narrower controller or
hardening deferral is explicitly classified and disclosed. Record failures and
partial runs honestly.

## Safety boundary

Custom UI Style modifies files in the VS Code application directory. A separate
`--user-data-dir` or `--extensions-dir` isolates settings and extensions but
does **not** by itself isolate those application files. For the first real
visual run, use a disposable, user-writable copy of the official Microsoft VS
Code Windows ZIP distribution. Do not point the test at the primary installed
copy, do not run as Administrator merely to bypass permissions, and do not run
automated source patching against a production installation.

Keep `custom-ui-style.reloadWithoutPrompting` disabled. On Windows, select
**Cancel** on every Custom UI Style **Restart APP** prompt, inspect its output,
then close and relaunch only the intended VS Code application normally. For a
disposable copy, re-resolve its exact executable, profile arguments, process,
and window identity before the relaunch. Never use process-name-wide `Code.exe`
termination.

Keep all windows from the disposable copy separate from windows belonging to the
primary installation. The inspected Custom UI Style Windows full-restart path
targets `Code.exe` by process/image name and can affect every matching Visual
Studio Code installation, not merely the copy that initiated it. This is why
every **Restart APP** prompt must be cancelled and only the intended application
may be closed and normally relaunched after its exact identity is revalidated.

## Test record

Copy this block into the test report before starting:

```text
Date/time:
Tester:
Windows edition/build:
Architecture:
Display(s) and scaling:
VS Code version/commit:
VSIX version and SHA-256:
Custom UI Style version:
Remote - WSL extension/version:
Themes tested:
Baseline settings/profile:
Disposable VS Code path:
Result: not run | partial | pass | fail
Failures/issue links:
Screenshots or video locations:
```

Screenshots and videos are test evidence, not runtime package assets. Keep them
outside the VSIX and outside committed build output unless the project later
adopts an explicit evidence policy.

## Exact first visual-test procedure

### 1. Build and identify the VSIX in WSL

From the repository root:

```bash
npm ci
npm run check
npm run package
sha256sum dist/vscode-macos-traffic-lights.vsix
wslpath -w "$PWD/dist/vscode-macos-traffic-lights.vsix"
```

Record the hash and the Windows path printed by `wslpath`. Inspect the VSIX
contents as part of the build handoff before installing it.

### 2. Prepare a disposable Windows application copy

1. Download the official stable Microsoft VS Code Windows ZIP matching the
   architecture under test. Do not use Cursor, VSCodium, Code - OSS, or
   Insiders; the version 1 runtime guard requires the exact application name
   `Visual Studio Code`.
2. Extract it under a user-writable test folder such as:

   ```text
   C:\Users\<you>\AppData\Local\vscode-mtl-manual\VSCode-win32-x64
   ```

3. Confirm no process is running from that extracted `Code.exe`.
4. Create dedicated user-data and extension directories beside the disposable
   copy. These isolate settings/extensions; the separate application copy is
   what isolates Custom UI Style's installation-file changes.

In PowerShell, adjust only `$AppRoot` and `$Vsix`:

```powershell
$AppRoot = "$env:LOCALAPPDATA\vscode-mtl-manual\VSCode-win32-x64"
$UserData = "$env:LOCALAPPDATA\vscode-mtl-manual\user-data"
$Extensions = "$env:LOCALAPPDATA\vscode-mtl-manual\extensions"
$Code = Join-Path $AppRoot "bin\code.cmd"
$Vsix = "\\wsl.localhost\<distro>\home\<user>\code\projects\vscode-macos-traffic-lights\dist\vscode-macos-traffic-lights.vsix"

New-Item -ItemType Directory -Force $UserData, $Extensions | Out-Null
& $Code --user-data-dir $UserData --extensions-dir $Extensions --install-extension subframe7536.custom-ui-style --force
& $Code --user-data-dir $UserData --extensions-dir $Extensions --install-extension $Vsix --force
& $Code --user-data-dir $UserData --extensions-dir $Extensions --new-window
```

Use the actual Windows path returned by `wslpath -w` for `$Vsix`; the UNC path
above is illustrative because the WSL distribution name is environment-specific.
Every later launch in this test must use the same `$Code`, `--user-data-dir`,
and `--extensions-dir` values.

### 3. Establish a clean baseline

1. In the disposable window, verify both extensions appear under **Local -
   Installed**.
2. Open User Settings (JSON) and set only:

   ```json
   {
     "custom-ui-style.external.loadStrategy": "refetch"
   }
   ```

   For the absent-baseline rollback scenario, do not add explicit
   `window.titleBarStyle`, `window.controlsStyle`, or
   `custom-ui-style.external.imports` values.

3. Run **macOS Traffic Lights: Diagnose**.
4. Save the path-redacted output and confirm it reports:
   - operating system `win32`;
   - application `Visual Studio Code`;
   - UI kind `desktop`;
   - Custom UI Style available;
   - lifecycle disabled;
   - load strategy `refetch`;
   - no current/stale owned import; and
   - the expected version state: `supported but untested` for a new candidate,
     or `supported and tested` only when that exact version is already recorded.
5. Capture baseline screenshots for normal, maximized, light, dark, and any
   accessibility comparison that will be used later.

### 4. Enable and complete the first safe relaunch

1. Run **macOS Traffic Lights: Enable**.
2. Read the result; it should report the settings that actually required a
   change and the CSS import reconciled. On current VS Code, `titleBarStyle`
   commonly already has the effective default `custom`, so a clean profile may
   need only the `controlsStyle` write. This confirms registration and that the
   public reload command returned, not that Custom UI Style's internal patch
   succeeded.
3. Custom UI Style should offer **Restart APP** on supported VS Code versions
   because its inspected implementation uses a full restart for VS Code >= 1.95.
   Select **Cancel** on every such prompt and inspect the **Custom UI Style**
   output for patch/permission errors even when Enable reports success. Record
   every watcher-triggered and explicit-reload prompt; multiple prompts were
   observed during the VS Code 1.132.0 qualification.
4. The settings and import can already be correct while the old renderer remains
   visible. After the reload command completes and its output is clean, close
   and relaunch only the intended VS Code application normally. For a disposable
   copy, use the documented path-scoped procedure and preserve its isolated
   launch arguments. Reapply only if patching or managed-state repair is
   actually incomplete.
5. After relaunch, run Diagnose again. Expect both effective titlebar values to
   be `custom`, current import count one, stale count zero, and the lifecycle
   enabled. A global value should be `custom` only when Enable actually needed
   to write that setting; an already-effective default remains
   `<no explicit value>`.

### 5. Perform the qualification and hardening matrices

Run every row in the declared release-qualification scope across the
visual/interaction, layout/display, environment/theme, lifecycle, and
accessibility tables below. Use a safe unsaved scratch file for close tests so
the normal dirty-editor confirmation can be observed. Record actual results; do
not fill the matrix from expected behavior alone. If tooling cannot make a
focus-sensitive observation validly, record the case as controller-limited and
defer it explicitly rather than claiming a pass.

### 6. Verify rollback before using a primary installation

1. Run **macOS Traffic Lights: Disable**.
2. If Disable reports an incomplete cleanup, keep the extension installed,
   correct the named import/dependency problem, and run Disable again. Completed
   setting restoration is retained across the retry.
3. When Disable reports that reload was requested, inspect Custom UI Style's
   output, select **Cancel** on every **Restart APP** prompt, then close and
   relaunch only the intended VS Code application normally. A returned command
   alone does not prove its internal patch succeeded.
4. Run Diagnose after relaunch. Expect lifecycle disabled and no current or
   stale owned imports.
5. Open User Settings (JSON). For the clean absent-baseline scenario, the two
   managed titlebar keys and explicit external-import array must again be
   absent. The load strategy remains because it was user-owned.
6. Confirm stock Windows titlebar controls return and unrelated settings remain
   unchanged.
7. Complete the explicit-baseline, user-change-preservation, unrelated-import,
   and idempotency scenarios later in this document.
8. Only after the disposable-copy run passes should a user decide whether to
   repeat the installation in a primary VS Code installation.

## Visual and native-interaction matrix

| Case                     | Procedure                                                                                                                           | Expected behavior                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal window            | Restore to a non-maximized resizable window and inspect the upper-left titlebar.                                                    | Three 12 px circles appear close/minimize/maximize from left to right in red/yellow/green. They are vertically centered, have consistent gaps, and do not move other workbench regions unexpectedly.             |
| Maximized window         | Maximize with the green control and separately with the normal Windows gesture.                                                     | Controls remain aligned at upper left. The green glyph changes to the restore representation; its action restores the same window. No edge clipping or incorrect reserved space appears.                         |
| Restored window          | Restore from maximized state.                                                                                                       | Green glyph returns to maximize and its action maximizes. Geometry matches the initial normal-window state.                                                                                                      |
| Inactive window          | Open two windows, focus the other one, and inspect the first.                                                                       | All three circles become intentionally subdued/neutral under the inactive titlebar class while remaining distinguishable. Refocusing restores active colors.                                                     |
| Hover state              | Move the pointer into the traffic-light region, across each control, then out.                                                      | Hovering the container reveals close, minimize, and state-correct maximize/restore glyphs. The stock rectangular Windows hover backgrounds do not appear. Glyphs disappear when the region is no longer hovered. |
| Close action             | In a scratch window, create an unsaved file and click red. Test Cancel, then close again and choose a safe disposition.             | VS Code's normal dirty-editor prompt and close behavior occur for the intended window. No synthetic command behavior or immediate data loss occurs.                                                              |
| Minimize action          | Click yellow.                                                                                                                       | The intended window minimizes to the Windows taskbar and restores normally from it. Other VS Code windows remain unchanged.                                                                                      |
| Maximize action          | From restored state, click green.                                                                                                   | The intended window maximizes once; the green glyph becomes restore.                                                                                                                                             |
| Restore action           | From maximized state, click green.                                                                                                  | The intended window returns to its previous restored bounds; the green glyph becomes maximize.                                                                                                                   |
| Titlebar double-click    | Double-click a blank draggable titlebar area away from controls, menu items, navigation, and Command Center. Repeat in both states. | The normal VS Code/Windows maximize-restore toggle works. The independently positioned controls do not consume the blank drag region.                                                                            |
| Window dragging          | Drag from several blank titlebar points, including near but outside the traffic-light hit region.                                   | The window moves normally. Drag starting directly on a control does not move the window and a deliberate click still activates that control.                                                                     |
| Fullscreen               | Toggle fullscreen with F11 and return.                                                                                              | The traffic-light container is hidden in fullscreen and left padding is removed. Leaving fullscreen restores the controls and reserved space without duplication or drift.                                       |
| Multiple VS Code windows | Open at least three windows, maximize one, leave one restored, and move focus among them.                                           | Each window's actions target itself, maximize/restore glyphs reflect each window independently, and only inactive windows use inactive styling.                                                                  |

## Titlebar layout, display, and zoom matrix

Change one variable at a time. When a fresh renderer is required, cancel every
broad Custom UI Style restart prompt and safely relaunch only the intended
application normally. Repeat at both a comfortable wide width and the narrowest
practical window width.

| Case                     | Procedure                                                                                                                                                   | Expected behavior                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command Center enabled   | Set `window.commandCenter` to `true`. Test normal and narrow widths.                                                                                        | Command Center remains usable and is not covered by the traffic lights. Left reserved space does not force it off-screen prematurely.                                                     |
| Command Center disabled  | Set `window.commandCenter` to `false`.                                                                                                                      | Window title/navigation layout remains natural; the extension does not re-enable or replace Command Center.                                                                               |
| Menu bar visible/classic | Select the normal visible/classic menu-bar mode supported by the tested VS Code build. Exercise each menu.                                                  | Menu items remain visible, clickable, and clear of the left traffic-light region. The extension does not change the menu setting.                                                         |
| Menu bar compact         | Set `window.menuBarVisibility` to `compact` and use its menu control.                                                                                       | The compact control remains visible/clickable and does not overlap the traffic lights. Disable later preserves/restores only extension-owned titlebar settings, not this menu choice.     |
| Menu bar hidden          | Set `window.menuBarVisibility` to `hidden`; exercise its normal keyboard reveal behavior if applicable.                                                     | Traffic-light geometry remains correct and no phantom gap beyond the reserved control area appears. The extension does not reveal or hide the menu itself.                                |
| 100% Windows scaling     | Set the test display to 100%, restart/sign in if Windows requires it, and inspect normal/maximized/narrow windows.                                          | Circles are sharp, centered, evenly spaced, clickable, and non-overlapping. The titlebar drag region remains usable.                                                                      |
| Non-100% Windows scaling | Repeat at a commonly used value such as 125%, 150%, or 200%; record the exact value and monitor arrangement.                                                | Controls remain centered, visually round, and correctly hit-tested with no clipping, fractional-pixel drift, or overlap. Record each scale actually tested.                               |
| VS Code zoom changed     | Test `window.zoomLevel` below, at, and above zero (for example -1, 0, and 1/2). Include a reload/restart and both counter-zoom paths observed by the build. | The control region remains usable and aligned. Reserved space and container width scale consistently; controls do not drift away from the left edge or collide with content.              |
| Narrow window            | Reduce width until VS Code starts applying its own titlebar overflow behavior.                                                                              | Traffic lights remain visible and clickable. Upstream overflow may hide optional titlebar actions, but controls must not overlap them or fall outside the window.                         |
| Multi-monitor move       | If available, move restored and maximized windows between displays with different scaling.                                                                  | Controls re-render correctly on the destination display and native maximize/restore behavior remains correct. Record if this hardware case was unavailable rather than marking it passed. |

## Environment and theme matrix

| Case                      | Procedure                                                                                                       | Expected behavior                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Windows folder      | Open a local folder in the disposable VS Code copy.                                                             | Diagnose reports the supported Windows desktop UI host and the controls work as above.                                                                                                                    |
| Remote - WSL workspace    | Install both extensions locally, connect to a WSL folder, then run Diagnose and the principal click/drag tests. | The extension remains active in the local UI; Diagnose reports `win32`/desktop/Visual Studio Code, the CSS URI is local, and no Linux remote-host path is used. Titlebar behavior matches a local folder. |
| Light theme               | Use a built-in light theme and test active, inactive, hover, and narrow states.                                 | Traffic-light colors, glyphs, borders, and titlebar content remain legible; no stock rectangular hover background leaks through.                                                                          |
| Dark theme                | Use a built-in dark theme and repeat the same states.                                                           | Colors and glyphs remain legible and aligned; inactive styling is deliberate rather than a theme accident.                                                                                                |
| High-contrast dark theme  | Use VS Code's built-in high-contrast dark theme and Windows contrast settings when available.                   | Each circle gains the theme-provided contrast outline, glyphs remain visible on hover, and titlebar content remains usable.                                                                               |
| High-contrast light theme | Use the built-in high-contrast light theme when available.                                                      | The contrast outline uses `--vscode-contrastBorder`; circles/glyphs remain visible without hiding or replacing controls.                                                                                  |

## Accessibility matrix

The extension does not add ARIA, roles, labels, or keyboard handlers; it keeps
the exact upstream elements. Therefore the correct target is **no regression
from stock VS Code custom controls**, not an unverified claim that upstream
controls expose a particular accessibility tree on every version.

| Case                      | Procedure                                                                                                                 | Expected behavior                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility tree        | Before Enable and after Enable, inspect the titlebar with Accessibility Insights for Windows or an equivalent tool.       | The same three upstream control nodes/representations remain; CSS has not replaced, hidden (outside fullscreen), duplicated, or relabeled them. Record any stock limitation separately from a regression. |
| Screen reader comparison  | With Narrator or the team's supported screen reader, compare navigation/announcements before and after Enable.            | Existing announcements and interaction behavior are unchanged from stock custom controls. Visual glyph replacement does not introduce spoken base64/emoji content.                                        |
| Keyboard/system shortcuts | Test Alt+F4, Alt+Space/system menu behavior, and normal keyboard access to titlebar/menu features. Compare with baseline. | Standard VS Code/Windows behavior remains. The CSS adds no key handler and does not trap focus. If stock controls are not tab stops, do not misreport that baseline behavior as a new regression.         |
| Pointer hit targets       | At each tested display scale and zoom level, approach circle edges and click each control deliberately.                   | Each visual maps to the intended native control with no dead zones or neighboring activation. Note that the current width is about 20 px and make no target-size conformance claim until assessed.        |
| Color differentiation     | Test active colors with a color-vision simulator/filter if available and inspect hover glyphs.                            | Function is also conveyed by stable position and distinct hover glyph geometry; no action is silently swapped because of color. Record whether non-hover discoverability needs improvement.               |
| High contrast             | Complete both high-contrast theme rows above and inspect focus/hover/system-menu behavior.                                | Theme contrast outlines appear and the controls remain operable. No `forced-color-adjust` override defeats the user's contrast selection.                                                                 |
| Magnification             | Use Windows Magnifier at a practical zoom and repeat hover/click/drag checks.                                             | Circles and glyphs remain crisp enough to identify; magnification does not expose clipping or overlap hidden at normal scale.                                                                             |
| Motion sensitivity        | Observe the 110 ms color/opacity transitions and compare with OS/VS Code reduced-motion behavior.                         | Motion is brief, non-essential, and does not delay activation. Record a failure if the absence of an explicit reduced-motion override is problematic for the target policy.                               |

## Configuration and lifecycle matrix

Run these in the disposable copy. Save User Settings (JSON) and Diagnose output
before and after each scenario.

| Scenario                              | Procedure                                                                                                                                                                        | Expected behavior                                                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enable idempotency                    | From disabled baseline, run Enable, cancel every broad restart prompt, and safely relaunch the intended application. Run Enable again and record/cancel any no-op reload prompt. | Exactly one current CSS import exists, no stale import exists, the original pre-first-Enable baseline is retained, and no unrelated setting changes.                                                                                                                          |
| Disable idempotency                   | Disable, cancel every broad restart prompt, safely relaunch the intended application, then run Disable again.                                                                    | First run removes owned imports/restores safe settings; second reports already disabled and changes nothing.                                                                                                                                                                  |
| Absent global baseline                | Remove explicit global values for both managed settings and external imports, Enable, then Disable.                                                                              | Disable removes the explicit titlebar keys. If the remaining imports equal the former effective inherited list, it also removes the explicit global imports value.                                                                                                            |
| Explicit global baseline              | Set both managed settings to explicit valid non-custom baseline values, record them, Enable, then Disable without intervening edits.                                             | Enable writes `custom`; Disable restores the exact explicit baseline strings.                                                                                                                                                                                                 |
| User change while enabled             | Enable, manually change one managed global setting away from `custom`, then run Disable without Reapply.                                                                         | Disable preserves the user's newer value and reports that it intentionally did not overwrite that key. Other safely owned values are restored.                                                                                                                                |
| Reapply repairs managed state         | Enable, manually change one managed setting, then explicitly run Reapply.                                                                                                        | Reapply writes that managed setting back to `custom` and retains the original pre-Enable rollback baseline. This is expected because Reapply is an explicit repair.                                                                                                           |
| Workspace override conflict           | Set a workspace/workspace-folder override for a managed setting to a non-`custom` value, then run Enable.                                                                        | Enable stops with the scope named and instructs removal/change of the override. It does not claim the effective value was applied.                                                                                                                                            |
| Unrelated external import             | Add a valid, harmless local CSS import before Enable; record its exact JSON entry. Enable and Disable.                                                                           | The unrelated import survives byte-for-JSON-value and relative-order semantics; only this extension's URI is inserted/removed.                                                                                                                                                |
| Duplicate current imports             | In the disposable profile only, duplicate this extension's exact URI while enabled, then run Reapply.                                                                            | Reapply leaves exactly one current owned URI and preserves unrelated entries.                                                                                                                                                                                                 |
| Stale version URI                     | When two package versions are available, enable the older VSIX, install the newer VSIX, and safely relaunch the intended application.                                            | Activation replaces the stale owned URI with the current one and offers Reapply. Reapply followed by a safe intended-application relaunch leaves one current URI and no stale URI.                                                                                            |
| Load strategy `disable`               | While disabled, set `custom-ui-style.external.loadStrategy` to `disable`, snapshot settings/imports, and run Enable.                                                             | Enable stops before intentional titlebar/import mutation, explains the conflict, and does not rewrite the strategy. Diagnose reports it.                                                                                                                                      |
| Load strategy `cache`                 | Set strategy to `cache`, Enable, and inspect the result. In a development host, change CSS content without changing its URI and run Reapply.                                     | Enable retains/reports cache mode. A same-URI content edit may remain cached; switching to `refetch` and Reapply must load it. Record this as expected cache behavior, not extension live reload.                                                                             |
| Cancel restart prompt                 | Change from a clean disabled state with Enable, then select **Cancel** on every Custom UI Style **Restart APP** prompt.                                                          | Configuration/Diagnose may show enabled and one import while the current UI remains old. Inspect Custom UI Style output, safely relaunch only the intended application, and visually verify a fresh renderer. Reapply only if patching or managed-state repair is incomplete. |
| Duplicate watcher prompt              | With Custom UI Style's default watcher enabled, run Enable/Reapply, observe all notifications, and select **Cancel** on every broad restart prompt.                              | Record each watcher-triggered prompt in addition to the explicit reload prompt. Complete one safe intended-application relaunch and flag any duplicate/race as a compatibility result.                                                                                        |
| Upstream patch failure reporting      | In the disposable copy only, observe a real or safely induced Custom UI Style permission/patch error and compare both output channels.                                           | Custom UI Style may log an internal failure while its public command returns. macOS Traffic Lights must not be treated as visual success; correct the failure, Reapply/Disable as appropriate, and retry.                                                                     |
| Import cleanup interrupted            | While enabled, make the external-import value invalid under the documented schema, then run Disable.                                                                             | Disable retains a pending transaction, reports import cleanup incomplete, and still restores safely owned titlebar settings. Correct the import and run Disable again to request reload and finish.                                                                           |
| Repair blocked during pending Disable | After creating the interrupted-Disable state above, try Enable and Reapply before fixing it.                                                                                     | Both commands stop and direct the user to run Disable again; neither replaces the original restoration baseline or starts a new apply transaction.                                                                                                                            |
| Dependency unavailable during Disable | Enable, then disable/uninstall Custom UI Style in the disposable profile and run Disable.                                                                                        | Safely owned settings are restored and pending cleanup is retained. Re-enable Custom UI Style, run macOS Traffic Lights: Disable again, inspect output, cancel every broad restart prompt, and safely relaunch the intended application to complete/clear the transaction.    |
| Other Custom UI Style options         | Before Enable, set harmless non-default options outside external imports (without introducing Electron/frame changes). Enable/Reapply/Disable.                                   | This extension never rewrites stylesheet, Electron, webview, font/background, or extension-patching settings.                                                                                                                                                                 |

For a stale-URI fixture, do not invent a broad path containing only the asset
filename. Ownership intentionally requires an exact recorded URI or the exact
versioned extension-directory and asset-tail convention as a sibling under the
same current extension-installation parent and file-URL host. Prefer a genuine
two-version upgrade test.

## Reapply after a VS Code update

Use this procedure in the disposable application copy before updating a
production installation:

1. Disable macOS Traffic Lights, select **Cancel** on every Custom UI Style
   **Restart APP** prompt, and safely relaunch only the intended application.
2. Update/replace the disposable VS Code application with the target version,
   retaining a backup of the disposable copy if recovery is needed.
3. Run `npm run verify:upstream -- --ref <exact-ref>` from the project checkout.
4. Launch the updated disposable VS Code using the same isolated user data and
   extension directory.
5. Confirm Custom UI Style has a valid backup for the updated application as
   required by its workflow.
6. Run Diagnose, then Enable or Reapply as appropriate. Select **Cancel** on
   every Custom UI Style **Restart APP** prompt, inspect its output, and safely
   relaunch only the intended application.
7. Run every required matrix row. A passing text verifier does not shorten the
   visual matrix.

## Failure capture and rollback

If any visual or behavior case fails:

1. Stop destructive experimentation and run **macOS Traffic Lights: Diagnose**.
2. Record the exact VS Code/Custom UI Style/VSIX versions, Windows scaling,
   `window.zoomLevel`, theme, menu mode, Command Center state, window state, and
   whether the workspace is Remote - WSL.
3. Capture the macOS Traffic Lights and Custom UI Style output channels without
   adding sensitive paths to a public issue.
4. Capture a focused screenshot/video and the actual versus expected matrix row.
5. Run **macOS Traffic Lights: Disable**. If it reports incomplete cleanup,
   preserve the extension/state, correct the named cause, and run Disable again.
6. Inspect Custom UI Style output, select **Cancel** on every **Restart APP**
   prompt, safely relaunch only the intended application, and confirm owned
   imports are gone, safely owned settings are restored, and stock visuals
   returned.
7. If Custom UI Style itself cannot rebuild after a retry, use its documented
   rollback in the disposable copy. Remember that its rollback affects all of
   its managed customizations, not only this extension.
8. Mark the version partial/fail. Do not add it to `visuallyTestedVersions`.

## Full hardening exit criteria

The following is the preferred full-hardening target. A release may use a
narrower declared qualification scope only when every release-blocking case
passes, deferred cases are classified as non-blocking, the exact boundary is
published, and final rollback is clean. “Supported and tested” therefore means
tested to the recorded release scope; it is not an accessibility-conformance or
all-hardware certification.

The full-hardening target is met when:

- every required row has a concrete pass or a documented, approved
  not-applicable reason tied to unavailable hardware;
- close/minimize/maximize/restore remain VS Code-native and target the correct
  window;
- drag, double-click, fullscreen, and multi-window behavior pass;
- command center, all menu modes, 100% and at least one non-100% display scale,
  and changed VS Code zoom pass;
- local and Remote - WSL workspaces pass;
- light, dark, and both available high-contrast modes pass;
- accessibility comparison finds no extension-caused semantic regression;
- Enable/Disable idempotency, unrelated-import preservation, explicit/absent
  restoration, user-change preservation, interrupted Disable retry, and reload
  error/reporting behavior pass; and
- the final Disable and safe intended-application relaunch return the disposable
  copy to its recorded baseline.

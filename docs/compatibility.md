# Compatibility policy and upstream verification

## Supported runtime

Version 1 has one supported runtime family:

| Dimension            | Supported                                | Rejected                                                |
| -------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Product              | Microsoft Visual Studio Code             | Cursor, Windsurf, VSCodium, Code - OSS, and other forks |
| Host                 | Desktop UI                               | Browser/web UI                                          |
| Operating system     | Windows                                  | Linux and macOS                                         |
| VS Code version      | 1.99.0 or newer                          | Older than 1.99.0 or unparseable versions               |
| Extension location   | Local UI extension host                  | Linux/WSL remote extension host                         |
| Injection dependency | Available `subframe7536.custom-ui-style` | Missing or disabled dependency                          |

An open Remote - WSL folder remains supported because the extension declares
`"extensionKind": ["ui"]` and operates in the local Windows UI. Diagnose should
still report Windows, desktop, and the exact application name
`Visual Studio Code`.

Enable and Reapply validate this runtime before intentionally changing
configuration. Unsupported environments receive an actionable message and are
not styled optimistically. Disable remains available as a cleanup path.

## Why 1.99 is the minimum

The fetched VS Code `1.98.0` source does not expose the required
`window.controlsStyle`/`WindowControlsStyle` contract. Fetched `1.99.0` does,
including the `custom` mode used to create VS Code-owned Windows/Linux control
elements. The minimum engine and runtime compatibility boundary is therefore
`1.99.0`.

The project deliberately has no latest-tested maximum. A later VS Code version
normally remains runnable with a warning-level compatibility result; it is not
automatically disabled merely because it is newer than the newest recorded
visual test.

## Version compatibility results

For parseable versions, the classifier reports three states:

- **supported and tested** — the normalized running version is at least 1.99.0
  and exactly appears in `compatibility.json`'s `visuallyTestedVersions` list;
- **supported but untested** — the normalized version is at least 1.99.0 but
  does not appear in that visual-test list; or
- **unsupported** — the normalized version is below 1.99.0.

An unparseable version is reported as unknown and Enable/Reapply stop rather
than guessing. A prerelease suffix is ignored for numeric minimum comparison,
but a version is “tested” only through its normalized `major.minor.patch` entry.

**Current status:** VS Code 1.132.0 is listed in `visuallyTestedVersions` after
the isolated Windows compatibility Passes A-C and the release-blocking Pass D
core scope completed with a clean final rollback. Non-release-blocking hardening
for literal controller-limited titlebar drag, dedicated accessibility-tool
certification, same-URI `cache` refresh, live Reapply rejection with external
loading disabled, dependency-loss recovery, and persisted interrupted-Disable
resume was deferred and is not claimed as passed. Other parseable Microsoft
Visual Studio Code Desktop versions at or above 1.99.0 remain **supported but
untested**. The pinned source inspection at the VS Code 1.133.0 development
snapshot is maintenance evidence, not a visual-test claim for that version.

## Machine-readable record

[`compatibility.json`](../compatibility.json) is the single runtime record. It
contains:

- schema version;
- minimum supported VS Code version;
- the source version and exact VS Code commit inspected during development;
- the Custom UI Style version and exact commit inspected during development;
- the explicit list of visually tested VS Code versions; and
- the critical selector names.

The source-inspected VS Code commit is
`78a7b6c291b5ac8d85fa32cfa3feacb649057b84` (source package `1.133.0`; highest
fetched stable tag `1.132.0`). Custom UI Style was inspected at version 0.7.1,
commit `217c5167802e864005ca2d32e1cb9cf1b85713c6`.

Do not add a value to `visuallyTestedVersions` merely because the upstream
script passes or unit tests are green. Add it only after the declared
release-qualification scope has observed results on that exact VS Code version,
all release-blocking cases pass, every deferral is explicitly classified and
disclosed, and the result is recorded in the change/release evidence.

## Critical upstream contract

The maintenance verifier checks small semantic expectations across upstream
source instead of fixed line numbers or one large exact block:

| Contract                                                | Why it matters                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `window.controlsStyle`                                  | The extension-managed configuration key must still exist.                           |
| `WindowControlsStyle.CUSTOM` or its semantic equivalent | VS Code must still provide custom Windows/Linux controls.                           |
| `.window-controls-container`                            | The existing controls need a titlebar-scoped container to position.                 |
| `.window-icon`                                          | The shared control element scope must remain identifiable.                          |
| `.window-minimize`                                      | The existing minimize semantic element must remain identifiable.                    |
| `.window-max-restore`                                   | One upstream element must continue to own maximize/restore behavior and state.      |
| `.window-close`                                         | The existing close semantic element must remain identifiable.                       |
| Matching titlebar CSS selectors                         | The visual override must still have an upstream presentation contract to supersede. |

The verifier examines the window contract, browser titlebar construction, native
Electron titlebar implementation, and titlebar CSS where appropriate. It
understands the current `electron-browser` path and the 1.99-era
`electron-sandbox` equivalent rather than requiring one directory layout for all
refs.

The full unsupported surface is larger than this minimum list. The stylesheet
also relies on titlebar state, zoom/counter-zoom, fullscreen, inactive,
high-contrast, and maximize/restore codicon classes. Review
[the architecture surface budget](architecture.md#unsupported-surface-budget)
and execute the manual matrix even when the script passes.

## Running the verifier

Install locked dependencies, then pass an explicit VS Code Git ref:

```bash
npm ci
npm run verify:upstream -- --ref 1.132.0
```

Common forms are:

```bash
# Inspect the current remote main branch through a shallow sparse checkout.
npm run verify:upstream -- --ref main

# Force a specific local VS Code checkout; never fall back to the network.
npm run verify:upstream -- --ref 1.99.0 --repo .reference/vscode

# Show all supported options.
npm run verify:upstream -- --help
```

`--ref <git-ref>` is the documented interface. A positional ref is accepted for
convenience, but automation and maintenance notes should use the explicit
option.

A hexadecimal commit ID must use its full 40-character SHA. Abbreviated
hexadecimal refs are rejected before source selection because a shallow remote
fetch cannot portably resolve them.

### Source selection and cleanup

When `--repo` is supplied, the script uses only that local Git repository. If
the path is invalid or the ref cannot be resolved there, it fails without a
network fallback.

Without `--repo`, the script first uses `.reference/vscode` if the requested ref
resolves in that checkout. Otherwise it creates a temporary, shallow, filtered,
sparse checkout from `https://github.com/microsoft/vscode.git`, fetches only the
explicit ref and relevant titlebar files, performs the checks, and cleans the
temporary checkout. The reference repository is maintenance input and is never
packaged.

### Reading the result

A successful run means every checked semantic contract was found at that ref. It
does **not** mean the CSS looks correct, that click/drag behavior was tested, or
that the version is supported-and-tested.

On failure, the script identifies each missing expected concept. Treat that as
an investigation prompt:

1. Inspect the upstream commit and find whether the concept moved, was renamed,
   or was removed.
2. Determine whether VS Code still supplies native-behavior control elements
   under a new contract.
3. Update the verifier only after identifying the new semantic equivalent; do
   not weaken it merely to make CI green.
4. Update CSS and lifecycle code if needed.
5. Run deterministic project checks, build a VSIX, and execute the full manual
   Windows matrix.
6. Update `compatibility.json`, this document, and
   [upstream analysis](upstream-analysis.md) with the newly inspected immutable
   commit.

If the upstream contract has disappeared and preserving native controls is no
longer possible with CSS, stop. Record the blocker and reconsider the
architecture before introducing any Electron-level patch.

### Verifier validation performed during 0.1.0 development

The maintenance tool itself was exercised against multiple real source layouts:

- current local `main`, commit `78a7b6c291b5ac8d85fa32cfa3feacb649057b84`: all
  nine contracts passed through the current `electron-browser` path;
- tag `1.99.0`, commit `4437686ffebaf200fa4a6e6e67f735f3edf24ada`: all nine
  contracts passed through the historical `electron-sandbox` path;
- tag `1.101.0`, commit `dfaf44141ea9deb3b4096f7cd6d24e00c147a4b1`: all nine
  contracts passed using an actual shallow sparse temporary network checkout;
- tag `1.98.0`: the script exited unsuccessfully and listed seven missing
  contracts individually, matching the expected pre-`controlsStyle` boundary;
  and
- an unavailable ref with explicit `--repo`: the script exited unsuccessfully
  without falling back to the network.

These are verifier behavior/source-contract results only. They do not populate
`visuallyTestedVersions` and do not replace the Windows matrix.

## CI separation

The core workflow is `.github/workflows/ci.yml`, named **CI**, and runs on push
and pull requests. It installs the lockfile, checks formatting and lint, runs
TypeScript checking and unit tests, builds the bundle, packages the VSIX, and
inspects its contents. It does not run the network-dependent upstream checkout,
so a GitHub outage cannot fail otherwise deterministic project checks.

The separate `.github/workflows/upstream-compatibility.yml` workflow is named
**Upstream compatibility**. It supports:

- manual `workflow_dispatch` with a required `vscode_ref` input (default
  `main`); and
- a low-frequency monthly schedule (`17 6 1 * *`).

A scheduled failure is a maintenance signal, not proof that users' existing
installations are broken. Investigate the exact ref and then run the Windows
manual matrix before changing support claims.

## Custom UI Style compatibility

The inspected 0.7.1 contract is:

- dependency ID `subframe7536.custom-ui-style`;
- external import setting `custom-ui-style.external.imports`;
- load strategy setting `custom-ui-style.external.loadStrategy` with `refetch`,
  `cache`, and `disable`;
- public command `custom-ui-style.reload`; and
- a full-application restart path on VS Code >= 1.95 whose inspected Windows
  implementation terminates by executable image name; this project requires
  cancelling its **Restart APP** prompt.

The package version in `compatibility.json` records what was inspected; the
extension currently detects API/settings availability rather than imposing an
artificial exact-version block. After a dependency update, repeat the source
analysis for import parsing, cache keys, disable behavior, public reload,
backup/rollback, and restart handling.

`refetch` is the recommended strategy. `cache` is supported but caches by URI
set rather than local file content, so same-URI development edits can remain
stale. `disable` is a user opt-out that Enable/Reapply respect by stopping with
instructions rather than rewriting it.

## Release compatibility checklist

Before claiming a newly tested VS Code version:

- [ ] Pin and record the exact VS Code commit and source version.
- [ ] Run the upstream verifier at that exact ref.
- [ ] Review each CSS-only internal assumption beyond the core check.
- [ ] Run `npm ci` and `npm run check`.
- [ ] Package and inspect the VSIX.
- [ ] Confirm the VSIX includes compiled extension code, the CSS asset, README,
      CHANGELOG, and LICENSE.
- [ ] Confirm it excludes `.reference`, tests, temporary screenshots, and source
      maps.
- [ ] Complete every release-blocking case required by the declared release
      scope in [Manual testing](manual-testing.md) on Windows, and explicitly
      record any permitted non-blocking deferral or controller limitation.
- [ ] Complete rollback/idempotency and user-change-preservation scenarios.
- [ ] Update `visuallyTestedVersions` only after all required cases pass.
- [ ] Record limitations or failures rather than converting a partial run into a
      supported-and-tested claim.

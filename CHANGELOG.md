# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

No unreleased changes are recorded yet.

## 0.1.0 - 2026-09-28

### Added

- Initial Microsoft Visual Studio Code Desktop extension for Windows and VS Code
  1.99.0 or newer.
- Local-UI extension architecture using VS Code's custom titlebar and existing
  custom window-control elements.
- Original, Windows/titlebar-scoped traffic-light CSS with close, minimize,
  maximize, restore, hover, inactive, high-contrast, zoom, and fullscreen
  presentation.
- Enable, Disable, Reapply, and path-redacted Diagnose commands under the
  `macosTrafficLights` command namespace.
- Custom UI Style external-import integration using one packaged local CSS URI
  and the public `custom-ui-style.reload` command.
- Exact import ownership constrained to recorded URIs or versioned sibling
  installation paths, duplicate prevention, stale URI replacement,
  unrelated-import preservation, and activation-time upgrade reconciliation.
- Versioned global-state restoration records that distinguish absent and
  explicit global values, track pending/completed writes, reloads, and Disable
  transactions, restore only extension-owned values, and preserve later user
  changes on Disable.
- Retryable Disable cleanup that continues safe setting restoration after an
  import-inspection failure, retains incomplete state, and blocks Enable/Reapply
  until rollback finishes.
- Passive command-result and startup-action notifications whose display lifetime
  cannot retain the shared operation queue; selecting an exact startup recovery
  action still queues the intended Disable or Reapply command.
- Strict environment, minimum-version, managed-scope, dependency, and external
  load-strategy validation.
- Machine-readable compatibility metadata and an explicit upstream source
  verifier separated from deterministic CI.
- Unit coverage for import reconciliation, restoration decisions, version
  comparison, platform/application classification, and Custom UI Style
  dependency-state classification.
- Locked development dependencies, strict TypeScript configuration, lint and
  formatting checks, bundle/VSIX packaging commands, core CI, and a separate
  scheduled/manual upstream compatibility workflow.
- An original 256 px Marketplace icon and an exact 14-entry VSIX package
  allowlist that excludes test evidence, test reports, scripts, source, and
  repository-only configuration.
- Architecture, pinned upstream/clean-room analysis, compatibility policy,
  complete manual Windows matrix, restart/cache guidance, rollback guidance,
  Remote - WSL model, and troubleshooting documentation.

### Safety

- The runtime registers local CSS only and performs no normal-activation network
  request.
- No renderer JavaScript injection, CSP change, webview patch, APC dependency,
  `hiddenInset`, frameless Electron configuration, direct BrowserWindow patch,
  replacement controls, VS Code fork, or direct VS Code installation-file write
  is implemented by this project.
- Menu bar, Command Center, Activity Bar, fonts, editor settings, workbench
  layout, and unrelated Custom UI Style configuration are left user-owned.

### Verification

- Release-qualified VS Code 1.132.0 in an isolated Windows application copy
  through compatibility Passes A-C and the release-blocking Pass D lifecycle
  core, followed by a clean final Disable/rollback.
- Recorded 1.132.0 in `visuallyTestedVersions`; other supported versions remain
  supported but untested.
- Deferred non-release-blocking hardening for literal controller-limited
  titlebar drag, dedicated accessibility-tool certification, same-URI `cache`
  refresh, live Reapply rejection with external loading disabled,
  dependency-loss recovery, and persisted interrupted-Disable resume. No pass or
  accessibility-conformance claim is made for those deferred cases.

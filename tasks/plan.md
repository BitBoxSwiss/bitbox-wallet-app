# CSD simplification implementation plan

Status: implemented and packaged for Linux and Windows. Native macOS and manual
visual acceptance remain pending. Evidence: [results.md](results.md). Source baseline: `c263a90b4`,
branch `codex/desktop-csd-lean`. Intended implementation branch:
`codex/csd-core-simplification`. Tasks are tracked in [todo.md](todo.md).

## Outcome and boundaries

Keep this application a complete design playground for non-developers. Make the
CSD code easier to understand, maintain and eventually reuse in the official app.
Preserve all current features, appearance, settings and platform behavior.

Refactor shared code as well as Windows/macOS-specific integration. Keep one
`DesktopWindow` and the existing QWindowKit dependency. Do not introduce platform
adapter hierarchies, another IPC mechanism, a new dependency, or a new build
framework. Do not redesign controls, headers, scrollbars, shadows or animations.
Browser/mobile behavior and wallet/backend business logic are outside this work.

Success means fewer unnecessary responsibilities, branches or duplicated state,
with a measured, reviewable diff and equivalent behavior. A file move is an
extraction improvement, not a source-size reduction. Do not remove correct code
to meet a line-count target. A production-readiness claim requires actual macOS
verification, which is unavailable in this iteration.

Use the existing Qt and web interfaces as the test surface. Keep a clear module
for native window behavior and put general file saving on the existing desktop
bridge. Do not create an additional interface or adapter merely to move code or
make a test convenient. Reuse or retarget existing regressions; add tests only
for missing observable behavior.

## Findings from the current source

| Area | Finding | Decision |
| --- | --- | --- |
| Shared window | `desktopwindow.cpp` already handles all three platforms | Simplify in place; do not split into three implementations |
| Windows | Custom controls are registered as QWindowKit system buttons; a vendored native hit-test patch provides resize targets | Preserve registration and patch; add Windows-native checks before changing shared control code |
| macOS | Real AppKit traffic lights use `setSystemButtonArea(QWidget*)`; the pinned API is explicitly experimental | Keep this integration and its registration order; no callback replacement without a Mac |
| QWindowKit | `setTitleBar()` clears system-button and hit-test references | Establish the title widget once before registering controls/exclusions |
| Playground export | `WindowChrome` contains preset file-dialog and atomic-write code | Move it to the existing general desktop bridge, preserving behavior |
| Controls | Several loops cast the same three buttons and repeat action/style decisions | Consider a typed collection and small shared metrics; keep the simple loops if a replacement is larger |
| Native state | `state()` exports top-level `width`/`height` that have no identified frontend consumer | Verify all callers, then remove only these unused output fields; retain viewport sizes in incoming layout validation |
| Protocol | Revision/sequence, finite/bounded geometry and one update in flight prevent real failure cases | Preserve them and their regression tests |
| Linux rendering | Transparency recovery, mask guard, cached shadow and edge widgets cover previously reproduced bugs | Leave their behavior intact in this pass |
| Native tests | The existing qmake test project unconditionally imports D-Bus/Wayland and Linux fixtures | Add a small Windows fixture through the same project; retain the existing Linux fixture |

Baseline physical source lines, including blanks/comments:

| Files | Lines |
| --- | ---: |
| `desktopwindow.cpp` / `.h` | 652 / 77 |
| `linuxdecorationpreferences.cpp` / `.h` | 226 / 52 |
| `windowchrome.h` | 46 |
| Native subtotal | 1,053 |
| Web chrome utility, frame utility, chrome component, startup component | 356 + 44 + 51 + 43 = 494 |

Record before/after bytes and lines for the same files, plus *all* touched
production files, tests and configuration separately. Include moved code and
vendored modifications in the accounting. Performance improvements require
measurements; smaller source alone does not prove lower CPU or memory use.

## Architecture to retain

- Qt/QWindowKit receive native pointer events and perform OS move/resize actions.
  No JavaScript pointer-event round trip or CSS `app-region` workaround.
- The web UI owns its visual surfaces. It asynchronously reports drag/exclusion
  geometry, button ink colors, labels and appearance through the existing channel.
- `WindowChrome` remains a narrow QObject interface; it must not expose QWidget
  methods or general file-saving behavior.
- The already-registered `WebClass` bridge can host the preset save operation.
  Reuse the existing file-dialog module for a testable save function if needed.
  Preserve GUI-thread execution, an appropriate live window parent, the 64 KiB
  limit, caption bounds, cancel/error/success results and `QSaveFile` atomicity.
- Playground presentation choices remain optional inputs. Preserve stored keys
  and feature availability; do not invent a settings migration or plugin system.
- Keep top-frame-only isolated WebChannel access, safe drag fallback on stale or
  excessive exclusions, and the native-frame fallback when agent setup fails.

The file-dialog module is a reuse candidate, not a mandatory extraction. Use the
smallest implementation that keeps one save body, safe GUI-thread execution and
testable results. Do not alter the Go backend's existing file-dialog callbacks or
their thread-marshalling behavior as part of this move.

Qt documents WebChannel calls as asynchronous. Its system move/resize APIs
preserve compositor interactions that manual positioning cannot provide on
Wayland. These support retaining the current separation of responsibilities.

## Implementation order

### 1. Baseline and native Windows coverage

Create the local comparison branch from the recorded baseline, preserving any
unrelated work. Verify the baseline Linux tests and Windows build/runtime before
attributing a failure to this refactor. Extend `tests/desktopwindow.pro` with
platform scopes: keep the Linux test source and dependencies on Linux; select a
small Windows test source with the necessary Windows link libraries on Windows.
Do not rewrite the Linux suite to force every compositor-specific assertion to
be portable.

Windows checks should exercise actual `WM_NCHITTEST` results: maximize-button
center retains `HTZOOM`, edges/corners resize, maximized/fullscreen windows do
not gain inner resize bands, and fixed dimensions disable the corresponding
edges. Use native coordinate conversion, not an assumed device-pixel ratio.
Use isolated QSettings; do not change VM system preferences or touch wallets.
Match the existing fixture's required Qt initialization, including
`AA_DontCreateNativeWidgetSiblings` before constructing QApplication. Keep the
Windows fixture free of Linux-only includes and module/link dependencies.

Checkpoint: baseline failures are recorded separately; the existing Linux suite
continues to run and the new Windows target builds/runs on the real Windows VM.

### 2. Remove preset saving from the CSD boundary

Make one atomic change across the native method, web caller and relevant tests.
The desktop frontend and native shell are built and distributed together; there
is no requirement to support a separately deployed older frontend. Do not add a
temporary endpoint, forwarding wrapper, compatibility flag or migration phase.

Add the save entry point to the existing general desktop bridge, route the web
caller through the general Qt transport, and remove it from `WindowChrome` and
its TS type. Preserve result/error semantics. Give the dialog the original live
window parent or an equivalent lifetime-safe reference; do not assume an active
window exists. Keep the bridge QObject in the GUI thread and preserve its Go
call/notification behavior and shutdown lifetime.

Retarget the existing oversize and preset regressions to the new route. Add a
small asynchronous transport test only for the missing end-to-end bridge result
contract. Cover save/cancel/write failure at the appropriate existing test seam;
do not duplicate these through every wrapper. Check closing/cancelling the modal
dialog with a pending frame update, without inventing a heartbeat or watchdog.

Likely files: `windowchrome.h`, `webclass.h`, minimal initialization in
`main.cpp`, `transport-qt.ts`, `desktop-chrome.ts`, the preset component and their
focused tests. The existing file-dialog files change only if genuinely reused.
Keep these coupled interface edits in one small commit even though the operation
crosses several files; splitting it into incompatible intermediate states or
temporary shims would add work without providing a deployment benefit.

Checkpoint: presets still export/import both palettes, invalid input is rejected,
cancel/write failure is handled, native/system-border modes both work, and CSD
code no longer includes file-dialog/save-file dependencies for this feature.

### 3. Simplify shared control representation

Replace repeated casts with a concrete typed button
collection if the result is clearer and smaller. Reuse action/role and style
metrics only where this removes real duplication. Preserve existing action
strings and all platform guards. Avoid generic registries, factories, enums with
extra conversion layers, or an index/map merely to optimize three items.

Combine repeated passes only when ordering, visibility, native registration,
accessibility, tooltip updates and focus behavior stay identical. Keep macOS
native controls separate from Linux's simulated traffic-light drawing.

Checkpoint: same dimensions/insets, Linux user ordering, preview styles, separate
titlebar, header/logo settings, caption colors and accessible actions; Windows
native roles survive style/state transitions.

### 4. Trim proven-unused state

Confirm unused outgoing state fields with a repository-wide caller search and
remove their tests/types only if those tests merely assert obsolete shape.
Keep the incoming viewport check, revision, sequence, bounded rectangle parsing,
exclusion limits and single-flight acknowledgement protocol.

Do not change `syncFrame` scheduling, geometry coalescing, cache invalidation or
the observer/transition machinery in this iteration. No measured performance
problem justifies that risk for this behavior-preserving cleanup. Keep the
reentrancy guard and QObject lifetime protections; do not split scrollbar
observers into a parallel system merely for architectural tidiness.

Checkpoint: no extra layout reads for scroll-only or pure painting activity;
unchanged frames remain suppressed; overlapping/cancelled transitions, reloads,
renderer stalls and stale snapshots keep their existing behavior.

### 5. Verify, measure and document the result

Run focused checks after each slice; run the full frontend suite/lint and native
Linux/Windows checks once at the end, repeating only for subsequent changes or
failures. Package with the existing standard helper when executing this plan:

```sh
cd /var/home/pako/Documents/Codex
./bitbox-dev.sh exec make webtest
./bitbox-dev.sh exec make weblint
./build-bitbox.sh linux --plain
./build-bitbox.sh windows --plain --keep-windows
```

Production packaging is separate from native QtTest invocation; helpers do not
run tests. Use the existing native build environment and configured Windows
shell for the fixture, and document its exact verified invocation.
`--keep-windows` retains this run's source, dependency installation and complete
runtime for native tests and human acceptance; the helper otherwise removes
them. Record the retained VM paths printed by the helper. Its standard verified
installer download remains part of that helper; do not transfer other artifacts.
Do not add another build launcher.

Native fixtures may open their own isolated test windows. Production-app manual
acceptance is user-run unless an app launch is explicitly requested; report it as
pending rather than silently launching a wallet or treating automated hit tests
as equivalent evidence. Do not touch real devices/funds or installed app data.

Measure aggregate code change, number of bridge methods/state variables and any
performance path actually changed. Update `docs/BUILD.md` with the verified test
commands and correct current defaults: system borders are currently the PoC
default, while the modernized in-app design remains available with either mode.
Keep changes in small commits on the local comparison branch; do not push/open
PRs as part of this work.

## Acceptance matrix

| Platform/area | Required evidence |
| --- | --- |
| Linux Wayland and X11 | Existing native regressions; startup/reload transparency, all corners through resize, 4px inner/6px outer targets, native drag during renderer stall, maximization/tiling, focus shadow, live theme portal and custom button order |
| Windows VM | Real native hit tests plus drag/restore, all resize targets, Snap hover, caption click states, focus/accessibility, light/dark appearance and the existing shadows-disabled setting |
| All playground features | Stored presets and both palettes survive; style emulation, logo/header/sidebar controls, separate titlebar, scrollbars, separators, guide dismissal/drag regions and animation synchronization remain unchanged |
| Native decorations | Restart reminder and saved preference remain correct; selecting system borders does not disable the in-app design |
| DPI/monitors | Exercise available scales/moves; list unavailable real mixed-DPI scenarios explicitly rather than claiming coverage from mocked arithmetic |
| macOS | Source review of all affected shared paths; native build/runtime, native traffic-light hover/Option/fullscreen behavior and monitor changes remain **pending** until a Mac is available |
| Mobile/browser | Existing tests show no desktop bridge initialization or unintended layout changes |

A green Windows fixture is not proof of the visible Snap popup or screen-reader
behavior. A Linux preview is not proof of AppKit behavior. Those require native
manual acceptance; the plan must report their actual status.

## Guardrails and stopping rules

- No feature removal, cosmetic changes, dependency upgrades, new global settings,
  new background loops or per-frame allocations for an unmeasured optimization.
- No changes to Linux corner/shadow recovery or the vendored resize patches in
  this pass. Any discovered defect there is recorded as separate work.
- No removal of validation/fallbacks merely to reduce code. Every deletion needs
  a reason: unused, duplicated, or replaced by a verified existing Qt/QWindowKit
  responsibility.
- No broad test rewrites or new test framework. Split tasks that grow beyond a
  small focused diff, but keep coupled cross-language interface edits atomic.
  Each commit must leave the app operational.
- Replace obsolete shape/wrapper tests with behavioral tests at the retained
  interface; do not stack redundant test layers or remove an invariant merely
  because a caller moved. New tests retain the repository's scenario comments.
- If simplification increases total complexity or does not preserve behavior,
  drop that candidate and retain the original implementation.
- Every candidate ends either implemented with evidence or deliberately retained
  with a recorded reason. A skipped candidate is a completed decision; an
  unavailable test is pending, never passed. Platform-dependent work waits when
  its required platform evidence is unavailable; independent work may proceed.
- Do not claim macOS completion, production readiness, or measurable runtime
  gains without the corresponding evidence.

## References and external review

- Local pinned headers/source and `external/qwindowkit/BITBOX-DEPENDENCY.md` are
  authoritative for installed APIs and downstream integration patches.
- [QWindowKit upstream overview](https://github.com/stdware/qwindowkit): native
  behavior and system-button roles; this is not an instruction to upgrade.
- [Qt 6.8 system move/resize](https://doc.qt.io/qt-6.8/qwindow.html#startSystemMove).
- [Qt 6.8 WebChannel JavaScript API](https://doc.qt.io/qt-6.8/qtwebchannel-javascript.html).
- [Gemini 3.8 Thinking review](https://gemini.google.com/app/b7b7c53ecdc0ad3a)
  was obtained through the web session. Adopted: prioritize export separation,
  reuse the qmake test project, simplify control presentation cautiously, and
  remove speculative geometry-update optimization from this pass. The review
  assessed the supplied architectural summary, not the complete source tree.
  Its details were checked against the repository: casts are static rather than
  dynamic; the channel has no application heartbeat; and Qt module/platform
  scopes must match this project's actual qmake setup. Its suggestion that export
  relocation needs only IPC checks is too weak: preserve modal-dialog parenting,
  lifetime, thread affinity and behavior with pending channel updates too.

Gemini review screenshot:
`/var/home/pako/Documents/Codex/csd-simplification/gemini-review.jpg`.

No unresolved product choices remain. Windows baseline reachability/behavior and
future macOS access are verification constraints, not reasons to invent new
implementation layers.

## Pre-implementation skills review

Reviewed the proposal against the agreed scope, source callers, existing QtTest
and frontend tests, native bridge lifetime and the standard build helper.

- **Codebase Design:** retain one native-window module with a small interface;
  move file saving to the existing desktop interface without adding an adapter
  hierarchy or a test-only public interface.
- **Ponytail Review:** replace the unnecessary three-stage export migration with
  one atomic operation, retain the Windows workspace for verification, reuse
  existing behavioral tests and state clearly which manual checks remain pending.
- The fixed-commit code-review workflow does not apply to these uncommitted plan
  files; this review does not claim that implementation code has passed review.

The planning review did not change application code, tests or build scripts and
did not run builds or runtime tests. Subsequent implementation and verification
are recorded separately in results.md.

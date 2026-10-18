# CSD simplification checklist

Plan: [plan.md](plan.md). Baseline: `c263a90b4`.
Implementation is complete; packaging is in progress. Evidence: [results.md](results.md).
For optional simplification candidates, record either implemented + evidence or
retained + reason. Unavailable runtime checks remain pending, never passed.

## 1. Establish the baseline and Windows fixture

**Scope:** small/medium; `tests/desktopwindow.pro`, one Windows test source,
and verified test instructions in `docs/BUILD.md`. Depends on: none.

- [x] Create `codex/csd-core-simplification`; retain the original branch/source.
- [x] Record source counts and a current behavior/defaults checklist.
- [x] Establish passing Linux tests and the Windows baseline, recording existing
      failures separately. Keep Linux D-Bus/Wayland dependencies platform-scoped.
- [x] Add minimal Windows-native resize/caption hit-test coverage to the existing
      qmake project; isolate QSettings, preserve VM system settings and use the
      same required pre-QApplication attributes as the existing Qt fixture.

**Verify:** existing Linux fixture on X11/Wayland, Windows fixture on the actual
VM; both use the project's Qt/QWindowKit environments. Native `HTZOOM`, edge/
corner hits and fixed/maximized/fullscreen behavior are checked appropriately.

## 2. Move preset saving in one atomic change

**Scope:** one focused cross-language operation: native bridge/initialization,
web transport/preset caller and directly affected tests. Depends on: the source
and Linux baseline in 1; Windows bridge behavior also needs Windows verification.

- [x] Move saving to the existing general desktop bridge and update the web
      caller together; no temporary endpoint, forwarding wrapper or migration.
- [x] Keep one save body; reuse existing file-dialog code only if it reduces
      duplication without changing Go's existing callbacks/thread handling.
- [x] Preserve GUI-thread execution, the original live window parent/lifetime,
      64 KiB limit, bounded caption, save/cancel/error results and atomic writes.
- [x] Remove the old CSD slot/type/function and unused includes; update all
      callers/imports/mocks in the same commit.
- [x] Retarget existing oversize/preset tests and add only the missing transport
      result check. Preserve saved presets and import validation/persistence.
- [x] Check modal cancel/close with a pending frame update and bridge shutdown;
      do not add a heartbeat, watchdog or test-only public interface.

**Verify:** existing native/preset/transport tests; export succeeds/cancels/fails
with either decoration mode; parent, thread and Go call/notification behavior
remain correct. Test observable outcomes rather than private helper structure.

**Checkpoint:** both Linux and Windows native code build; frontend checks pass;
the CSD bridge has no preset file-saving responsibility.

## 3. Simplify shared caption controls

**Scope:** medium; `desktopwindow.cpp`, `.h`, focused Linux/Windows tests.
Depends on: Windows coverage in 1; perform after 2 to keep diffs independent.

- [x] Use a concrete typed button representation if it eliminates repeated casts
      without adding a factory/registry/conversion framework.
- [x] Consolidate duplicated style/action geometry only where the complete code
      becomes easier to follow; do not optimize the three-item loops for speed.
- [x] Keep native title/system-button registration ordering, all previews,
      occupied-side insets, dimensions, accessibility and focus behavior.

**Verify:** native controls/geometry tests, Windows actual caption hit tests,
header/sidebar/preview frontend tests. Do not substitute Linux simulation for
macOS native verification.

## 4. Remove only proven-unused state

**Scope:** small/medium per candidate; native window or TS utility plus focused
tests. Depends on: 3. Commit independent candidates separately.

- [x] Search all callers before removing unused outgoing `width`/`height` fields.
- [x] Preserve incoming viewport data, revision/sequence, safe drag fallback,
      bounded exclusions and one-in-flight replies.
- [x] Keep observer, animation, repaint/reentrancy and object-lifetime safeguards.
- [x] Leave geometry scheduling, update coalescing, cache invalidation and the
      observer machinery unchanged; speculative performance work is out of scope.
- [x] Retain Linux rendering and platform hit-test patches unchanged.

**Verify:** stale/invalid layouts, unchanged snapshots, disposal, scroll-only
updates, overlapping/cancelled animations and stalled renderer tests.

**Checkpoint:** all existing behavior remains; no new scheduler or input path
has appeared; source moves are not counted as deleted code.

## 5. Validate, package and report

**Scope:** verification plus `docs/BUILD.md` and these task records. Depends on:
all selected simplification tasks; no builds are performed merely to write this
plan.

- [x] Run focused regressions, then full frontend tests and lint/type/i18n checks.
- [x] Run the Linux native suite on X11 and Wayland and Windows native checks.
- [ ] Build with `build-bitbox.sh linux --plain` and
      `build-bitbox.sh windows --plain --keep-windows`; freeze source during
      builds and use only the existing standard environments.
- [ ] Record the helper's retained VM source/runtime paths for Windows
      verification rather than letting cleanup remove them.
- [x] Record native manual acceptance status for Snap hover, drag/restore,
      resizing, theme, available DPI, accessibility and shadows-disabled Windows.
      Fixtures may open isolated test windows; production-app checks are user-run
      unless a launch is requested, and remain pending until actually performed.
- [x] Verify unchanged playground behavior and system-borders persistence.
- [x] Correct stale defaults/test instructions in `docs/BUILD.md` as needed.
- [ ] Report before/after core and aggregate code counts, moved responsibilities,
      actual tests/builds, and retained workarounds with their reasons.
- [x] Keep all work local; do not launch the app, push PRs or transfer additional
      artifacts without a request covering that action. The standard helper's
      verified installer download is expected; no separate transfer is added.

## Deferred macOS acceptance

- [ ] Native macOS build and traffic-light/Option/fullscreen/resize/DPI tests on
      actual macOS. This requires access to a Mac and is not achievable now.

Source review can complete independently. macOS runtime coverage and full
production-readiness must remain explicitly pending.

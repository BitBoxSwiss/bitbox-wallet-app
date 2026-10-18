# CSD simplification results

Branch: `codex/csd-core-simplification`. Baseline: `c263a90b4`.
Implementation: `475cd86d0`, `3180dedb9`, `fa6dba857`.
Both requested builds and packaging succeeded using the standard helper (exit 0).

## Changes and retained decisions

- Preset export now uses the existing general desktop bridge. The file chooser,
  guarded live parent, GUI-thread execution, 64 KiB UTF-8 limit, caption bound,
  result strings and atomic QSaveFile write are preserved. No extra helper or
  compatibility wrapper was needed. The Go dialog/call/notification paths and
  shutdown ownership remain unchanged.
- Caption controls use a private concrete button type, removing seven repeated
  downcasts. Registration order, metrics, actions, labels, focus and painting
  are unchanged. The three-item loops remain: consolidating their style/geometry
  branches would add machinery without reducing the complete implementation.
- Unused outgoing viewport width/height fields were removed after a caller
  search. Incoming size validation, revision/sequence, exclusions and the
  one-in-flight frame protocol remain.
- Linux corner masks, shadow cache, transparency recovery, edge widgets and
  preferences are unchanged. Vendored QWindowKit source/patches are unchanged.
  Geometry scheduling and all playground settings/presets remain unchanged.
- The Qt test project scopes Linux dependencies and selects a small Windows
  fixture on Windows. No dependency or test framework was added.

## Source size

Physical lines include blanks and comments. Counts compare the same baseline
files with the implementation; file moves are not counted as deleted code.

| Production scope | Lines before | Lines after | Bytes before | Bytes after |
| --- | ---: | ---: | ---: | ---: |
| Native CSD files from the plan | 1,053 | 1,040 | 46,560 | 45,597 |
| Four web CSD files from the plan | 494 | 485 | 20,075 | 19,690 |
| All eight touched production files, including moved export code | 1,865 | 1,869 | 76,916 | 76,658 |

The CSD boundary is 22 lines smaller. The aggregate is four lines longer and
258 bytes smaller because general file saving now has its own guarded parent
and transport entry point. This is a small responsibility cleanup, not a broad
code-size or runtime-performance improvement. CSD invokables decrease from
seven to six; general bridge slots increase from one to two (eight total remain).
Outgoing state loses two fields; geometry scheduling/state is otherwise intact.
New regression tests/configuration and documentation are accounted separately
from these production counts. No vendored lines changed.

## Verification

| Check | Result |
| --- | --- |
| Full frontend suite (`make webtest`) | 104 files, 709 tests passed |
| Frontend TypeScript, ESLint, translation sorting (`make weblint`) | Passed |
| Baseline Linux fixture | 22 passed on X11; 22 passed on Wayland |
| Refactored Linux fixture | 28 passed on X11; 28 passed on Wayland |
| Focused modal fixture after test timeout protection | 9 passed |
| Baseline Windows native fixture | 6 passed |
| Refactored Windows native fixture | 6 passed |
| macOS affected shared paths | Source review only; native build/runtime pending |

Linux used the existing Qt container, isolated Xvfb/Openbox and headless Weston,
private D-Bus sessions and temporary INI settings. Its fixture covers rendering,
resizing/cursors, live preferences, native drag during renderer stall and stale
layouts. Preset tests cover both decoration modes, byte limits, an expired
parent, save/cancel/write failure and frame updates during the modal loop.
The frontend tests cover asynchronous bridge results without a CSD object,
existing presets/palettes, playground controls and browser/mobile fallback.

Windows used MSVC/Qt 6.8.2 and the matching pinned QWindowKit installation.
Native checks ran in the active desktop session through a temporary task with no
trigger; the task was removed afterward. SSH's noninteractive desktop cannot
expose Qt windows. The fixture uses Qt's native coordinate conversion and tests
actual WM_NCHITTEST results for captions, all edges/corners, fixed dimensions,
maximized and fullscreen windows. State scenarios are isolated; a rapid sequence
of constrained sizing/maximizing/fullscreen still needs manual acceptance.

Raw logs: `/var/home/pako/Documents/Codex/csd-simplification/verification-20261018-221422-QBANCK`.
Windows isolated fixture workspace: `C:/dev/csd-native-tests-20261018-215823`.
Neither fixture opens a wallet backend or changes the user's app settings.
Production-app manual acceptance is pending: visible Snap Layouts, screen reader
behavior, physical mixed-DPI moves, shadows-disabled appearance, and real desktop
animation/dragging. macOS traffic lights/Option/fullscreen/monitor moves require
a Mac. Passing Linux emulation is not macOS evidence.

## Builds

Use the existing helper, with source frozen during packaging:

```sh
cd /var/home/pako/Documents/Codex
./build-bitbox.sh all --plain --keep-windows
```

These are unsigned development builds for user testing. No production wallet
launch, PR push or extra binary transfer is part of this work. The standard
helper's verified installer download is expected.


## Completed builds

Compiled source: `2078883613f85d071ec938a52dfd59535dee3f84`, with a clean
working tree. Subsequent changes only complete these documentation records.
The standard all-platform helper succeeded in 56m29s. Its artifact checks passed,
including the downloaded Windows installer's SHA-256. Production source remained
unchanged during both builds.

- Linux AppImage: `/var/home/pako/Documents/Codex/builds/20261018-221513-2078883613f8-rHzYof/linux/BitBoxApp.AppImage`
- All Linux assets (including DEB/RPM): `/var/home/pako/Documents/Codex/builds/20261018-221513-2078883613f8-rHzYof/linux/artifacts`
- Windows installer on Linux: `/var/home/pako/Documents/Codex/builds/20261018-221513-2078883613f8-rHzYof/windows/BitBox-installer.exe`
- Windows runtime executable on VM: `C:/dev/bitbox-builds/20261018-221513-2078883613f8-rHzYof/source/frontends/qt/build/windows/BitBox.exe`
- Windows installer on VM: `C:/dev/bitbox-builds/20261018-221513-2078883613f8-rHzYof/source/frontends/qt/BitBox-installer.exe`
- Build metadata/logs/checksums: `/var/home/pako/Documents/Codex/builds/20261018-221513-2078883613f8-rHzYof`

The complete Windows runtime directory was retained with `--keep-windows`.
Both artifacts are local development builds, not official signed releases.
The helper's "tests not run" message describes packaging only; the independent
regression runs are recorded above. The wallet application was not launched.

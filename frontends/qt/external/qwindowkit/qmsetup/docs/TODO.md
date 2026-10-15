# Status

Both halves have a suite that runs from CTest on Windows, Linux and macOS: `tests/cli` runs `qmcorecmd` as a black box, and `tests/cmake` runs the `qm_*` functions. What follows is what they do not reach.

The ones wanting Qt or protobuf run against a real installation rather than a stub, and each registers itself only where the configure found what it needs, so a machine without one of them runs a shorter suite rather than one full of tests that pass themselves over. Name the installations the ordinary way and they all run, `CMAKE_PREFIX_PATH` taking more than one entry. The QML ones ask for Qt 6.5 on top of that.

```sh
cmake -B build -DQMSETUP_BUILD_TESTS=ON \
      "-DCMAKE_PREFIX_PATH=/path/to/Qt/<version>/<compiler>;/path/to/protobuf"
```

## Not tested, and will not be

- Doxygen for `qm_setup_doxygen`, which wants the tool installed to say anything at all.
- Most behavior under `cmake/modules/private`. It says on it that it may be modified or removed, and nothing outside qmsetup should be calling it. `qm_install_package` has a local regression test for forwarding the selected generator program, but its external package workflows are otherwise left alone because useful coverage would want a network.
- `qm_compiler_*`, which is under `private` for the same reason and has one of its own. Each is a list of compiler flags chosen per compiler, so a test could only read the list back to itself, which says nothing about whether the flags are the right ones. What would catch a mistake there is compiling with them.

## Not tested yet

- The pass that strips a universal binary down to the architecture in use, which needs a binary built for two. `lipo` itself is on every machine with the command line tools, so what is missing is the fixture: building one means a second pass over the whole deploy tree with `CMAKE_OSX_ARCHITECTURES`, and it would test one function.
- `FORCE`, on `qm_deploy_directory` and on `qm_win_applocal_deps`. It is what makes a copy happen where the destination already holds a file of the same name and no older, so a test wants two runs with something put in the way between them, and either function copies enough that doing it twice is the slowest thing in the suite.
- The scripts under `cmake/scripts`, called directly rather than through the function that wraps them. `copy.cmake` is reached through `qm_add_copy_command`, `configure_file.cmake` through `qm_future_configure_file`, and `xxd.cmake` through `qm_add_binary_resource`, all against a real build. What a direct call would add is the refusal each makes when an argument is missing.

## Unverified

- The standard library filter cannot be seen to work on macOS. Everything under `/usr/lib` now lives in the dyld shared cache rather than on disk, so `libSystem` is reported as not found whether or not `--standard` was asked for, and the deployment has nothing to leave behind. Checked on Windows and Linux, where the filter has files to act on.
- Nothing compiles what `qm_add_win_rc` and `qm_add_win_rc_enhanced` write. The tests read the generated `.rc` and check what is in it, and the icons they name are files with the right extension and nothing else in them, so that a resource compiler would accept the result is not checked. The same holds for `qm_add_win_manifest`, which nothing embeds.
- Nothing builds what `qm_add_mac_bundle` sets up. The properties it puts on the target are read back, but the `Info.plist` CMake writes out of them is not, so a property spelt wrongly would pass.

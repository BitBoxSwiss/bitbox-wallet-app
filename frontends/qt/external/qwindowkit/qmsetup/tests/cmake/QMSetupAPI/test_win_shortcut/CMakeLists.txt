# qm_create_win_shortcut, which puts a .lnk beside a build.
#
# It works in two steps, and only the first is qmsetup's. A .vbs is written out
# of the target, with a generator expression for every path in it, and then a
# POST_BUILD command hands that to cscript, which is what actually makes the
# shortcut. So nothing short of a real build reaches either half: the .vbs is
# written by file(GENERATE), which happens after this file has been read, and
# the .lnk after that again. Built by testing/build.cmake and asserted in
# check.cmake. Nothing is installed.
#
# Registered only on Windows, and only where cscript was seen to make a
# shortcut, which tests/cmake/CMakeLists.txt asks before adding this at all.
# Without that a machine with Windows Script Host switched off would fail the
# build rather than pass the test over.

cmake_minimum_required(VERSION 3.19)
project(qmtest_win_shortcut C)

include(${QMSETUP_API})

# The directory has to be there before cscript runs. WScript.Shell saves into it
# rather than making it, so naming one that does not exist yet is a build that
# stops inside a script rather than an error anybody can read.
set(_shortcuts "${CMAKE_BINARY_DIR}/shortcuts")
file(MAKE_DIRECTORY "${_shortcuts}")

# Nothing said, so the shortcut is named after the target.
add_executable(qmtest_shortcut_app src/app.c)
qm_create_win_shortcut(qmtest_shortcut_app "${_shortcuts}")

# OUTPUT_NAME names it instead. A space in it, since that is what a shortcut
# meant for a person to read looks like, and it has to survive both the file
# CMake generates and the command line cscript is given.
add_executable(qmtest_shortcut_named src/app.c)
qm_create_win_shortcut(qmtest_shortcut_named "${_shortcuts}"
    OUTPUT_NAME "A Chosen Name"
)

# A name of its own, so that what the shortcut points at is not the target's
# name either. Without this a check on the target path would pass just as
# readily on a shortcut built from the wrong one of the two.
add_executable(qmtest_shortcut_renamed src/app.c)
set_target_properties(qmtest_shortcut_renamed PROPERTIES OUTPUT_NAME "renamed_binary")
qm_create_win_shortcut(qmtest_shortcut_renamed "${_shortcuts}")

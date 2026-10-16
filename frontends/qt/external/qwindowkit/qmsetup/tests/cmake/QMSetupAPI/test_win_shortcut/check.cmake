# What qm_create_win_shortcut left behind, once the project was built.
#
# Included by testing/build.cmake, which builds Release. `_build` is the build
# directory. Nothing is installed, so `_prefix` is not read.

set(_shortcuts "${_build}/shortcuts")

# The name carries the configuration, since a shortcut to a debug build and one
# to a release build are different files and a project may want both.
set(_vbs "${_build}/qmtest_shortcut_app_shortcut_Release.vbs")

# ------------------------------------------------------------------
# The script CMake wrote
# ------------------------------------------------------------------

qmtest_exists("a script is generated for the configuration that was built" "${_vbs}")

# Every path in it comes from a generator expression, which configure_file
# leaves as it stands and file(GENERATE) is what resolves. A file still holding
# a $<...> would mean the second step never ran.
qmtest_file_lacks("with no generator expression left in it" "${_vbs}" "\\$<")

qmtest_file_contains("it names the shortcut to make" "${_vbs}"
    "qmtest_shortcut_app\\.lnk")
qmtest_file_contains("and what the shortcut points at" "${_vbs}"
    "qmtest_shortcut_app\\.exe")

# Separator agnostic. A generator expression answers a native path on some
# generators and a forward slashed one on others, and neither is wrong.
qmtest_file_contains("a working directory, being where the binary was built"
    "${_vbs}" "oLink.WorkingDirectory = \"[^\"]+\"")
qmtest_file_contains("and an icon, which for a program is the program"
    "${_vbs}" "oLink.IconLocation = \"[^\"]+qmtest_shortcut_app\\.exe\"")

# ------------------------------------------------------------------
# The shortcut itself
# ------------------------------------------------------------------

set(_lnk "${_shortcuts}/qmtest_shortcut_app.lnk")
qmtest_exists("the shortcut is made, in the directory it was told" "${_lnk}")

# A shell link starts with its own header length, 4C 00 00 00, so this says the
# file is a shortcut rather than whatever else cscript may have left.
if(EXISTS "${_lnk}")
    file(READ "${_lnk}" _magic HEX LIMIT 4)
    qmtest_equal("and it is a shell link rather than an empty file" "${_magic}" "4c000000")
endif()

# ------------------------------------------------------------------
# What it is called
# ------------------------------------------------------------------

qmtest_exists("OUTPUT_NAME names the shortcut, spaces and all"
    "${_shortcuts}/A Chosen Name.lnk")
qmtest_not_exists("rather than the target"
    "${_shortcuts}/qmtest_shortcut_named.lnk")

# Without OUTPUT_NAME the name is the file the target builds, not the target.
qmtest_exists("with nothing said it is named after the binary"
    "${_shortcuts}/renamed_binary.lnk")
qmtest_not_exists("which is not the same as the target's own name"
    "${_shortcuts}/qmtest_shortcut_renamed.lnk")

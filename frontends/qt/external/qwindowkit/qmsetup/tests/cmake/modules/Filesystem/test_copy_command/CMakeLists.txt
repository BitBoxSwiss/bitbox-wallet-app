# qm_add_copy_command, which copies resources next to what was built and, if
# asked, into the install tree as well.
#
# It works by adding a POST_BUILD command and an install rule, so nothing short
# of a real build and install reaches either. Built and installed by
# testing/build.cmake and asserted in check.cmake.
#
# There is a lot to cover here. What a source may look like is most of it: a
# file, several files, a directory, a directory asked for by its contents, a
# pattern, a recursive pattern, a relative path, a path with a space in it. And
# then where the destination is measured from, which is not the same for a real
# target as for a custom one.
#
# assets/
#   one.txt
#   two.txt
#   with space.txt
#   nested/     three.txt
#               skipme.skip
#               deeper/four.txt

cmake_minimum_required(VERSION 3.19)
project(qmtest_copy_command C)

include(GNUInstallDirs)

include(${QMSETUP_API})

qm_import(Filesystem)

# What INSTALL_DIR measures its relative path from, and without which asking for
# one at all is an error.
set(QMSETUP_BUILD_DIR "${CMAKE_BINARY_DIR}/out")

set(_assets "${CMAKE_CURRENT_SOURCE_DIR}/assets")

# Everything below hangs off this one, so that one build runs the lot.
add_executable(copyapp src/app.c)
set_target_properties(copyapp PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${QMSETUP_BUILD_DIR}/bin"
)

# ------------------------------------------------------------------
# What a source may be
# ------------------------------------------------------------------

qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt"
    DESTINATION one_file
)

qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt" "${_assets}/two.txt"
    DESTINATION two_files
)

# A directory named as itself is copied as itself, so what lands is the
# directory rather than its contents.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested"
    DESTINATION whole_directory
)

# And one named by its contents, with a separator on the end, is the other way
# round. This is the one difference a trailing separator makes anywhere here.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested/"
    DESTINATION directory_contents
)

# A pattern is expanded rather than taken as a name, one level deep.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/*.txt"
    DESTINATION by_pattern
)

# Two stars go all the way down.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested/**"
    DESTINATION by_deep_pattern
)

# A relative source is measured from where the command runs, which is the
# directory this file is in.
qm_add_copy_command(copyapp
    SOURCES "assets/two.txt"
    DESTINATION relative_source
)

qm_add_copy_command(copyapp
    SOURCES "${_assets}/with space.txt"
    DESTINATION with_space
)

# ------------------------------------------------------------------
# Where the destination is measured from
# ------------------------------------------------------------------

# Nothing said, so beside the target itself.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt"
)

# An absolute destination is taken as written.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt"
    DESTINATION "${CMAKE_BINARY_DIR}/somewhere/else"
)

# A name that is no target yet becomes one, and a custom target has no file of
# its own to be beside, so its destinations are measured from QMSETUP_BUILD_DIR.
qm_add_copy_command(qmtest_copy_utility
    SOURCES "${_assets}/two.txt"
    DESTINATION from_the_build_dir
)

# CUSTOM_TARGET hangs the command off something else, which is how one target
# gathers what several others need.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt"
    DESTINATION "${CMAKE_BINARY_DIR}/gathered"
    CUSTOM_TARGET qmtest_copy_gatherer
)

# ------------------------------------------------------------------
# What it is told not to do
# ------------------------------------------------------------------

# Copied when installing, and not when building.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/one.txt"
    DESTINATION install_only
    INSTALL_DIR "${CMAKE_INSTALL_DATADIR}"
    SKIP_BUILD
)

# And the other way about.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/two.txt"
    DESTINATION build_only
    INSTALL_DIR "${CMAKE_INSTALL_DATADIR}"
    SKIP_INSTALL
)

# Both, which is what INSTALL_DIR is usually for. The place it lands under the
# prefix is the same relative path as under the build directory.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested/three.txt"
    DESTINATION "${QMSETUP_BUILD_DIR}/both/ways"
    INSTALL_DIR "${CMAKE_INSTALL_DATADIR}"
)

# ------------------------------------------------------------------
# EXTRA_ARGS, which reaches the file(INSTALL) underneath
# ------------------------------------------------------------------

qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested/"
    DESTINATION filtered
    EXTRA_ARGS PATTERN "*.skip" EXCLUDE
)

# The install phase builds the same command separately, so it gets the same
# arguments asked of it separately too.
qm_add_copy_command(copyapp
    SOURCES "${_assets}/nested/"
    DESTINATION "${QMSETUP_BUILD_DIR}/filtered_install"
    INSTALL_DIR "${CMAKE_INSTALL_DATADIR}"
    EXTRA_ARGS PATTERN "*.skip" EXCLUDE
)

# Building the application has to build the custom targets too, since nothing
# else depends on them.
add_dependencies(copyapp qmtest_copy_utility qmtest_copy_gatherer)

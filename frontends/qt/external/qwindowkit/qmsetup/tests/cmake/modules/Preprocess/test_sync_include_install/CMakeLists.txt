# qm_sync_include with INSTALL_DIR, which is the half of it that only an
# install reaches.
#
# Everything else the wrapper does is checked in ../test_sync_include.cmake, a
# script, against the source tree it makes. What cannot be reached that way is
# the install rule: it runs the tool a second time to be told what would be
# synced, reads that back, and installs each header where it says. Built and
# installed by testing/build.cmake and asserted in check.cmake.

cmake_minimum_required(VERSION 3.19)
project(qmtest_sync_include_install NONE)

include(GNUInstallDirs)

include(${QMSETUP_API})

if(DEFINED QMCORECMD)
    set(QMSETUP_CORECMD_EXECUTABLE "${QMCORECMD}")
endif()

qm_import(Preprocess)

# A tree with something at the top, something below it, and something private,
# so that what lands under the prefix says whether the whole walk arrived and
# not merely the first file of it.
set(_src "${CMAKE_BINARY_DIR}/src")
file(WRITE "${_src}/foo.h" "// foo")
file(WRITE "${_src}/sub/bar.h" "// bar")
file(WRITE "${_src}/sub/baz_p.h" "// private baz")
file(WRITE "${_src}/notaheader.txt" "// not a header")

qm_sync_include("${_src}" "${CMAKE_BINARY_DIR}/include/QmTest"
    INSTALL_DIR "${CMAKE_INSTALL_INCLUDEDIR}/QmTest"
    FORCE
)

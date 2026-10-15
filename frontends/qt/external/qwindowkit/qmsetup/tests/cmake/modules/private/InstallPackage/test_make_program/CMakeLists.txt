# qm_install_package keeps the generator program selected by its parent when
# it configures another project from a different working directory.

cmake_minimum_required(VERSION 3.19)
project(qmtest_install_package C)

include("${QMSETUP_API}")
include("${QMSETUP_MODULES_DIR}/modules/private/InstallPackage.cmake")

# Make the nested configure depend on the forwarded absolute path. This models
# a generator installed through a relative PATH entry before the working
# directory changes, as reported in https://github.com/stdware/qmsetup/issues/8.
set(_old_path "$ENV{PATH}")
set(ENV{PATH} "missing-tool-directory")

qm_install_package(make_program_probe
    SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/fixture"
    BUILD_TREE_DIR "${CMAKE_CURRENT_BINARY_DIR}/package-build"
    INSTALL_DIR "${CMAKE_CURRENT_BINARY_DIR}/package-prefix"
)

set(ENV{PATH} "${_old_path}")

if(NOT EXISTS "${CMAKE_CURRENT_BINARY_DIR}/package-prefix/lib/cmake/make_program_probe/installed.txt")
    message(FATAL_ERROR "the nested project was not installed")
endif()

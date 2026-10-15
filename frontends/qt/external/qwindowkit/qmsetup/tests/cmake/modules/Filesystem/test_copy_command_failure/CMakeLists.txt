cmake_minimum_required(VERSION 3.19)
project(qmtest_copy_command_failure NONE)

include(${QMSETUP_API})

qm_import(Filesystem)

set(QMSETUP_BUILD_DIR "${CMAKE_BINARY_DIR}/out")

qm_add_copy_command(qmtest_invalid_copy
    SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/present.txt"
    DESTINATION install_only
    INSTALL_DIR share
    EXTRA_ARGS NOT_AN_INSTALL_ARGUMENT
    SKIP_BUILD
)

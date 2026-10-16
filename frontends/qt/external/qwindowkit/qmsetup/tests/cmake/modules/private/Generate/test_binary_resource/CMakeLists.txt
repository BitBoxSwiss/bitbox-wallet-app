# qm_add_binary_resource, built into an executable that checks the generated
# array rather than merely checking that the generated source exists.

cmake_minimum_required(VERSION 3.19)
project(qmtest_binary_resource C)

include(GNUInstallDirs)
include(${QMSETUP_API})
include("${QMSETUP_MODULES_DIR}/modules/private/Generate.cmake")

set(_resource "${CMAKE_CURRENT_BINARY_DIR}/resource.bin")
set(_generated "${CMAKE_CURRENT_BINARY_DIR}/embedded-data.c")
file(WRITE "${_resource}" "QMSetup binary resource")
qm_add_binary_resource("${_resource}" "${_generated}")

add_executable(binary_resource src/main.c "${_generated}")
install(TARGETS binary_resource RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}")

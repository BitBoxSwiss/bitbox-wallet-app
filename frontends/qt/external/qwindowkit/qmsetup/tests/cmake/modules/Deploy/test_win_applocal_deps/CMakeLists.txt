# qm_win_applocal_deps, which copies what an executable needs next to it once
# the executable has been built.
#
# Registered only on Windows, where alone it does anything, so there are no
# platform checks in here. It works by adding a POST_BUILD command that runs
# qmcorecmd, so nothing short of a real build exercises any of it. Built by
# testing/build.cmake and asserted in check.cmake. Nothing is installed.
#
# The library is built into a directory of its own, away from the executables,
# so that finding it is something the deployment has to do rather than something
# that was true already.

cmake_minimum_required(VERSION 3.19)
project(qmtest_win_applocal_deps C)

include(${QMSETUP_API})

if(DEFINED QMCORECMD)
    set(QMSETUP_CORECMD_EXECUTABLE "${QMCORECMD}")
endif()

qm_import(Deploy)

set(_lib_dir "${CMAKE_BINARY_DIR}/elsewhere")

add_library(qmtest_extra_lib SHARED src/lib.c)
target_include_directories(qmtest_extra_lib PUBLIC src)
set_target_properties(qmtest_extra_lib PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${_lib_dir}"
    LIBRARY_OUTPUT_DIRECTORY "${_lib_dir}"
    ARCHIVE_OUTPUT_DIRECTORY "${_lib_dir}"
)

# What it needs turns up beside it.
add_executable(qmtest_beside_app src/app.c)
target_link_libraries(qmtest_beside_app PRIVATE qmtest_extra_lib)
set_target_properties(qmtest_beside_app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/beside"
)
qm_win_applocal_deps(qmtest_beside_app
    EXTRA_SEARCHING_PATHS "${_lib_dir}"
    VERBOSE
)

# Or wherever OUTPUT_DIR says instead.
add_executable(qmtest_elsewhere_app src/app.c)
target_link_libraries(qmtest_elsewhere_app PRIVATE qmtest_extra_lib)
set_target_properties(qmtest_elsewhere_app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/apps"
)
qm_win_applocal_deps(qmtest_elsewhere_app
    OUTPUT_DIR "${CMAKE_BINARY_DIR}/gathered"
    EXTRA_SEARCHING_PATHS "${_lib_dir}"
    VERBOSE
)

# And EXCLUDE keeps something out of it.
add_executable(qmtest_excluded_app src/app.c)
target_link_libraries(qmtest_excluded_app PRIVATE qmtest_extra_lib)
set_target_properties(qmtest_excluded_app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/excluded"
)
qm_win_applocal_deps(qmtest_excluded_app
    EXTRA_SEARCHING_PATHS "${_lib_dir}"
    EXCLUDE "qmtest_extra_lib"
    VERBOSE
)

# What the platform decided to call these, for check.cmake to read rather than
# guess at. Windows is not one naming scheme: MSVC writes qmtest_extra_lib.dll
# and MinGW writes libqmtest_extra_lib.dll, so a name spelt out in the checks
# was right for whichever compiler happened to be at hand.
file(GENERATE OUTPUT "${CMAKE_BINARY_DIR}/built_names.cmake" CONTENT
[[set(_dll "$<TARGET_FILE_NAME:qmtest_extra_lib>")
set(_beside_app "$<TARGET_FILE_NAME:qmtest_beside_app>")
]])

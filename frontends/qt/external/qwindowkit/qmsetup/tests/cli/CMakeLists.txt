# Black-box tests for the qmcorecmd executable.
#
# Each module runs the binary this build produced, in a sandbox directory of
# its own, and asserts on the exit code, on what was printed, and on what ended
# up on disk. Only the Python standard library is used.
#
# Point CMake at an interpreter with -DPython3_EXECUTABLE=... if the one it
# finds is not the one you want.

find_package(Python3 COMPONENTS Interpreter QUIET)

# Asking for tests and being given none is worse than not being given a choice. Without this it
# was a line of status output, and a run that registered half the suite passed as readily as one
# that registered all of it.
if(NOT Python3_Interpreter_FOUND)
    message(FATAL_ERROR "qmcorecmd tests: no Python 3 interpreter found. Point CMake at one with "
        "-DPython3_EXECUTABLE=..., or turn QMSETUP_BUILD_TESTS off.")
endif()

message(STATUS "qmcorecmd tests: using ${Python3_EXECUTABLE} (${Python3_VERSION})")

# A real application, real shared libraries and real plugins, for the deploy
# tests to resolve. Without them those tests skip themselves. C is enabled a
# directory up, so that it is on whichever of the two test directories is read
# first.
add_subdirectory(fixtures)

# What the deploy tests expect, as data. The layout the fixtures are scattered
# into, and the directory structure each command line should leave behind, are
# declared here rather than written out in the Python.
set(_scenario_file ${CMAKE_CURRENT_SOURCE_DIR}/deploy_scenarios.json)

if(NOT EXISTS ${_scenario_file})
    message(FATAL_ERROR "qmcorecmd tests: ${_scenario_file} is missing")
endif()

set(_modules
    test_parse_errors
    test_configure
    test_copy
    test_rmdir
    test_touch
    test_incsync
    test_deploy
    test_deploy_rpath
)

# Registered only where a framework is a thing that exists, rather than running a module whose
# every case skips itself.
if(APPLE)
    list(APPEND _modules test_deploy_framework)
endif()

foreach(_module IN LISTS _modules)
    add_test(NAME qmcorecmd.${_module}
        COMMAND ${Python3_EXECUTABLE} -m unittest -v ${_module}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )
    # Nothing in the Python goes looking for any of this. It is all named here.
    set_tests_properties(qmcorecmd.${_module} PROPERTIES
        ENVIRONMENT
            "QMCORECMD=$<TARGET_FILE:qmcorecmd>;QMTEST_FIXTURES=${QMSETUP_TEST_FIXTURE_DIR};QMTEST_FRAMEWORKS=${QMSETUP_TEST_FRAMEWORK_DIR};QMTEST_SCENARIOS=${_scenario_file};PYTHONDONTWRITEBYTECODE=1"
        LABELS qmcorecmd
        # The default is 1500 seconds, long enough for a hang to pass for slowness. Three
        # seconds here and eighteen at the worst measured on CI, which is test_deploy_rpath on
        # the macOS runner, so anything still running at two minutes is stuck.
        TIMEOUT 120
    )
endforeach()

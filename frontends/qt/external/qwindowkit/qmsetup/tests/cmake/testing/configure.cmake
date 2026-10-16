# Runs a project through configure, as a test.
#
# For the functions that work on targets. A target needs a project to live in,
# so these cannot be checked the way a script can. The assertions are inside the
# project itself, which means a configure that finishes is a test that passed
# and one that stops is a test that failed.
#
# The build directory is emptied first. A cache left by an earlier run would let
# a check pass on what that run decided rather than on what this one did.

foreach(_required QMTEST_PROJECT QMTEST_PROJECT_BUILD QMSETUP_API QMTEST_HARNESS)
    if(NOT DEFINED ${_required})
        message(FATAL_ERROR "${_required} is not set. Run this through CTest, which passes it.")
    endif()
endforeach()

file(REMOVE_RECURSE "${QMTEST_PROJECT_BUILD}")

set(_args
    -S "${QMTEST_PROJECT}"
    -B "${QMTEST_PROJECT_BUILD}"
    "-DQMSETUP_API=${QMSETUP_API}"
    "-DQMTEST_HARNESS=${QMTEST_HARNESS}"
    "-DQMCORECMD=${QMCORECMD}"
)

# The same generator and compiler as the build this is a test of, so that the
# child is not left to work out for itself what the parent already knows.
if(QMTEST_GENERATOR)
    list(APPEND _args -G "${QMTEST_GENERATOR}")
endif()

if(QMTEST_C_COMPILER)
    list(APPEND _args "-DCMAKE_C_COMPILER=${QMTEST_C_COMPILER}")
endif()

if(QMTEST_CXX_COMPILER)
    list(APPEND _args "-DCMAKE_CXX_COMPILER=${QMTEST_CXX_COMPILER}")
endif()

# Where a project is to look for anything it needs found, Qt and protobuf above
# all.
#
# Escaped, since the list below is expanded without quotes when the command is
# run and a search path naming two places would be split again at the semicolon,
# the second turning into an argument of its own.
if(QMTEST_PREFIX_PATH)
    string(REPLACE ";" "\\;" _escaped_prefix_path "${QMTEST_PREFIX_PATH}")
    list(APPEND _args "-DCMAKE_PREFIX_PATH=${_escaped_prefix_path}")
endif()

execute_process(COMMAND ${CMAKE_COMMAND} ${_args} RESULT_VARIABLE _code)

if(NOT _code EQUAL 0)
    message(FATAL_ERROR "the project under test did not configure")
endif()

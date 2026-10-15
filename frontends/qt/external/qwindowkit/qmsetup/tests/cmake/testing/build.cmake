# Configures, builds and installs a project, then runs the checks that come
# with it.
#
# For the functions whose work happens at build or install time rather than at
# configure time. A rule that is never run says nothing, so unlike the configure
# driver this one goes all the way through. The project has a check.cmake beside
# it, which is included at the end and is what does the asserting.
#
# A project with nothing to install has nothing installed, the step passing over
# it quietly, so a test that only needs a build needs nothing special.
#
# These are the slowest tests in the directory by a long way.

include(${QMTEST_HARNESS})

foreach(_required QMTEST_PROJECT QMTEST_PROJECT_BUILD QMTEST_INSTALL_PREFIX)
    if(NOT DEFINED ${_required})
        message(FATAL_ERROR "${_required} is not set. Run this through CTest, which passes it.")
    endif()
endforeach()

file(REMOVE_RECURSE "${QMTEST_PROJECT_BUILD}")
file(REMOVE_RECURSE "${QMTEST_INSTALL_PREFIX}")

# Runs a step, and stops here rather than letting the checks report on a tree
# that was never finished.
function(step _what)
    execute_process(COMMAND ${ARGN} RESULT_VARIABLE _code OUTPUT_VARIABLE _out ERROR_VARIABLE _out)

    if(NOT _code EQUAL 0)
        message(FATAL_ERROR "${_what} failed:\n${_out}")
    endif()
endfunction()

set(_configure_args
    -S "${QMTEST_PROJECT}"
    -B "${QMTEST_PROJECT_BUILD}"
    "-DCMAKE_INSTALL_PREFIX=${QMTEST_INSTALL_PREFIX}"
    "-DQMSETUP_API=${QMSETUP_API}"
    "-DQMTEST_HARNESS=${QMTEST_HARNESS}"
    "-DQMCORECMD=${QMCORECMD}"
    -DCMAKE_BUILD_TYPE=Release
)

if(QMTEST_GENERATOR)
    list(APPEND _configure_args -G "${QMTEST_GENERATOR}")
endif()

if(QMTEST_C_COMPILER)
    list(APPEND _configure_args "-DCMAKE_C_COMPILER=${QMTEST_C_COMPILER}")
endif()

if(QMTEST_CXX_COMPILER)
    list(APPEND _configure_args "-DCMAKE_CXX_COMPILER=${QMTEST_CXX_COMPILER}")
endif()

# Where a project is to look for anything it needs found, Qt and protobuf above
# all.
#
# Escaped, since the list below is expanded without quotes when the command is
# run and a search path naming two places would be split again at the semicolon,
# the second turning into an argument of its own.
if(QMTEST_PREFIX_PATH)
    string(REPLACE ";" "\\;" _escaped_prefix_path "${QMTEST_PREFIX_PATH}")
    list(APPEND _configure_args "-DCMAKE_PREFIX_PATH=${_escaped_prefix_path}")
endif()

# Not through step(), which takes its command as arguments and so expands the
# list a second time. An escaped semicolon survives one round of that and not
# two, and a search path naming two places is exactly one such element. The
# other two steps have no argument of that shape.
execute_process(COMMAND ${CMAKE_COMMAND} ${_configure_args}
    RESULT_VARIABLE _code
    OUTPUT_VARIABLE _out
    ERROR_VARIABLE _out
)

if(NOT _code EQUAL 0)
    message(FATAL_ERROR "configuring failed:\n${_out}")
endif()
step("building" ${CMAKE_COMMAND} --build "${QMTEST_PROJECT_BUILD}" --config Release)
step("installing" ${CMAKE_COMMAND} --install "${QMTEST_PROJECT_BUILD}" --config Release)

# What the project says about the tree it left behind.
set(_prefix "${QMTEST_INSTALL_PREFIX}")
set(_build "${QMTEST_PROJECT_BUILD}")

include("${QMTEST_PROJECT}/check.cmake")

qmtest_report()

# Configures and builds a project whose install is expected to fail.

include(${QMTEST_HARNESS})

foreach(_required QMTEST_PROJECT QMTEST_PROJECT_BUILD QMTEST_INSTALL_PREFIX)
    if(NOT DEFINED ${_required})
        message(FATAL_ERROR "${_required} is not set. Run this through CTest, which passes it.")
    endif()
endforeach()

file(REMOVE_RECURSE "${QMTEST_PROJECT_BUILD}")
file(REMOVE_RECURSE "${QMTEST_INSTALL_PREFIX}")

set(_configure_args
    -S "${QMTEST_PROJECT}"
    -B "${QMTEST_PROJECT_BUILD}"
    "-DCMAKE_INSTALL_PREFIX=${QMTEST_INSTALL_PREFIX}"
    "-DQMSETUP_API=${QMSETUP_API}"
    -DCMAKE_BUILD_TYPE=Release
)

if(QMTEST_GENERATOR)
    list(APPEND _configure_args -G "${QMTEST_GENERATOR}")
endif()

if(QMTEST_C_COMPILER)
    list(APPEND _configure_args "-DCMAKE_C_COMPILER=${QMTEST_C_COMPILER}")
endif()

execute_process(COMMAND ${CMAKE_COMMAND} ${_configure_args}
    RESULT_VARIABLE _code
    OUTPUT_VARIABLE _out
    ERROR_VARIABLE _out
)

if(NOT _code EQUAL 0)
    message(FATAL_ERROR "configuring failed:\n${_out}")
endif()

execute_process(COMMAND ${CMAKE_COMMAND} --build "${QMTEST_PROJECT_BUILD}" --config Release
    RESULT_VARIABLE _code
    OUTPUT_VARIABLE _out
    ERROR_VARIABLE _out
)

if(NOT _code EQUAL 0)
    message(FATAL_ERROR "building failed:\n${_out}")
endif()

execute_process(COMMAND ${CMAKE_COMMAND} --install "${QMTEST_PROJECT_BUILD}" --config Release
    RESULT_VARIABLE _code
    OUTPUT_VARIABLE _out
    ERROR_VARIABLE _out
)

set(_install_succeeded FALSE)
if(_code EQUAL 0)
    set(_install_succeeded TRUE)
endif()
qmtest_false("an install-time copy error makes installation fail" "${_install_succeeded}")

string(FIND "${_out}" "NOT_AN_INSTALL_ARGUMENT" _argument_name)
set(_failure_names_argument FALSE)
if(NOT _argument_name EQUAL -1)
    set(_failure_names_argument TRUE)
endif()
qmtest_true("the failure names the invalid install argument" "${_failure_names_argument}")

qmtest_report()

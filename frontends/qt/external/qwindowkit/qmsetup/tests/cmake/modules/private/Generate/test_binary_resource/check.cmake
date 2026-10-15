set(_suffix)
if(CMAKE_HOST_WIN32)
    set(_suffix .exe)
endif()

set(_executable "${_prefix}/bin/binary_resource${_suffix}")
qmtest_exists("the executable containing the resource is installed" "${_executable}")

if(EXISTS "${_executable}")
    execute_process(COMMAND "${_executable}" RESULT_VARIABLE _code)
    qmtest_equal("the embedded bytes and length match the input" "${_code}" "0")
endif()

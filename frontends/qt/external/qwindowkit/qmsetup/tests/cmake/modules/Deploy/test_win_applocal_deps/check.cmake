# What qm_win_applocal_deps copied once the executables were built.
#
# Included by testing/build.cmake. `_build` is the build directory. Nothing is
# installed here, so `_prefix` has nothing in it.

# The file names the build settled on, written out by the project. Read rather
# than spelt out here, since MSVC writes qmtest_extra_lib.dll where MinGW writes
# libqmtest_extra_lib.dll, and both are Windows.
include("${_build}/built_names.cmake")

# The library was built into elsewhere/, so anything found beside an executable
# was put there by the deployment.
qmtest_exists("what the executable needs is beside it" "${_build}/beside/${_dll}")
qmtest_exists("and the executable is still where it was built" "${_build}/beside/${_beside_app}")

qmtest_exists("OUTPUT_DIR is where it goes instead" "${_build}/gathered/${_dll}")
qmtest_not_exists("rather than beside the executable" "${_build}/apps/${_dll}")

qmtest_not_exists("EXCLUDE keeps it out" "${_build}/excluded/${_dll}")

# A system library is never deployed on Windows whether or not it was asked for,
# so nothing of the C runtime should have come along with any of these.
file(GLOB _beside "${_build}/beside/*.dll")
set(_runtime)

foreach(_item IN LISTS _beside)
    get_filename_component(_name "${_item}" NAME)
    string(TOLOWER "${_name}" _lowered)

    if(_lowered MATCHES "^(msvcp|vcruntime|ucrtbase|api-ms-win|kernel32|user32)")
        list(APPEND _runtime "${_name}")
    endif()
endforeach()

qmtest_equal("and nothing of the system came with it" "${_runtime}" "")

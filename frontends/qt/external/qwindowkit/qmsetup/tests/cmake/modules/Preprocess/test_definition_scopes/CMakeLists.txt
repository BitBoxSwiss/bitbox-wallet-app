# The property scopes a definition can be put on that a script cannot reach.
#
# The global and source scopes are covered by ../test_definitions.cmake, which
# needs no project. A target and a directory do, which is why these two are
# here instead.

cmake_minimum_required(VERSION 3.19)
project(qmtest_definition_scopes C)

include(${QMTEST_HARNESS})

qm_import(Preprocess)

set(_here ${CMAKE_CURRENT_SOURCE_DIR})

add_library(scopelib STATIC src/lib.c)

# ------------------------------------------------------------------
# On a target
# ------------------------------------------------------------------

qm_add_definition(ON_THE_TARGET TARGET scopelib)
qm_add_definition(WITH_A_VALUE 7 TARGET scopelib)

get_property(_d TARGET scopelib PROPERTY CONFIG_DEFINITIONS)
qmtest_equal("a definition put on a target" "${_d}" "ON_THE_TARGET;WITH_A_VALUE=7")

get_property(_g GLOBAL PROPERTY CONFIG_DEFINITIONS)
qmtest_equal("and nowhere else" "${_g}" "")

qm_remove_definition(ON_THE_TARGET TARGET scopelib)
get_property(_d TARGET scopelib PROPERTY CONFIG_DEFINITIONS)
qmtest_equal("and taken off it again" "${_d}" "WITH_A_VALUE=7")

# One target is not another.
add_library(otherlib STATIC src/lib.c)
qm_add_definition(ONLY_MINE TARGET otherlib)

get_property(_other TARGET otherlib PROPERTY CONFIG_DEFINITIONS)
get_property(_d TARGET scopelib PROPERTY CONFIG_DEFINITIONS)
qmtest_contains("a definition on one target" "${_other}" "ONLY_MINE")
qmtest_lacks("does not reach another" "${_d}" "ONLY_MINE")

# ------------------------------------------------------------------
# On a directory
# ------------------------------------------------------------------

qm_add_definition(ON_THE_DIRECTORY DIRECTORY ${_here})
get_property(_d DIRECTORY ${_here} PROPERTY CONFIG_DEFINITIONS)
qmtest_contains("a definition put on a directory" "${_d}" "ON_THE_DIRECTORY")

qm_remove_definition(ON_THE_DIRECTORY DIRECTORY ${_here})
get_property(_d DIRECTORY ${_here} PROPERTY CONFIG_DEFINITIONS)
qmtest_lacks("and taken off it again" "${_d}" "ON_THE_DIRECTORY")

# ------------------------------------------------------------------
# Which scope a header is generated from
# ------------------------------------------------------------------

qm_add_definition(FROM_THE_TARGET TARGET scopelib)
qm_add_definition(FROM_THE_GLOBAL_SCOPE)

set(_header "${CMAKE_CURRENT_BINARY_DIR}/target_config.h")
qm_generate_config("${_header}" TARGET scopelib NO_WARNING)

qmtest_file_contains("a header generated from a target has its definitions"
    "${_header}" "#define FROM_THE_TARGET")
qmtest_file_lacks("and not the ones from elsewhere"
    "${_header}" "FROM_THE_GLOBAL_SCOPE")

qmtest_report()

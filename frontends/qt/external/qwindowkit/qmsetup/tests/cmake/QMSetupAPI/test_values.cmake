# The two helpers that everything else in the API leans on. qm_set_value picks
# the first of several variables that has anything in it, which is how nearly
# every function works out its defaults, and qm_paths_equal is what stops a
# deployment copying a file over itself.

include(${QMTEST_HARNESS})

# ------------------------------------------------------------------
# qm_set_value
#
# It takes variable names rather than values, and the last argument is the
# default, which is a value.
# ------------------------------------------------------------------

set(_first "one")
set(_second "two")

qm_set_value(_r1 _first _second "fallback")
qmtest_equal("the first name that has something wins" "${_r1}" "one")

set(_empty "")
qm_set_value(_r2 _empty _second "fallback")
qmtest_equal("an empty variable is passed over" "${_r2}" "two")

qm_set_value(_r3 _empty "fallback")
qmtest_equal("the default is used when nothing else has anything" "${_r3}" "fallback")

# A name nobody ever set is the same as one set to nothing.
qm_set_value(_r4 _never_set_by_anyone "fallback")
qmtest_equal("an undefined name is passed over" "${_r4}" "fallback")

# The default may itself be empty, which is how a caller says the value is
# optional.
qm_set_value(_r5 _empty "")
qmtest_equal("an empty default is allowed" "${_r5}" "")

# A variable holding OFF is false to CMake, so it is passed over. This is what
# lets an option be turned off and fall back to the default.
set(_off off)
qm_set_value(_r6 _off "fallback")
qmtest_equal("a false variable is passed over" "${_r6}" "fallback")

# The value is taken whole, list and all.
set(_list "a;b;c")
qm_set_value(_r7 _list "fallback")
qmtest_equal("a list comes across entire" "${_r7}" "a;b;c")

# ------------------------------------------------------------------
# qm_paths_equal
# ------------------------------------------------------------------

qm_paths_equal(_p1 "${CMAKE_CURRENT_LIST_DIR}" "${CMAKE_CURRENT_LIST_DIR}")
qmtest_true("a path equals itself" "${_p1}")

qm_paths_equal(_p2 "${CMAKE_CURRENT_LIST_DIR}" "${CMAKE_CURRENT_LIST_DIR}/..")
qmtest_false("a directory is not its own parent" "${_p2}")

# The point of the function. These name the same place and must be answered as
# one, which is why it normalises rather than comparing the strings.
#
# Built out of where this file happens to sit rather than out of a name written
# here, so that moving the file does not break the check.
get_filename_component(_here "${CMAKE_CURRENT_LIST_DIR}" NAME)
qm_paths_equal(_p3 "${CMAKE_CURRENT_LIST_DIR}" "${CMAKE_CURRENT_LIST_DIR}/../${_here}")
qmtest_true("a path through its parent is the same place" "${_p3}")

qm_paths_equal(_p4 "${CMAKE_CURRENT_LIST_DIR}/" "${CMAKE_CURRENT_LIST_DIR}")
qmtest_true("a trailing separator makes no difference" "${_p4}")

get_filename_component(_self "${CMAKE_CURRENT_LIST_FILE}" NAME)
qm_paths_equal(_p5 "${CMAKE_CURRENT_LIST_DIR}/./${_self}" "${CMAKE_CURRENT_LIST_FILE}")
qmtest_true("a dot component makes no difference" "${_p5}")

qmtest_report()

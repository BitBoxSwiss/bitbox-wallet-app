# qm_get_subdirs, which is how a project walks its own tree to find what to
# add_subdirectory.

include(${QMTEST_HARNESS})

# A tree to look at. Files as well as directories, since telling them apart is
# most of what the function does.
set(_tree "${QMTEST_WORK_DIR}/tree")
file(MAKE_DIRECTORY "${_tree}/alpha")
file(MAKE_DIRECTORY "${_tree}/beta")
file(MAKE_DIRECTORY "${_tree}/gamma")
file(MAKE_DIRECTORY "${_tree}/alpha/nested")
file(WRITE "${_tree}/afile.txt" "not a directory")
file(WRITE "${_tree}/alpha/inside.txt" "nor this")

# ------------------------------------------------------------------
# What comes back
# ------------------------------------------------------------------

qm_get_subdirs(_names DIRECTORY "${_tree}")
qmtest_equal("names of the directories, and only the directories" "${_names}" "alpha;beta;gamma")

# One level, so what is under alpha is alpha's business.
list(FIND _names "nested" _found)
qmtest_equal("it does not go down" "${_found}" "-1")

qm_get_subdirs(_absolute DIRECTORY "${_tree}" ABSOLUTE)
qmtest_equal("ABSOLUTE gives whole paths" "${_absolute}" "${_tree}/alpha;${_tree}/beta;${_tree}/gamma")

qm_get_subdirs(_relative DIRECTORY "${_tree}" RELATIVE "${QMTEST_WORK_DIR}")
qmtest_equal("RELATIVE gives paths from where it was asked" "${_relative}" "tree/alpha;tree/beta;tree/gamma")

# ------------------------------------------------------------------
# Leaving some out
# ------------------------------------------------------------------

qm_get_subdirs(_kept DIRECTORY "${_tree}" EXCLUDE beta)
qmtest_equal("EXCLUDE drops the name it is given" "${_kept}" "alpha;gamma")

qm_get_subdirs(_kept DIRECTORY "${_tree}" EXCLUDE alpha gamma)
qmtest_equal("EXCLUDE takes more than one" "${_kept}" "beta")

qm_get_subdirs(_kept DIRECTORY "${_tree}" EXCLUDE nothing_of_that_name)
qmtest_equal("excluding what is not there changes nothing" "${_kept}" "alpha;beta;gamma")

# ------------------------------------------------------------------
# By pattern
# ------------------------------------------------------------------

qm_get_subdirs(_kept DIRECTORY "${_tree}" REGEX_INCLUDE "^a")
qmtest_equal("REGEX_INCLUDE keeps what matches" "${_kept}" "alpha")

# Any of them rather than all of them. Two names cannot both be true of one
# directory, so filtering one after the other left nothing at all.
qm_get_subdirs(_kept DIRECTORY "${_tree}" REGEX_INCLUDE "^a" "^b")
qmtest_equal("REGEX_INCLUDE takes more than one, and keeps what matches any"
    "${_kept}" "alpha;beta")

qm_get_subdirs(_kept DIRECTORY "${_tree}" REGEX_EXCLUDE "^a")
qmtest_equal("REGEX_EXCLUDE drops what matches" "${_kept}" "beta;gamma")

qm_get_subdirs(_kept DIRECTORY "${_tree}" REGEX_EXCLUDE "^a" "^b")
qmtest_equal("REGEX_EXCLUDE takes more than one" "${_kept}" "gamma")

# ------------------------------------------------------------------
# Nothing there
# ------------------------------------------------------------------

file(MAKE_DIRECTORY "${QMTEST_WORK_DIR}/bare")
qm_get_subdirs(_none DIRECTORY "${QMTEST_WORK_DIR}/bare")
qmtest_equal("a directory with nothing under it answers with nothing" "${_none}" "")

qmtest_report()

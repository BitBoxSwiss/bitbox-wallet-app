# qm_generate_config, which is where the definition list stops being a CMake
# property and becomes a header a compiler reads.
#
# This is the one place the CMake layer and qmcorecmd meet, so it runs the real
# executable rather than standing in for it.

include(${QMTEST_HARNESS})

qm_import(Preprocess)

if(NOT QMSETUP_CORECMD_EXECUTABLE)
    message(FATAL_ERROR "QMCORECMD is not set, so there is nothing to generate with")
endif()

macro(reset)
    set_property(GLOBAL PROPERTY CONFIG_DEFINITIONS "")
endmacro()

set(_header "${QMTEST_WORK_DIR}/config.h")

# ------------------------------------------------------------------
# What lands in the header
# ------------------------------------------------------------------

reset()
qm_add_definition(FEATURE_ONE)
qm_add_definition(ANSWER 42)
qm_add_definition(NAME hello STRING_LITERAL)
qm_generate_config("${_header}" NO_WARNING)

qmtest_file_contains("a bare key is defined" "${_header}" "#define FEATURE_ONE")
qmtest_file_contains("a value comes through" "${_header}" "#define ANSWER 42")
qmtest_file_contains("a string literal keeps its quotes" "${_header}" "#define NAME \"hello\"")

# The guard is what makes it a header rather than a fragment.
qmtest_file_contains("it is guarded" "${_header}" "#ifndef")
qmtest_file_contains("and the guard is closed" "${_header}" "#endif")

# ------------------------------------------------------------------
# Nothing to say
# ------------------------------------------------------------------

reset()
qm_generate_config("${QMTEST_WORK_DIR}/empty.h" NO_WARNING)
qmtest_file_contains("an empty configuration is still a header" "${QMTEST_WORK_DIR}/empty.h" "#ifndef")

# ------------------------------------------------------------------
# Regenerating
#
# The point of the hash the tool writes: a header whose contents did not change
# is left alone, so that nothing downstream rebuilds for no reason.
# ------------------------------------------------------------------

reset()
qm_add_definition(FEATURE_ONE)
qm_generate_config("${_header}" NO_WARNING)
file(TIMESTAMP "${_header}" _before "%Y-%m-%dT%H:%M:%S")
file(READ "${_header}" _content_before)

qm_generate_config("${_header}" NO_WARNING)
file(READ "${_header}" _content_after)
qmtest_equal("generating the same configuration writes the same header" "${_content_after}" "${_content_before}")

# And one whose contents did change is written.
reset()
qm_add_definition(FEATURE_TWO)
qm_generate_config("${_header}" NO_WARNING)
qmtest_file_contains("a changed configuration is written out" "${_header}" "#define FEATURE_TWO")

file(READ "${_header}" _content)

if("${_content}" MATCHES "FEATURE_ONE")
    qmtest_equal("the old definition is gone" "still there" "gone")
else()
    qmtest_equal("the old definition is gone" "gone" "gone")
endif()

# ------------------------------------------------------------------
# PROJECT_NAME, which the guard is built out of
# ------------------------------------------------------------------

reset()
qm_add_definition(FEATURE_ONE)
qm_generate_config("${QMTEST_WORK_DIR}/named.h" PROJECT_NAME MyProject NO_WARNING)
# Upper cased, the guard being a macro name rather than a title.
qmtest_file_contains("the project name reaches the guard" "${QMTEST_WORK_DIR}/named.h" "MYPROJECT_NAMED_H")

# ------------------------------------------------------------------
# The warning
# ------------------------------------------------------------------

reset()
qm_add_definition(FEATURE_ONE)
qm_generate_config("${QMTEST_WORK_DIR}/warned.h")
qmtest_file_contains("a generated header says not to edit it" "${QMTEST_WORK_DIR}/warned.h" "[Aa]uto")

qmtest_report()

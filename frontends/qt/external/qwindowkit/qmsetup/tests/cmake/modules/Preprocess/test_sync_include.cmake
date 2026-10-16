# qm_sync_include, the wrapper around `qmcorecmd incsync`.
#
# What the tool does with a header tree is tested against the tool. What is
# checked here is the wrapper's own job: turning its options into the tool's
# arguments, and deciding whether to run it at all.

include(${QMTEST_HARNESS})

qm_import(Preprocess)

if(NOT QMSETUP_CORECMD_EXECUTABLE)
    message(FATAL_ERROR "QMCORECMD is not set, so there is nothing to sync with")
endif()

set(_src "${QMTEST_WORK_DIR}/src")
file(WRITE "${_src}/foo.h" "// foo")
file(WRITE "${_src}/sub/bar.h" "// bar")
file(WRITE "${_src}/sub/baz_p.h" "// private baz")
file(WRITE "${_src}/notaheader.txt" "// not a header")

# Each check gets a destination of its own, so that the one before it cannot
# decide what this one sees.
set(_n 0)

macro(fresh_dest _var)
    math(EXPR _n "${_n} + 1")
    set(${_var} "${QMTEST_WORK_DIR}/include${_n}")
endmacro()

# ------------------------------------------------------------------
# What it leaves behind
# ------------------------------------------------------------------

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}")

qmtest_file_contains("a header is reachable by its own name" "${_dest}/foo.h" "#include")
qmtest_file_contains("and one from further down is flattened up" "${_dest}/bar.h" "#include")
qmtest_not_exists("what is not a header is left behind" "${_dest}/notaheader.txt")

# The standard pattern is on unless told otherwise, so a private header goes to
# a private directory rather than beside the rest.
qmtest_exists("a private header is put aside by default" "${_dest}/private/baz_p.h")

# ------------------------------------------------------------------
# NO_STANDARD, and the variable that decides it
# ------------------------------------------------------------------

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}" NO_STANDARD)
qmtest_not_exists("NO_STANDARD leaves private headers with the rest" "${_dest}/private/baz_p.h")
qmtest_exists("and they are still there to be found" "${_dest}/baz_p.h")

# Turned off for the whole project, and asked for again at one call. That second
# part is what STANDARD is for, and the only case in which it means anything.
set(QMSETUP_SYNC_INCLUDE_STANDARD off)

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}")
qmtest_not_exists("the variable turns it off for everything" "${_dest}/private/baz_p.h")

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}" STANDARD)
qmtest_exists("STANDARD asks for it back" "${_dest}/private/baz_p.h")

set(QMSETUP_SYNC_INCLUDE_STANDARD on)

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}" NO_STANDARD)
qmtest_not_exists("NO_STANDARD overrides the variable the other way" "${_dest}/private/baz_p.h")

# ------------------------------------------------------------------
# EXCLUDE
# ------------------------------------------------------------------

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}" EXCLUDE "bar")
qmtest_not_exists("EXCLUDE keeps a header out" "${_dest}/bar.h")
qmtest_exists("and the others still come" "${_dest}/foo.h")

# ------------------------------------------------------------------
# Running again
#
# A destination that is already there is left alone, so that reconfiguring does
# not touch every header and rebuild everything that reads one.
# ------------------------------------------------------------------

fresh_dest(_dest)
qm_sync_include("${_src}" "${_dest}")
file(WRITE "${_dest}/marker.txt" "left by hand")

qm_sync_include("${_src}" "${_dest}")
qmtest_exists("a destination that is already there is not rebuilt" "${_dest}/marker.txt")

qm_sync_include("${_src}" "${_dest}" FORCE)
qmtest_not_exists("FORCE wipes it and starts again" "${_dest}/marker.txt")
qmtest_exists("and the headers are back" "${_dest}/foo.h")

# ------------------------------------------------------------------
# A source that is not there
# ------------------------------------------------------------------

qmtest_script_fails("a source directory that is not there is refused"
    "source directory doesn't exist"
    "qm_import(Preprocess)\nqm_sync_include(\"${QMTEST_WORK_DIR}/nothing_of_that_name\" \"${QMTEST_WORK_DIR}/nowhere\")")

qmtest_report()

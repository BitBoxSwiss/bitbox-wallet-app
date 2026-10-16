# What qm_sync_include installed, once the project was built and installed.
#
# Included by testing/build.cmake. `_prefix` is where it went. Nothing is built
# here, the whole of it happening while installing.

set(_installed "${_prefix}/include/QmTest")

qmtest_exists("a header at the top of the tree arrives" "${_installed}/foo.h")
qmtest_exists("and one below it, flattened alongside" "${_installed}/bar.h")

# The standard pattern is on by default, so a name ending in _p is private and
# goes a level down rather than beside the rest.
qmtest_exists("a private header goes where the pattern puts it"
    "${_installed}/private/baz_p.h")

qmtest_not_exists("and what is not a header is left behind"
    "${_installed}/notaheader.txt")

# The install rule reads the tool's own account of what it would sync, one line
# per file. A line it cannot make sense of is passed over, and it used to carry
# the last match forward instead, which put a header where the one before it
# had gone. So what lands has to be each header once, under its own name.
file(GLOB_RECURSE _found RELATIVE "${_installed}" "${_installed}/*")
list(SORT _found)
qmtest_equal("each of them once, and nothing else" "${_found}"
    "bar.h;foo.h;private/baz_p.h")

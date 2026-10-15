# qm_future_configure_file.
#
# The substitution happens at build time rather than at configure time, which is
# the whole point of it: a file generated out of something that was built cannot
# be written while the project is still being read. So nothing short of a real
# build reaches it. Built by testing/build.cmake and asserted in check.cmake.
# Nothing is installed.

cmake_minimum_required(VERSION 3.19)
project(qmtest_future_configure_file NONE)

include(${QMSETUP_API})

qm_import(Filesystem)

set(_assets "${CMAKE_CURRENT_SOURCE_DIR}/assets")
set(_out "${CMAKE_BINARY_DIR}/out")

set(THE_NAME "a name from the project")
set(THE_NUMBER 42)

set(_wanted)

# The plain case.
qm_future_configure_file("${_assets}/template.txt.in" "${_out}/configured.txt"
    VARIABLES THE_NAME THE_NUMBER
)
list(APPEND _wanted "${_out}/configured.txt")

# A variable that was never named is left as it stands rather than emptied, so
# that a template can carry something for a later pass.
qm_future_configure_file("${_assets}/template.txt.in" "${_out}/partial.txt"
    VARIABLES THE_NAME
)
list(APPEND _wanted "${_out}/partial.txt")

# FORCE removes what is there first. Written as list(APPLE ...) this was not an
# option but an outright error, so a call with it never worked at all.
qm_future_configure_file("${_assets}/template.txt.in" "${_out}/forced.txt"
    VARIABLES THE_NAME THE_NUMBER
    FORCE
)
list(APPEND _wanted "${_out}/forced.txt")

# EXTRA_ARGS reaches configure_file. @ONLY leaves ${...} alone, which is what a
# template holding shell or makefile syntax needs.
qm_future_configure_file("${_assets}/dollars.txt.in" "${_out}/dollars.txt"
    VARIABLES THE_NAME
    EXTRA_ARGS @ONLY
)
list(APPEND _wanted "${_out}/dollars.txt")

# A directory that is not there yet is made rather than being an error.
qm_future_configure_file("${_assets}/template.txt.in" "${_out}/further/down/configured.txt"
    VARIABLES THE_NAME THE_NUMBER
)
list(APPEND _wanted "${_out}/further/down/configured.txt")

# A custom command runs only when something wants what it makes.
add_custom_target(qmtest_configure_them_all ALL DEPENDS ${_wanted})

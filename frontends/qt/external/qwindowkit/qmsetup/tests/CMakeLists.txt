# Where the project itself is, for the tests that read what it ships rather
# than what it built.
set(QMSETUP_PROJECT_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)

# The fixtures are C, and the project itself is C++ alone. Asked for here rather
# than in cli/, which is where it used to be: cmake/ passes CMAKE_C_COMPILER
# down to the projects it configures, so it worked only for as long as cli/ came
# first in the two lines below.
enable_language(C)

add_subdirectory(cli)
add_subdirectory(cmake)

# What qm_future_configure_file wrote once the build ran.
#
# Included by testing/build.cmake. `_build` is the build directory.

set(_out "${_build}/out")

qmtest_exists("the file is written" "${_out}/configured.txt")
qmtest_file_contains("VARIABLES are substituted" "${_out}/configured.txt" "a name from the project")
qmtest_file_contains("all of them" "${_out}/configured.txt" "number is 42")
qmtest_file_lacks("and nothing named is left standing" "${_out}/configured.txt" "@THE_NAME@")

# Only what VARIABLES names crosses into the command, and configure_file writes
# nothing where it has nothing. So a variable left out does not stay as it was
# written, it goes quietly. Worth pinning down, since a template that looks
# right will come out with a hole in it.
qmtest_file_contains("a variable that was named is substituted" "${_out}/partial.txt" "a name from the project")
qmtest_file_lacks("and one that was not is emptied rather than left" "${_out}/partial.txt" "@THE_NUMBER@")
# Anchored on the line ending rather than on $, which in a CMake regex is the
# end of the whole file.
qmtest_file_contains("leaving nothing where it stood" "${_out}/partial.txt" "number is[ \t]*[\r\n]")

qmtest_exists("FORCE is an option rather than an error" "${_out}/forced.txt")
qmtest_file_contains("and writes the same thing" "${_out}/forced.txt" "a name from the project")

qmtest_file_contains("EXTRA_ARGS reaches configure_file" "${_out}/dollars.txt" "a name from the project")
# Written as a character class so that CMake does not expand it on the way in.
qmtest_file_contains("and @ONLY leaves the other syntax alone" "${_out}/dollars.txt" "[$]{HOME}")

qmtest_exists("a directory that was not there is made" "${_out}/further/down/configured.txt")

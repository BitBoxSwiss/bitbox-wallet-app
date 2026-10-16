# What qm_add_copy_command copied, once the project was built and installed.
#
# Included by testing/build.cmake. `_build` is the build directory and `_prefix`
# is where it was installed.

set(_out "${_build}/out")
set(_bin "${_out}/bin")

# ------------------------------------------------------------------
# What a source may be
# ------------------------------------------------------------------

qmtest_exists("a file named on its own" "${_bin}/one_file/one.txt")

qmtest_exists("two files at once" "${_bin}/two_files/one.txt")
qmtest_exists("both of them" "${_bin}/two_files/two.txt")

qmtest_exists("a directory arrives as itself" "${_bin}/whole_directory/nested/three.txt")
qmtest_exists("with what is under it" "${_bin}/whole_directory/nested/deeper/four.txt")
qmtest_not_exists("rather than as its contents" "${_bin}/whole_directory/three.txt")

qmtest_exists("a trailing separator asks for the contents" "${_bin}/directory_contents/three.txt")
qmtest_exists("all the way down" "${_bin}/directory_contents/deeper/four.txt")
qmtest_not_exists("rather than the directory" "${_bin}/directory_contents/nested/three.txt")

qmtest_exists("a pattern brings what matches" "${_bin}/by_pattern/one.txt")
qmtest_exists("all of it" "${_bin}/by_pattern/two.txt")
qmtest_exists("including a name with a space in it" "${_bin}/by_pattern/with space.txt")

qmtest_exists("two stars go down as well" "${_bin}/by_deep_pattern/three.txt")
qmtest_exists("into what is under it" "${_bin}/by_deep_pattern/four.txt")

qmtest_exists("a relative source is found" "${_bin}/relative_source/two.txt")
qmtest_exists("and a path with a space in it" "${_bin}/with_space/with space.txt")

# ------------------------------------------------------------------
# Where the destination is measured from
# ------------------------------------------------------------------

qmtest_exists("with no destination it lands beside the target" "${_bin}/one.txt")
qmtest_exists("an absolute destination is taken as written" "${_build}/somewhere/else/one.txt")

# A custom target has no file of its own to be beside.
qmtest_exists("a custom target measures from the build directory" "${_out}/from_the_build_dir/two.txt")
qmtest_not_exists("rather than from where a target was built" "${_bin}/from_the_build_dir/two.txt")

qmtest_exists("CUSTOM_TARGET hangs it off something else" "${_build}/gathered/one.txt")

# ------------------------------------------------------------------
# What it was told not to do
# ------------------------------------------------------------------

qmtest_not_exists("SKIP_BUILD copies nothing while building" "${_bin}/install_only/one.txt")
qmtest_exists("and still copies while installing" "${_prefix}/share/bin/install_only/one.txt")

qmtest_exists("SKIP_INSTALL copies while building" "${_bin}/build_only/two.txt")
qmtest_not_exists("and nothing while installing" "${_prefix}/share/bin/build_only/two.txt")

# INSTALL_DIR keeps the same relative path under the prefix that the build used
# under QMSETUP_BUILD_DIR.
qmtest_exists("both ways, while building" "${_out}/both/ways/three.txt")
qmtest_exists("and while installing, at the same relative place" "${_prefix}/share/both/ways/three.txt")

# ------------------------------------------------------------------
# EXTRA_ARGS
# ------------------------------------------------------------------

qmtest_exists("what EXTRA_ARGS did not exclude arrives" "${_bin}/filtered/three.txt")
qmtest_not_exists("and what it excluded does not" "${_bin}/filtered/skipme.skip")

# The install phase builds its command separately and so has to be asked
# separately.
qmtest_exists("the same holds while installing" "${_prefix}/share/filtered_install/three.txt")
qmtest_not_exists("and what was excluded is still excluded" "${_prefix}/share/filtered_install/skipme.skip")

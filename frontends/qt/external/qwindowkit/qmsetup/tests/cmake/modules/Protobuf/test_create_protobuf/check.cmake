# What qm_create_protobuf generated, once the project was built.
#
# Included by testing/build.cmake. `_build` is the build directory. Nothing is
# installed here.

set(_generated_dir "${_build}/generated")

# ------------------------------------------------------------------
# What protoc wrote
# ------------------------------------------------------------------

qmtest_exists("a header for the first input" "${_generated_dir}/qmtest_base.pb.h")
qmtest_exists("and a source beside it" "${_generated_dir}/qmtest_base.pb.cc")

qmtest_exists("a header for the second" "${_generated_dir}/qmtest_derived.pb.h")
qmtest_exists("and its source" "${_generated_dir}/qmtest_derived.pb.cc")

# OUTPUT_DIR rather than wherever the input was.
qmtest_not_exists("nothing is written beside the input"
    "${_build}/../qmtest_base.pb.h")

# The message names come from the .proto, so a header holding them is one protoc
# read rather than a file that happens to exist.
qmtest_file_contains("the header declares what the schema described"
    "${_generated_dir}/qmtest_base.pb.h" "Base")
qmtest_file_contains("and the other one too"
    "${_generated_dir}/qmtest_derived.pb.h" "Derived")

# The second schema imports the first, so its header includes the first's. That
# is what says INCLUDE_DIRECTORIES reached protoc as an -I, the two files being
# in different directories.
qmtest_file_contains("an import becomes an include of the other header"
    "${_generated_dir}/qmtest_derived.pb.h" "qmtest_base.pb.h")

# ------------------------------------------------------------------
# What the function answered with
# ------------------------------------------------------------------

# Two files per input, in the order they were given, and every one of them a
# path that is really there.
file(STRINGS "${_build}/generated_list.txt" _named)
list(LENGTH _named _count)
qmtest_equal("two files are named for each of the two inputs" "${_count}" "4")

set(_missing)

foreach(_item IN LISTS _named)
    if(NOT EXISTS "${_item}")
        list(APPEND _missing "${_item}")
    endif()
endforeach()

qmtest_equal("and each of them is on disk" "${_missing}" "")

# ------------------------------------------------------------------
# That it compiles
# ------------------------------------------------------------------

# The library is built from the generated sources, so the build having finished
# at all is most of this. What is left is that the object files are there, since
# a library of no sources would also build.
file(GLOB_RECURSE _objects "${_build}/*qmtest_base.pb*.o" "${_build}/*qmtest_base.pb*.obj")
qmtest_true("the generated source was compiled" "${_objects}")

# qm_create_protobuf, against a real protoc.
#
# Registered only where tests/cmake/CMakeLists.txt found a protobuf, so there is
# no check in here asking whether one is present.
#
# Found both ways, since neither reaches every protobuf. One installed the
# upstream way answers CONFIG, and a distribution package carries no CMake
# configuration at all and is found by FindProtobuf looking for the compiler.
#
# CONFIG first. The other order is an error, the second call stopping on targets
# the first has already defined, and a CONFIG that found nothing defines nothing
# for module mode to trip over.
#
# Built by testing/build.cmake, since the generating rule runs at build time.
# Nothing is installed. What was generated is asserted in check.cmake, and the
# generated code is also compiled here, which is the only thing that says protoc
# was given what it needed rather than merely run.

cmake_minimum_required(VERSION 3.19)
project(qmtest_create_protobuf CXX)

find_package(Protobuf CONFIG QUIET)

if(NOT TARGET protobuf::protoc)
    find_package(Protobuf REQUIRED)
endif()

include(${QMSETUP_API})

qm_import(Protobuf)

set(_here "${CMAKE_CURRENT_SOURCE_DIR}")
set(_out_dir "${CMAKE_BINARY_DIR}/generated")

# CREATE_ONCE, so these are written while configuring rather than while
# building. The rule to rebuild them is added either way.
#
# The two files are in different directories and the second imports the first,
# so protoc finds it only if INCLUDE_DIRECTORIES reached the command line as an
# -I. Without that the generate step fails outright.
qm_create_protobuf(_generated
    INPUT
        "${_here}/proto/qmtest_base.proto"
        "${_here}/other/qmtest_derived.proto"
    INCLUDE_DIRECTORIES "${_here}/proto"
    OUTPUT_DIR "${_out_dir}"
    TARGET qmtest_protobuf_target
    CREATE_ONCE
)

# What it answered with, for check.cmake to compare against what is on disk.
list(JOIN _generated "\n" _generated_lines)
file(WRITE "${CMAKE_BINARY_DIR}/generated_list.txt" "${_generated_lines}\n")

# Compiled, which is what says the generated code is real rather than a pair of
# files with the right names.
add_library(qmtest_protobuf_lib STATIC ${_generated})
target_include_directories(qmtest_protobuf_lib PRIVATE "${_out_dir}")
target_link_libraries(qmtest_protobuf_lib PRIVATE protobuf::libprotobuf)

# Nothing depends on the custom target, so it is built on its own account. That
# TARGET names something buildable at all is what this says: the files were
# handed to add_dependencies, which takes target names, so every call naming a
# TARGET stopped the generate step with one error per file.
add_custom_target(qmtest_protobuf_all ALL DEPENDS qmtest_protobuf_target)

# The generated files are removed once, so the target above has to make them
# again rather than finding them already there from the configure.
file(REMOVE ${_generated})

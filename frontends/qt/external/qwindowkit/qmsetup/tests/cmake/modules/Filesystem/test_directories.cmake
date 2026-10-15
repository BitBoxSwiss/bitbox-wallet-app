# qm_init_directories, which decides where a build puts what it makes.
#
# It is a macro rather than a function, so it sets these in the caller's scope,
# and it leaves alone anything already set. That second part is what lets a
# project override one directory without losing the rest.

include(${QMTEST_HARNESS})

qm_import(Filesystem)

# ------------------------------------------------------------------
# Nothing set beforehand
# ------------------------------------------------------------------

qm_init_directories()

qmtest_equal("the build directory is named after the configuration"
    "${QMSETUP_BUILD_DIR}" "${CMAKE_BINARY_DIR}/out-$<LOWER_CASE:${CMAKE_SYSTEM_PROCESSOR}>-$<CONFIG>")

qmtest_equal("executables go under bin" "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}" "${QMSETUP_BUILD_DIR}/bin")
qmtest_equal("libraries go under lib" "${CMAKE_LIBRARY_OUTPUT_DIRECTORY}" "${QMSETUP_BUILD_DIR}/lib")
qmtest_equal("import libraries go under lib too" "${CMAKE_ARCHIVE_OUTPUT_DIRECTORY}" "${QMSETUP_BUILD_DIR}/lib")
qmtest_equal("resources go under share" "${QMSETUP_BUILD_SHARE_DIR}" "${QMSETUP_BUILD_DIR}/share")

# The old name, kept until nothing reads it. It never belonged in CMake's
# namespace, the three above being CMake's own and this one not.
qmtest_equal("and the deprecated name still answers the same"
    "${CMAKE_BUILD_SHARE_DIR}" "${QMSETUP_BUILD_SHARE_DIR}")

# ------------------------------------------------------------------
# A project that has made up its own mind
# ------------------------------------------------------------------

unset(QMSETUP_BUILD_DIR)
unset(CMAKE_RUNTIME_OUTPUT_DIRECTORY)
unset(CMAKE_LIBRARY_OUTPUT_DIRECTORY)
unset(CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
unset(QMSETUP_BUILD_SHARE_DIR)
unset(CMAKE_BUILD_SHARE_DIR)

set(QMSETUP_BUILD_DIR "/somewhere/else")
qm_init_directories()

qmtest_equal("a build directory already set is kept" "${QMSETUP_BUILD_DIR}" "/somewhere/else")
qmtest_equal("and the rest follow it" "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}" "/somewhere/else/bin")

unset(QMSETUP_BUILD_DIR)
unset(CMAKE_RUNTIME_OUTPUT_DIRECTORY)
unset(CMAKE_LIBRARY_OUTPUT_DIRECTORY)
unset(CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
unset(QMSETUP_BUILD_SHARE_DIR)
unset(CMAKE_BUILD_SHARE_DIR)

# One directory of its own, and the others still worked out.
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "/only/this/one")
qm_init_directories()

qmtest_equal("a directory already set is left alone" "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}" "/only/this/one")
qmtest_equal("and the others are still filled in" "${CMAKE_LIBRARY_OUTPUT_DIRECTORY}" "${QMSETUP_BUILD_DIR}/lib")

qmtest_report()

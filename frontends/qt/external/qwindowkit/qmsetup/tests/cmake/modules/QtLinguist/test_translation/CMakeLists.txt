# qm_add_translation, against a real Qt Linguist.
#
# Registered only where tests/cmake/CMakeLists.txt found a Qt, and built by
# testing/build.cmake, since nothing lupdate or lrelease does happens while the
# project is being read. What is asserted is in check.cmake. Nothing is
# installed.
#
# CREATE_ONCE, because lrelease reads the .ts files and a from-scratch build has
# none. With it they are written while configuring, which is what the option is
# for, and the build then has something to release.
#
# TS_DIR under the build directory rather than the default, which is the source
# directory. A test that wrote into its own source tree would leave the next run
# looking at what the last one did.

cmake_minimum_required(VERSION 3.19)
project(qmtest_translation CXX)

include(${QMSETUP_API})

qm_import(QtLinguist)

qm_find_qt(Core LinguistTools)

add_library(qmtest_translated STATIC src/lib.cpp)
qm_link_qt(qmtest_translated PRIVATE Core)

set(_ts_dir "${CMAKE_BINARY_DIR}/ts")
set(_qm_dir "${CMAKE_BINARY_DIR}/qm")

# Two locales, so there are two .ts and two .qm files. One of each would not
# show whether a rule reads only what it needs.
qm_add_translation(qmtest_translations
    LOCALES zh_CN en_US
    PREFIX qmtest
    TARGETS qmtest_translated
    TS_DIR "${_ts_dir}"
    QM_DIR "${_qm_dir}"
    CREATE_ONCE
)

# Where check.cmake is to look, said here rather than worked out again there.
# The list file is the one lupdate is handed, and reading it is how what it was
# told about include directories can be seen.
file(WRITE "${CMAKE_BINARY_DIR}/translation_paths.cmake"
    "set(_ts_dir \"${_ts_dir}\")\n"
    "set(_qm_dir \"${_qm_dir}\")\n"
    "set(_lst_dir \"${CMAKE_BINARY_DIR}${CMAKE_FILES_DIRECTORY}\")\n"
)

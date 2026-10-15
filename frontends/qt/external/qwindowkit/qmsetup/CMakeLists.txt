cmake_minimum_required(VERSION 3.19)

project(qmsetup
    VERSION 1.1.2.0
    LANGUAGES CXX
    DESCRIPTION "CMake Modules and Basic Libraries for C/C++ projects."
    HOMEPAGE_URL "https://github.com/stdware/qmsetup"
)

# ----------------------------------
# Configure Options
# ----------------------------------
option(QMSETUP_STATIC_RUNTIME "Static link runtime libraries on Windows" ON)
option(QMSETUP_BUILD_TESTS "Build test cases" OFF)
option(QMSETUP_BUILD_DOCUMENTATIONS "Build documentations" OFF)

# ----------------------------------
# CMake Settings
# ----------------------------------
if(NOT DEFINED CMAKE_RUNTIME_OUTPUT_DIRECTORY)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/out/bin)
endif()

if(NOT DEFINED CMAKE_LIBRARY_OUTPUT_DIRECTORY)
    set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/out/lib)
endif()

if(NOT DEFINED CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
    set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/out/lib)
endif()

if(MSVC)
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /manifest:no")
    set(CMAKE_MODULE_LINKER_FLAGS "${CMAKE_MODULE_LINKER_FLAGS} /manifest:no")
    set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} /manifest:no")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /utf-8")

    if(NOT DEFINED CMAKE_DEBUG_POSTFIX)
        set(CMAKE_DEBUG_POSTFIX "d")
    endif()
endif()

# ----------------------------------
# Project Variables
# ----------------------------------
set(QMSETUP_VERSION ${PROJECT_VERSION})
set(QMSETUP_DESCRIPTION ${PROJECT_DESCRIPTION})
set(QMSETUP_HOMEPAGE_URL ${PROJECT_HOMEPAGE_URL})
set(QMSETUP_INSTALL_NAME ${PROJECT_NAME})
set(QMSETUP_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR})

include(cmake/QMSetupAPI.cmake)

add_subdirectory(src)

if(QMSETUP_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

if (QMSETUP_BUILD_DOCUMENTATIONS)
    add_subdirectory(docs/sphinx docs)
endif()
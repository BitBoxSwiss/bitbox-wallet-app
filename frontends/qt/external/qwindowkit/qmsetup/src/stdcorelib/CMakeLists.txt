cmake_minimum_required(VERSION 3.16)

project(stdcorelib
    VERSION 0.2.1.0
    LANGUAGES CXX
    DESCRIPTION "Portable C++ Application Infrastructure."
    HOMEPAGE_URL "https://github.com/stdware/stdcorelib"
)

# ----------------------------------
# Build Options
# ----------------------------------
# With neither STDC_BUILD_STATIC nor STDC_BUILD_SHARED set, the library follows
# BUILD_SHARED_LIBS, which leaves it static when that is not set either.
option(STDC_BUILD_STATIC "Build static library" OFF)
option(STDC_BUILD_SHARED "Build shared library" OFF)
option(STDC_BUILD_TESTS "Build test cases" OFF)
option(STDC_BUILD_DOCS "Build documentation" OFF)
option(STDC_ENABLE_EXCEPTIONS "Build the library with exceptions" ON)
option(STDC_INSTALL "Install library" ON)

# ----------------------------------
# CMake Settings
# ----------------------------------
if(NOT DEFINED CMAKE_RUNTIME_OUTPUT_DIRECTORY)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/out/bin)
endif()

if(NOT DEFINED CMAKE_LIBRARY_OUTPUT_DIRECTORY)
    set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/out/lib)
endif()

if(NOT DEFINED CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
    set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/out/lib)
endif()

if(MSVC)
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /manifest:no")
    set(CMAKE_MODULE_LINKER_FLAGS "${CMAKE_MODULE_LINKER_FLAGS} /manifest:no")
    set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} /manifest:no")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /utf-8")

    if(NOT DEFINED CMAKE_DEBUG_POSTFIX)
        set(CMAKE_DEBUG_POSTFIX "d")
    endif()
elseif(MINGW)
    set(CMAKE_STATIC_LIBRARY_PREFIX "")
    set(CMAKE_SHARED_LIBRARY_PREFIX "")
endif()

if(STDC_INSTALL)
    include(GNUInstallDirs)
    include(CMakePackageConfigHelpers)
endif()

# ----------------------------------
# Project Variables
# ----------------------------------
set(STDC_VERSION ${PROJECT_VERSION})
set(STDC_INSTALL_NAME ${PROJECT_NAME})

# ----------------------------------
# Main Project
# ----------------------------------
include(cmake/AddDoxygenDocs.cmake)
include(cmake/AddWinRC.cmake)
include(cmake/AddInstallPackageRule.cmake)
include(cmake/AddInstallPDBRule.cmake)

if(TRUE)
    file(GLOB _common_src src/*.cpp)
    file(GLOB_RECURSE _subdir_src
        src/support/*.cpp
        src/adt/*.cpp
        src/stlextra/*.cpp
    )
    file(GLOB _platform_common_src src/platform/*.cpp)

    if(WIN32)
        file(GLOB _platform_src src/platform/windows/*.cpp)
    elseif(UNIX)
        if(APPLE)
            file(GLOB_RECURSE _objc_src src/*.mm)
            file(GLOB _platform_src src/platform/mac/*.cpp)
            list(APPEND _platform_src ${_objc_src})
        else()
            file(GLOB _platform_src src/platform/linux/*.cpp)
        endif()
    endif()

    set(_src ${_common_src} ${_subdir_src} ${_platform_common_src} ${_platform_src})
    set(_temp)

    # filter
    foreach(_item IN LISTS _src)
        get_filename_component(_name ${_item} NAME)

        if(WIN32)
            # remove mac/linux
            if(_name MATCHES ".+_(unix|darwin|mac|linux)\..+" OR _name MATCHES "^unix_.+")
                continue()
            endif()
        else()
            # remove windows
            if(_name MATCHES ".+_(win|windows)\..+" OR _name MATCHES "^windows_.+" OR _name MATCHES "^win_.+" OR _name MATCHES "winapi.*")
                continue()
            endif()

            if(APPLE)
                # remove linux
                if(_name MATCHES ".+_linux\..+")
                    continue()
                endif()
            else()
                # remove mac
                if(_name MATCHES ".+_(darwin|mac)\..+")
                    continue()
                endif()
            endif()
        endif()

        list(APPEND _temp ${_item})
    endforeach()

    set(_src ${_temp})
    unset(_temp)
endif()

if(STDC_BUILD_STATIC OR(NOT STDC_BUILD_SHARED AND NOT BUILD_SHARED_LIBS))
    add_library(${PROJECT_NAME} STATIC)
    target_compile_definitions(${PROJECT_NAME} PUBLIC STDC_STATIC)
else()
    add_library(${PROJECT_NAME} SHARED)
endif()

add_library(${PROJECT_NAME}::${PROJECT_NAME} ALIAS ${PROJECT_NAME})

target_sources(${PROJECT_NAME} PRIVATE ${_src})
target_compile_definitions(${PROJECT_NAME} PRIVATE STDC_LIBRARY)

if(STDC_ENABLE_EXCEPTIONS)
    # PUBLIC, and the only definition here that is: it tells whoever links this binary whether it
    # can throw at them. Not the same question as STDC_HAS_EXCEPTIONS, which every translation
    # unit works out about itself.
    target_compile_definitions(${PROJECT_NAME} PUBLIC STDC_EXCEPTIONS=1)
else()
    if(MSVC)
        target_compile_options(${PROJECT_NAME} PRIVATE /EHs-c- /wd4530)
    else()
        target_compile_options(${PROJECT_NAME} PRIVATE -fno-exceptions)
    endif()
endif()

target_include_directories(${PROJECT_NAME} INTERFACE
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)
target_include_directories(${PROJECT_NAME} PRIVATE
    src
    include
    include/stdcorelib
    include/stdcorelib/platform
    include/stdcorelib/support
    include/stdcorelib/adt
    include/stdcorelib/stlextra
)

if(WIN32)
    target_include_directories(${PROJECT_NAME} PRIVATE
        include/stdcorelib/platform/windows
    )
endif()

target_compile_features(${PROJECT_NAME} PUBLIC cxx_std_17)
set_target_properties(${PROJECT_NAME} PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# Add platform specific
if(WIN32)
    stdc_add_win_rc(${PROJECT_NAME}
        COPYRIGHT "Copyright (C) 2022-present Stdware Collections"
    )
endif()

if(STDC_BUILD_DOCS)
    set(_doxygen_install)

    if(STDC_INSTALL)
        set(_doxygen_install INSTALL)
    endif()

    stdc_add_doxygen_docs(${PROJECT_NAME}
        ${_doxygen_install}
        DESCRIPTION "${PROJECT_DESCRIPTION}"
        INPUT
        "${CMAKE_CURRENT_SOURCE_DIR}/include"
        "${CMAKE_CURRENT_SOURCE_DIR}/docs/doxygen"
        EXCLUDE_SYMBOLS
        "*::detail"
        "*::detail::*"
        "stdc::pimpl"
        "stdc::str::conv*"
        "*enable_if*"
        "stdc::is_map"
        "stdc::has_key_type*"
        "stdc::has_mapped_type*"
        "stdc::vlarray_base"
        "stdc::flag"
        "stdc::incompatible_flag"
        "stdc::winapi::kernel32"
        "stdc::winapi::user32"
        PREDEFINED
        "STDC_EXPORT="
        "STDC_DECL_EXPORT="
        "STDC_DECL_IMPORT="
        "STDC_HAS_EXCEPTIONS=1"
        "STDC_ALLOCA(size)="
        "_WIN32=1"
        "DOXYGEN=1"
    )
endif()

if(STDC_INSTALL)
    install(TARGETS ${PROJECT_NAME}
        EXPORT ${STDC_INSTALL_NAME}Targets
        RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}" OPTIONAL
        LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}" OPTIONAL
        ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}" OPTIONAL
    )

    if(WIN32)
        set(_debug_symbols_dir "${CMAKE_INSTALL_BINDIR}")
    else()
        set(_debug_symbols_dir "${CMAKE_INSTALL_LIBDIR}")
    endif()

    stdc_add_install_pdb_rule(${PROJECT_NAME} DESTINATION "${_debug_symbols_dir}")
endif()

if(WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE shell32)
else()
    target_link_libraries(${PROJECT_NAME} PRIVATE dl)

    if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
        target_link_options(${PROJECT_NAME} PRIVATE -Wl,-z,defs)
    endif()

    if(APPLE)
        target_link_libraries(${PROJECT_NAME} PRIVATE
            "-framework CoreFoundation"
            "-framework Foundation"
        )
    endif()
endif()

if(STDC_BUILD_TESTS)
    enable_testing()

    add_subdirectory(tests)
endif()

if(STDC_INSTALL)
    set(_install_dir ${CMAKE_INSTALL_LIBDIR}/cmake/${STDC_INSTALL_NAME})

    stdc_add_install_package_rule(
        NAME ${STDC_INSTALL_NAME}
        VERSION ${PROJECT_VERSION}
        COMPATIBILITY SameMajorVersion
        INSTALL_DIR ${_install_dir}
        CONFIG_TEMPLATE ${CMAKE_CURRENT_LIST_DIR}/${STDC_INSTALL_NAME}Config.cmake.in
        NAMESPACE stdcorelib::
        EXPORT ${STDC_INSTALL_NAME}Targets
        WRITE_CONFIG_OPTIONS NO_CHECK_REQUIRED_COMPONENTS_MACRO
    )

    install(DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/cmake"
        DESTINATION ${_install_dir}
    )

    install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/include/
        DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
        FILES_MATCHING PATTERN "*.h"
    )

    # Under the project's own name, so that a prefix holding more than one project keeps them
    # apart.
    install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/LICENSE
        DESTINATION ${CMAKE_INSTALL_DATADIR}/${STDC_INSTALL_NAME}
    )
endif()

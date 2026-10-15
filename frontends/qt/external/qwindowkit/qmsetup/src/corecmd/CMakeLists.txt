project(qmcorecmd
    VERSION ${QMSETUP_VERSION}
    LANGUAGES CXX
)

set(RC_COPYRIGHT "Copyright 2023-present Stdware Collections")
set(RC_DESCRIPTION "QMSetup Core Utility Command")

# Two directories, and the rule between them is one line: utils/ is about the machine, and
# commands/ is about what this program does with it. main.cpp is the command line and nothing
# else. Only deploy differs per platform, and it is split the way utils already was.
set(_src
    main.cpp

    commands/commands.h
    commands/copy.cpp
    commands/rmdir.cpp
    commands/touch.cpp
    commands/configure.cpp
    commands/incsync.cpp
    commands/deploy_p.h
    commands/deploy.cpp

    utils/utils.h
    utils/utils.cpp
    utils/sha-256.h
    utils/sha-256.cpp
)

if(WIN32)
    list(APPEND _src utils/utils_win.cpp commands/deploy_win.cpp)
else()
    list(APPEND _src utils/utils_unix.cpp commands/deploy_unix.cpp)
endif()

add_executable(${PROJECT_NAME} ${_src})

# So that a file reaches another directory by naming it, as `utils/utils.h`.
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(${PROJECT_NAME} PRIVATE stdcorelib::stdcorelib)

# 17 and no higher. The block below is here for GCC 8, which has C++17 and nothing after it, and
# stdcorelib asks for 17 of everything that links it.
set_target_properties(${PROJECT_NAME} PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# Compat with gcc 8
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_LESS "9")
    target_link_libraries(${PROJECT_NAME} PRIVATE stdc++fs)
endif()

if(WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE shlwapi)
    target_compile_definitions(${PROJECT_NAME} PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

if(WIN32)
    qm_add_win_rc(${PROJECT_NAME}
        COPYRIGHT ${RC_COPYRIGHT}
        DESCRIPTION ${RC_DESCRIPTION}
    )

    # Make sure Windows UAC does not believe it is an installer
    qm_add_win_manifest(${PROJECT_NAME}
        DESCRIPTION ${RC_DESCRIPTION}
    )
endif()

target_compile_definitions(${PROJECT_NAME} PRIVATE TOOL_DESC="${RC_DESCRIPTION}, Version ${PROJECT_VERSION}")
target_compile_definitions(${PROJECT_NAME} PRIVATE TOOL_COPYRIGHT="${RC_COPYRIGHT}, checkout ${QMSETUP_HOMEPAGE_URL}")
target_compile_definitions(${PROJECT_NAME} PRIVATE TOOL_VERSION="${PROJECT_VERSION}")

set_target_properties(${PROJECT_NAME} PROPERTIES EXPORT_NAME corecmd)

install(TARGETS ${PROJECT_NAME}
    EXPORT ${QMSETUP_INSTALL_NAME}Targets
    RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}" OPTIONAL
    LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}" OPTIONAL
    ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}" OPTIONAL
)

# Check patchelf
if(NOT WIN32 AND NOT APPLE)
    execute_process(
        COMMAND patchelf --version
        OUTPUT_VARIABLE _patchelf_version_output
        ERROR_QUIET
        OUTPUT_STRIP_TRAILING_WHITESPACE
    )

    if(NOT "${_patchelf_version_output}" MATCHES "patchelf")
        message(WARNING "Patchelf not found, the deploy feature will not work.")
    else()
        string(REGEX REPLACE "patchelf (.+)" "\\1" _patchelf_version ${_patchelf_version_output})
        message(STATUS "Found patchelf, version ${_patchelf_version}")
    endif()
endif()
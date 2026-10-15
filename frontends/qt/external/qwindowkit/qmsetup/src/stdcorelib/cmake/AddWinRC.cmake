#[[
# Adds Windows version information to a target.
#
# stdc_add_win_rc(<target>
#     COPYRIGHT <copyright>
#     [DESCRIPTION <description>]
#     [PRODUCT_NAME <name>]
#     [VERSION <version>]
# )
#]]
function(stdc_add_win_rc _target)
    if(NOT WIN32)
        return()
    endif()

    if(NOT TARGET ${_target})
        message(FATAL_ERROR "stdc_add_win_rc: '${_target}' is not a target")
    endif()

    set(options)
    set(oneValueArgs DESCRIPTION COPYRIGHT PRODUCT_NAME VERSION)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(FUNC_UNPARSED_ARGUMENTS)
        message(FATAL_ERROR
            "stdc_add_win_rc: unknown arguments: ${FUNC_UNPARSED_ARGUMENTS}"
        )
    endif()

    if(NOT FUNC_COPYRIGHT)
        message(FATAL_ERROR "stdc_add_win_rc: COPYRIGHT is required")
    endif()

    if(NOT FUNC_DESCRIPTION)
        set(FUNC_DESCRIPTION "${PROJECT_DESCRIPTION}")
    endif()

    if(NOT FUNC_PRODUCT_NAME)
        set(FUNC_PRODUCT_NAME "${_target}")
    endif()

    if(NOT FUNC_VERSION)
        get_target_property(FUNC_VERSION ${_target} VERSION)

        if(NOT FUNC_VERSION)
            set(FUNC_VERSION "${PROJECT_VERSION}")
        endif()
    endif()

    if(NOT FUNC_VERSION)
        message(FATAL_ERROR "stdc_add_win_rc: VERSION is required when the target has no VERSION")
    endif()

    string(REPLACE "." ";" _version_parts "${FUNC_VERSION}")
    list(LENGTH _version_parts _version_parts_count)

    if(_version_parts_count GREATER 4)
        message(FATAL_ERROR "stdc_add_win_rc: VERSION has more than four components")
    endif()

    while(_version_parts_count LESS 4)
        list(APPEND _version_parts 0)
        math(EXPR _version_parts_count "${_version_parts_count} + 1")
    endwhile()

    list(GET _version_parts 0 _version_major)
    list(GET _version_parts 1 _version_minor)
    list(GET _version_parts 2 _version_patch)
    list(GET _version_parts 3 _version_tweak)

    set(_rc_content "#include <windows.h>

#ifndef VS_VERSION_INFO
#define VS_VERSION_INFO 1
#endif

#define _STRINGIFY(x) #x
#define STRINGIFY(x) _STRINGIFY(x)

VS_VERSION_INFO VERSIONINFO
    FILEVERSION    ${_version_major},${_version_minor},${_version_patch},${_version_tweak}
    PRODUCTVERSION ${_version_major},${_version_minor},${_version_patch},${_version_tweak}
{
    BLOCK \"StringFileInfo\"
    {
       // U.S. English - Windows, Multilingual
       BLOCK \"040904E4\"
       {
          VALUE \"FileDescription\", STRINGIFY(${FUNC_DESCRIPTION})
          VALUE \"FileVersion\", STRINGIFY(${FUNC_VERSION})
          VALUE \"ProductName\", STRINGIFY(${FUNC_PRODUCT_NAME})
          VALUE \"ProductVersion\", STRINGIFY(${FUNC_VERSION})
          VALUE \"LegalCopyright\", STRINGIFY(${FUNC_COPYRIGHT})
        }
    }
    BLOCK \"VarFileInfo\"
    {
        VALUE \"Translation\", 0x409, 1252 // 1252 = 0x04E4
    }
}")

    set(_rc_file "${CMAKE_CURRENT_BINARY_DIR}/${_target}_res.rc")
    file(WRITE "${_rc_file}" "${_rc_content}")
    target_sources(${_target} PRIVATE "${_rc_file}")
endfunction()

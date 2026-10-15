set(_STDC_DOXYGEN_COMMANDS_DIR "${CMAKE_CURRENT_LIST_DIR}/doxygen-commands")

#[[
# Adds a manually built <target>_docs target.
#
# stdc_add_doxygen_docs(<target>
#     [INSTALL]
#     [DESCRIPTION <description>]
#     [INPUT <paths>...]
#     [EXCLUDE_SYMBOLS <patterns>...]
#     [PREDEFINED <definitions>...]
# )
#]]
function(stdc_add_doxygen_docs _target)
    if(NOT TARGET ${_target})
        message(FATAL_ERROR "stdc_add_doxygen_docs: '${_target}' is not a target")
    endif()

    set(options INSTALL)
    set(oneValueArgs DESCRIPTION)
    set(multiValueArgs INPUT EXCLUDE_SYMBOLS PREDEFINED)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(FUNC_UNPARSED_ARGUMENTS)
        message(FATAL_ERROR
            "stdc_add_doxygen_docs: unknown arguments: ${FUNC_UNPARSED_ARGUMENTS}"
        )
    endif()

    if(NOT FUNC_DESCRIPTION)
        set(FUNC_DESCRIPTION "${_target}")
    endif()

    if(NOT FUNC_INPUT)
        set(FUNC_INPUT
            "${CMAKE_CURRENT_SOURCE_DIR}/include"
            "${CMAKE_CURRENT_SOURCE_DIR}/docs/doxygen"
        )
    endif()

    find_package(Doxygen REQUIRED)

    get_target_property(_doxy_version ${_target} VERSION)

    if(NOT _doxy_version)
        set(_doxy_version "${PROJECT_VERSION}")
    endif()

    string(TOUPPER "${_target}" _doxy_title)

    set(_doxy_inputs)

    foreach(_input IN LISTS FUNC_INPUT)
        get_filename_component(_input "${_input}" ABSOLUTE
            BASE_DIR "${CMAKE_CURRENT_SOURCE_DIR}"
        )
        list(APPEND _doxy_inputs "\"${_input}\"")
    endforeach()

    list(JOIN _doxy_inputs " " _doxy_inputs)
    list(JOIN FUNC_EXCLUDE_SYMBOLS " " _doxy_exclude_symbols)
    list(JOIN FUNC_PREDEFINED " " _doxy_predefined)

    # Laid out under out/ the way it will be laid out once installed, beside bin and lib, so
    # that installing it is a copy.
    set(_doxy_dir "${CMAKE_CURRENT_BINARY_DIR}/out/share/doc/${_target}")

    # doxygen-awesome-css, https://github.com/jothepro/doxygen-awesome-css, MIT.
    set(_doxy_awesome_tag "v2.4.2")
    set(_doxy_awesome_dir "${CMAKE_CURRENT_BINARY_DIR}/doxygen-awesome-css-${_doxy_awesome_tag}")
    set(_doxy_awesome_url
        "https://raw.githubusercontent.com/jothepro/doxygen-awesome-css/${_doxy_awesome_tag}"
    )

    foreach(_item
        "doxygen-awesome.css;5ec49e2dfd097f6b5384e3aae0476eab47748e311fc70e207925f8fcc37477b9"
        "doxygen-awesome-sidebar-only.css;dc7ddd235375b71ecb0af920faa6b925ee9445ac617f3bc962b0b0db97da7b4f"
        "LICENSE;e3da754c3f657cc78594fa2e8a3283665f78c743df2485fa9e498a8973051191"
    )
        list(GET _item 0 _name)
        list(GET _item 1 _hash)

        if(EXISTS "${_doxy_awesome_dir}/${_name}")
            continue()
        endif()

        message(STATUS "Fetching ${_name} from doxygen-awesome-css ${_doxy_awesome_tag}")
        file(DOWNLOAD "${_doxy_awesome_url}/${_name}" "${_doxy_awesome_dir}/${_name}"
            EXPECTED_HASH SHA256=${_hash}
            TLS_VERIFY ON
            STATUS _status
        )
        list(GET _status 0 _code)

        if(NOT _code EQUAL 0)
            list(GET _status 1 _reason)
            file(REMOVE "${_doxy_awesome_dir}/${_name}")
            message(FATAL_ERROR
                "Cannot fetch ${_name} for the documentation theme: ${_reason}"
            )
        endif()
    endforeach()

    set(_doxy_content "PROJECT_NAME           = ${_doxy_title}
PROJECT_NUMBER         = ${_doxy_version}
PROJECT_BRIEF          = \"${FUNC_DESCRIPTION}\"
OUTPUT_DIRECTORY       = \"${_doxy_dir}\"
HTML_OUTPUT            = html
GENERATE_LATEX         = NO

INPUT                  = ${_doxy_inputs}
RECURSIVE              = YES
STRIP_FROM_INC_PATH    = \"${CMAKE_CURRENT_SOURCE_DIR}/include\"
STRIP_FROM_PATH        = \"${CMAKE_CURRENT_SOURCE_DIR}\"

JAVADOC_AUTOBRIEF      = YES
EXTRACT_ALL            = YES
EXTRACT_STATIC         = YES
HIDE_UNDOC_MEMBERS     = NO
SORT_MEMBER_DOCS       = NO
EXCLUDE_SYMBOLS        = ${_doxy_exclude_symbols}

ENABLE_PREPROCESSING   = YES
MACRO_EXPANSION        = YES
EXPAND_ONLY_PREDEF     = YES
PREDEFINED             = ${_doxy_predefined}

WARN_IF_UNDOCUMENTED   = NO
WARN_AS_ERROR          = FAIL_ON_WARNINGS
HAVE_DOT               = NO

GENERATE_TREEVIEW      = YES
DISABLE_INDEX          = NO
FULL_SIDEBAR           = NO
HTML_COLORSTYLE        = LIGHT
HTML_EXTRA_STYLESHEET  = \"${_doxy_awesome_dir}/doxygen-awesome.css\" \"${_doxy_awesome_dir}/doxygen-awesome-sidebar-only.css\"

LAYOUT_FILE            = \"${CMAKE_CURRENT_BINARY_DIR}/DoxygenLayout.xml\"
")

    set(_doxy_file "${CMAKE_CURRENT_BINARY_DIR}/${_target}_Doxyfile")
    file(WRITE "${_doxy_file}" "${_doxy_content}")

    # Not part of ALL. Documentation is asked for by name, and Doxygen is slow enough that
    # nobody wants it on the path from an edit to a test run.
    add_custom_target(${_target}_docs
        COMMAND ${CMAKE_COMMAND} -E make_directory "${_doxy_dir}"
        COMMAND ${DOXYGEN_EXECUTABLE} -l "${CMAKE_CURRENT_BINARY_DIR}/DoxygenLayout.xml"
        COMMAND ${CMAKE_COMMAND} -DLAYOUT=${CMAKE_CURRENT_BINARY_DIR}/DoxygenLayout.xml
        -P "${_STDC_DOXYGEN_COMMANDS_DIR}/Layout.cmake"
        COMMAND ${DOXYGEN_EXECUTABLE} "${_doxy_file}"
        COMMAND ${CMAKE_COMMAND} -DNAVTREE=${_doxy_dir}/html/navtree.js
        -P "${_STDC_DOXYGEN_COMMANDS_DIR}/NavTree.cmake"
        WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
        COMMENT "Generating documentation into ${_doxy_dir}/html"
        VERBATIM
    )

    if(FUNC_INSTALL)
        include(GNUInstallDirs)
        install(DIRECTORY "${_doxy_dir}/" DESTINATION "${CMAKE_INSTALL_DOCDIR}" OPTIONAL)
    endif()
endfunction()

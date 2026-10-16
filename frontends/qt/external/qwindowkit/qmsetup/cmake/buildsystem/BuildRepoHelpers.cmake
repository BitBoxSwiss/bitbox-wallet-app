#[[
    BuildRepoHelpers.cmake

    Include this file to generate build APIs for your current project.

    ----------------------------------------------------------------------------------------------------
    
    Macros/Functions:
         <proj>_init_buildsystem
         <proj>_finish_buildsystem
         <proj>_add_application
         <proj>_add_plugin
         <proj>_add_library
         <proj>_add_executable
         <proj>_add_attached_files
         <proj>_sync_include
         <proj>_install
         <proj>_set_default_install_rpath
    
    Override <proj> with QM_BUILD_REPO_HELPERS_FUNCTION_PREFIX.
]] #

include_guard(DIRECTORY)

set(QM_BUILD_REPO_HELPERS_VERSION "1")

if(QM_BUILD_REPO_HELPERS_FUNCTION_PREFIX)
    set(_F ${QM_BUILD_REPO_HELPERS_FUNCTION_PREFIX})
else()
    set(_F ${PROJECT_NAME})
endif()

#[[
    Initialize BuildAPI global configuration.

    <proj>_init_buildsystem([prefix])

    Arguments:
        prefix: The prefix of the build API variables. If not specified, use ${PROJECT_NAME}.

    Argument variables:
        <proj>_MACOSX_BUNDLE_NAME: string, default: null

        <proj>_WINDOWS_APPLICATION: boolean, default: false
        <proj>_CONSOLE_APPLICATION: boolean, default: true
        <proj>_BUILD_SHARED: boolean, default: true
        <proj>_BUILD_STATIC: boolean, default: false
        <proj>_DEVEL: boolean, default: false
        <proj>_INCLUDE_DIR: string, default: null
        <proj>_INSTALL: boolean, default: false
        <proj>_INSTALL_NAME: string, default: ${PROJECT_NAME}
        <proj>_INSTALL_VERSION: string, default: ${PROJECT_VERSION}
        <proj>_INSTALL_NAMESPACE: string, default: ${<proj>_INSTALL_NAME}
        <proj>_INSTALL_CONFIG_TEMPLATE: string, default: ${<proj>_INSTALL_NAME}Config.cmake.in
        <proj>_INSTALL_PDB: boolean, default: false
        <proj>_INSTALL_DIR_USE_DEBUG_PREFIX: boolean, default: false
        <proj>_EXPORT: string, default: ${PROJECT_NAME}
        <proj>_BUILD_BASE_DIR: string, default: ${QMSETUP_BUILD_DIR}
        <proj>_INSTALL_BASE_DIR: string, default: .
        <proj>_CONFIG_HEADER_PATH: string, default: null
        <proj>_BUILD_INFO_HEADER_PATH: string, default: null
        <proj>_BUILD_INFO_HEADER_PREFIX: string, default: null
        <proj>_PRE_CONFIGURE_COMMANDS: list, default: null
        <proj>_POST_CONFIGURE_COMMANDS: list, default: null
        <proj>_SYNC_INCLUDE_COMMANDS: list, default: null

    Generated variables:
        <proj>_PROJECT_NAME: string
        <proj>_PROJECT_NAME_UPPER: string
        <proj>_PROJECT_SOURCE_DIR: string

        <proj>_BUILD_TEST_RUNTIME_DIR: string
        <proj>_BUILD_TEST_LIBRARY_DIR: string
        <proj>_BUILD_RUNTIME_DIR: string
        <proj>_BUILD_LIBRARY_DIR: string
        <proj>_BUILD_PLUGINS_DIR: string
        <proj>_BUILD_DATA_DIR: string
        <proj>_BUILD_SHARE_DIR: string
        <proj>_BUILD_DOC_DIR: string
        <proj>_BUILD_QML_DIR: string
        <proj>_BUILD_INCLUDE_DIR: string

        <proj>_INSTALL_RUNTIME_DIR: string
        <proj>_INSTALL_LIBRARY_DIR: string
        <proj>_INSTALL_PLUGINS_DIR: string
        <proj>_INSTALL_SHARE_DIR: string
        <proj>_INSTALL_DATA_DIR: string
        <proj>_INSTALL_DOC_DIR: string
        <proj>_INSTALL_QML_DIR: string
        <proj>_INSTALL_INCLUDE_DIR: string
        <proj>_INSTALL_CMAKE_DIR: string
]] #
macro(${_F}_init_buildsystem)
    qm_import(Filesystem Preprocess)

    # Set variable prefix
    set(_prefix ${ARGV0})

    if(_prefix)
        set(_V ${_prefix})
    else()
        string(TOUPPER ${_F} _V)
    endif()

    # Set source directory
    set(${_V}_PROJECT_NAME ${PROJECT_NAME})
    string(TOUPPER ${PROJECT_NAME} ${_V}_PROJECT_NAME_UPPER)
    set(${_V}_PROJECT_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR})

    # Whether to build Windows/Console application
    if(${_V}_WINDOWS_APPLICATION AND NOT ${_V}_CONSOLE_APPLICATION)
        set(${_V}_WINDOWS_APPLICATION on)
        set(${_V}_CONSOLE_APPLICATION off)
    else()
        set(${_V}_WINDOWS_APPLICATION off)
        set(${_V}_CONSOLE_APPLICATION on)
    endif()

    # Whether to build shared libraries
    if(${_V}_BUILD_SHARED)
        set(${_V}_BUILD_SHARED on)
        set(${_V}_BUILD_STATIC off)
    elseif(${_V}_BUILD_STATIC)
        set(${_V}_BUILD_SHARED off)
        set(${_V}_BUILD_STATIC on)
    else()
        # Fallback to default behavior
        if(BUILD_SHARED_LIBS)
            set(${_V}_BUILD_SHARED on)
            set(${_V}_BUILD_STATIC off)
        else()
            set(${_V}_BUILD_SHARED off)
            set(${_V}_BUILD_STATIC on)
        endif()
    endif()

    # Set include directory
    if(${_V}_INCLUDE_DIR)
        get_filename_component(${_V}_INCLUDE_DIR ${${_V}_INCLUDE_DIR} ABSOLUTE)
    endif()

    # Whether to install
    if(${_V}_INSTALL)
        include(GNUInstallDirs)
        include(CMakePackageConfigHelpers)
    endif()

    # Set install name, version and namespace
    _repo_set_option(${_V}_INSTALL_NAME ${PROJECT_NAME})
    _repo_set_option(${_V}_INSTALL_VERSION ${PROJECT_VERSION})
    _repo_set_option(${_V}_INSTALL_NAMESPACE ${${_V}_INSTALL_NAME})

    # Set install config template
    _repo_set_option(${_V}_INSTALL_CONFIG_TEMPLATE ${CMAKE_CURRENT_LIST_DIR}/${${_V}_INSTALL_NAME}Config.cmake.in)

    # Export targets
    _repo_set_option(${_V}_EXPORT ${${_V}_INSTALL_NAME}Targets)

    # Set output directories
    _repo_set_option(${_V}_BUILD_BASE_DIR ${QMSETUP_BUILD_DIR})
    _repo_set_option(${_V}_INSTALL_BASE_DIR .)

    if(APPLE AND ${_V}_MACOSX_BUNDLE_NAME)
        set(_BUILD_BASE_DIR ${${_V}_BUILD_BASE_DIR}/${${_V}_MACOSX_BUNDLE_NAME}.app/Contents)

        _repo_set_option(${_V}_BUILD_TEST_RUNTIME_DIR ${${_V}_BUILD_BASE_DIR}/bin)
        _repo_set_option(${_V}_BUILD_TEST_LIBRARY_DIR ${${_V}_BUILD_BASE_DIR}/lib)

        _repo_set_option(${_V}_BUILD_RUNTIME_DIR ${_BUILD_BASE_DIR}/MacOS)
        _repo_set_option(${_V}_BUILD_LIBRARY_DIR ${_BUILD_BASE_DIR}/Frameworks)
        _repo_set_option(${_V}_BUILD_PLUGINS_DIR ${_BUILD_BASE_DIR}/Plugins)
        _repo_set_option(${_V}_BUILD_SHARE_DIR ${_BUILD_BASE_DIR}/Resources)
        _repo_set_option(${_V}_BUILD_DATA_DIR ${_BUILD_BASE_DIR}/Resources)
        _repo_set_option(${_V}_BUILD_DOC_DIR ${_BUILD_BASE_DIR}/Resources/doc)
        _repo_set_option(${_V}_BUILD_QML_DIR ${_BUILD_BASE_DIR}/Resources/qml)
        _repo_set_option(${_V}_BUILD_INCLUDE_DIR ${_BUILD_BASE_DIR}/Resources/include)

        set(_INSTALL_BASE_DIR ${${_V}_INSTALL_BASE_DIR}/${${_V}_MACOSX_BUNDLE_NAME}.app/Contents)
        _repo_set_option(${_V}_INSTALL_RUNTIME_DIR ${_INSTALL_BASE_DIR}/MacOS)
        _repo_set_option(${_V}_INSTALL_LIBRARY_DIR ${_INSTALL_BASE_DIR}/Frameworks)
        _repo_set_option(${_V}_INSTALL_PLUGINS_DIR ${_INSTALL_BASE_DIR}/Plugins)
        _repo_set_option(${_V}_INSTALL_SHARE_DIR ${_INSTALL_BASE_DIR}/Resources)
        _repo_set_option(${_V}_INSTALL_DATA_DIR ${_INSTALL_BASE_DIR}/Resources)
        _repo_set_option(${_V}_INSTALL_DOC_DIR ${_INSTALL_BASE_DIR}/Resources/doc)
        _repo_set_option(${_V}_INSTALL_QML_DIR ${_INSTALL_BASE_DIR}/Resources/qml)
        _repo_set_option(${_V}_INSTALL_INCLUDE_DIR ${_INSTALL_BASE_DIR}/Resources/include)
        _repo_set_option(${_V}_INSTALL_CMAKE_DIR ${_INSTALL_BASE_DIR}/Resources/lib/cmake/${${_V}_INSTALL_NAME})
    else()
        set(_BUILD_BASE_DIR ${${_V}_BUILD_BASE_DIR})

        _repo_set_option(${_V}_BUILD_TEST_RUNTIME_DIR ${_BUILD_BASE_DIR}/bin)
        _repo_set_option(${_V}_BUILD_TEST_LIBRARY_DIR ${_BUILD_BASE_DIR}/lib)

        _repo_set_option(${_V}_BUILD_RUNTIME_DIR ${_BUILD_BASE_DIR}/bin)
        _repo_set_option(${_V}_BUILD_LIBRARY_DIR ${_BUILD_BASE_DIR}/lib)
        _repo_set_option(${_V}_BUILD_PLUGINS_DIR ${_BUILD_BASE_DIR}/lib/${${_V}_INSTALL_NAME}/plugins)
        _repo_set_option(${_V}_BUILD_SHARE_DIR ${_BUILD_BASE_DIR}/share)
        _repo_set_option(${_V}_BUILD_DATA_DIR ${_BUILD_BASE_DIR}/share/${${_V}_INSTALL_NAME})
        _repo_set_option(${_V}_BUILD_DOC_DIR ${_BUILD_BASE_DIR}/share/doc/${${_V}_INSTALL_NAME})
        _repo_set_option(${_V}_BUILD_QML_DIR ${_BUILD_BASE_DIR}/qml)
        _repo_set_option(${_V}_BUILD_INCLUDE_DIR ${_BUILD_BASE_DIR}/include)

        set(_INSTALL_BASE_DIR ${${_V}_INSTALL_BASE_DIR})

        if(${_V}_INSTALL_DIR_USE_DEBUG_PREFIX)
            set(_INSTALL_BINARY_BASE_DIR ${_INSTALL_BASE_DIR}/debug)
        else()
            set(_INSTALL_BINARY_BASE_DIR ${_INSTALL_BASE_DIR})
        endif()

        _repo_set_option(${_V}_INSTALL_RUNTIME_DIR ${_INSTALL_BINARY_BASE_DIR}/bin)
        _repo_set_option(${_V}_INSTALL_LIBRARY_DIR ${_INSTALL_BINARY_BASE_DIR}/lib)
        _repo_set_option(${_V}_INSTALL_PLUGINS_DIR ${_INSTALL_BINARY_BASE_DIR}/lib/${${_V}_INSTALL_NAME}/plugins)
        _repo_set_option(${_V}_INSTALL_SHARE_DIR ${_INSTALL_BASE_DIR}/share)
        _repo_set_option(${_V}_INSTALL_DATA_DIR ${_INSTALL_BASE_DIR}/share/${${_V}_INSTALL_NAME})
        _repo_set_option(${_V}_INSTALL_DOC_DIR ${_INSTALL_BASE_DIR}/share/doc/${${_V}_INSTALL_NAME})
        _repo_set_option(${_V}_INSTALL_QML_DIR ${_INSTALL_BASE_DIR}/qml)
        _repo_set_option(${_V}_INSTALL_INCLUDE_DIR ${_INSTALL_BASE_DIR}/include)
        _repo_set_option(${_V}_INSTALL_CMAKE_DIR ${_INSTALL_BASE_DIR}/lib/cmake/${${_V}_INSTALL_NAME})
    endif()

    _repo_normalize_path(${_V}_INSTALL_RUNTIME_DIR)
    _repo_normalize_path(${_V}_INSTALL_LIBRARY_DIR)
    _repo_normalize_path(${_V}_INSTALL_PLUGINS_DIR)
    _repo_normalize_path(${_V}_INSTALL_SHARE_DIR)
    _repo_normalize_path(${_V}_INSTALL_DATA_DIR)
    _repo_normalize_path(${_V}_INSTALL_DOC_DIR)
    _repo_normalize_path(${_V}_INSTALL_QML_DIR)
    _repo_normalize_path(${_V}_INSTALL_INCLUDE_DIR)
    _repo_normalize_path(${_V}_INSTALL_CMAKE_DIR)

    if(${_V}_CONFIG_HEADER_PATH)
        # Set definition configuration
        set(QMSETUP_DEFINITION_SCOPE DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    endif()

    if(${_V}_BUILD_INFO_HEADER_PATH)
        _repo_set_option(${_V}_BUILD_INFO_HEADER_PREFIX ${${_V}_PROJECT_NAME_UPPER})
    endif()
endmacro()

#[[
    Finish BuildAPI global configuration.

    <proj>_finish_buildsystem()
#]]
macro(${_F}_finish_buildsystem)
    if(${_V}_CONFIG_HEADER_PATH)
        set(_config_file ${${_V}_BUILD_INCLUDE_DIR}/${${_V}_CONFIG_HEADER_PATH})
        qm_generate_config(${_config_file} PROJECT_NAME ${${_V}_PROJECT_NAME_UPPER})

        if(${_V}_INSTALL AND ${_V}_DEVEL)
            if(EXISTS ${_config_file})
                get_filename_component(_dest ${${_V}_INSTALL_INCLUDE_DIR}/${${_V}_CONFIG_HEADER_PATH} DIRECTORY)
                install(FILES ${_config_file} DESTINATION ${_dest})
            endif()
        endif()
    endif()

    if(${_V}_BUILD_INFO_HEADER_PATH)
        set(_build_info_file ${${_V}_BUILD_INCLUDE_DIR}/${${_V}_BUILD_INFO_HEADER_PATH})
        qm_generate_build_info(${_build_info_file}
            YEAR TIME PREFIX ${${_V}_BUILD_INFO_HEADER_PREFIX}
            PROJECT_NAME ${${_V}_PROJECT_NAME_UPPER}
        )

        if(${_V}_INSTALL AND ${_V}_DEVEL)
            if(EXISTS ${_build_info_file})
                get_filename_component(_dest ${${_V}_INSTALL_INCLUDE_DIR}/${${_V}_BUILD_INFO_HEADER_PATH} DIRECTORY)
                install(FILES ${_build_info_file} DESTINATION ${_dest})
            endif()
        endif()
    endif()
endmacro()

#[[
    Add application target.

    <proj>_add_application(<target>
        [QT_AUTOGEN]
        [NO_EXPORT]
        [NO_INSTALL]
        [NO_INSTALL_PDB]
        [RUNTIME_DIRECTORY <dir>]
        [PDB_DIRECTORY <dir>]
    )
]] #
function(${_F}_add_application _target)
    set(options NO_EXPORT NO_INSTALL NO_INSTALL_PDB)
    set(oneValueArgs RUNTIME_DIRECTORY PDB_DIRECTORY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_extra_args)
    _repo_add_executable_internal(${_target} Application _extra_args ${FUNC_UNPARSED_ARGUMENTS})

    if(_extra_args)
        cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN} ${_extra_args})
    endif()

    # Set target properties and build output directories
    if(APPLE AND ${_V}_MACOSX_BUNDLE_NAME)
        set(_build_runtime_dir ${${_V}_BUILD_BASE_DIR})
        set(_install_runtime_dir ${${_V}_INSTALL_BASE_DIR})
    else()
        if(WIN32)
            if(NOT ${_V}_CONSOLE_APPLICATION)
                set_target_properties(${_target} PROPERTIES
                    WIN32_EXECUTABLE TRUE
                )
            endif()
        endif()

        set(_build_runtime_dir ${${_V}_BUILD_RUNTIME_DIR})
        set(_install_runtime_dir ${${_V}_INSTALL_RUNTIME_DIR})
    endif()

    set(_install_pdb_dir ${${_V}_INSTALL_RUNTIME_DIR})
    _repo_add_target_generate_output_dirs(EXECUTABLE)

    set_target_properties(${_target} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${_build_runtime_dir}
    )

    # Install target
    if(NOT FUNC_NO_INSTALL AND ${_V}_INSTALL)
        if(FUNC_NO_EXPORT OR NOT ${_V}_DEVEL)
            set(_export)
        else()
            set(_export EXPORT ${${_V}_EXPORT})
        endif()

        install(TARGETS ${_target}
            ${_export}
            DESTINATION ${_install_runtime_dir} OPTIONAL
            PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
        )

        if(NOT FUNC_NO_INSTALL_PDB AND ${_V}_INSTALL_PDB)
            _repo_install_pdb(${_target} ${_install_pdb_dir})
        endif()
    endif()

    _repo_post_configure_target_internal(${_target})
endfunction()

#[[
    Add an application plugin.

    <proj>_add_plugin(<target>
        [CATEGORY category]
        [QT_AUTOGEN]
        [NO_EXPORT]
        [NO_INSTALL]
        [NO_INSTALL_ARCHIVE]
        [NO_INSTALL_PDB]
        [RUNTIME_DIRECTORY <dir>]
        [LIBRARY_DIRECTORY <dir>]
        [ARCHIVE_DIRECTORY <dir>]
        [PDB_DIRECTORY <dir>]
    )
]] #
function(${_F}_add_plugin _target)
    set(options NO_EXPORT NO_INSTALL NO_INSTALL_ARCHIVE NO_INSTALL_PDB)
    set(oneValueArgs CATEGORY RUNTIME_DIRECTORY LIBRARY_DIRECTORY ARCHIVE_DIRECTORY PDB_DIRECTORY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_extra_args)
    _repo_add_library_internal(${_target} Plugin _extra_args SHARED ${FUNC_UNPARSED_ARGUMENTS})

    if(_extra_args)
        cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN} ${_extra_args})
    endif()

    if(NOT FUNC_CATEGORY)
        set(_category ${_target})
    else()
        set(_category ${FUNC_CATEGORY})
    endif()

    # Kept, because the rpath a plugin is given has to count the directories
    # between it and the prefix, and a category may be more than one of them.
    set_target_properties(${_target} PROPERTIES ${_V}_PLUGIN_CATEGORY "${_category}")

    set(_build_output_dir ${${_V}_BUILD_PLUGINS_DIR}/${_category})
    set(_install_output_dir ${${_V}_INSTALL_PLUGINS_DIR}/${_category})

    set(_build_runtime_dir ${_build_output_dir})
    set(_build_library_dir ${_build_output_dir})
    set(_build_archive_dir ${_build_output_dir})
    set(_install_runtime_dir ${_install_output_dir})
    set(_install_library_dir ${_install_output_dir})
    set(_install_archive_dir ${_install_output_dir})
    set(_install_pdb_dir ${_install_output_dir})
    _repo_add_target_generate_output_dirs(SHARED_LIBRARY)

    # Set output directories
    set_target_properties(${_target} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${_build_runtime_dir}
        LIBRARY_OUTPUT_DIRECTORY ${_build_library_dir}
        ARCHIVE_OUTPUT_DIRECTORY ${_build_archive_dir}
    )

    # Install target
    if(NOT FUNC_NO_INSTALL AND ${_V}_INSTALL)
        if(FUNC_NO_EXPORT OR NOT ${_V}_DEVEL)
            set(_export)
        else()
            set(_export EXPORT ${${_V}_EXPORT})
        endif()

        if(${_V}_DEVEL AND NOT FUNC_NO_INSTALL_ARCHIVE)
            install(TARGETS ${_target}
                ${_export}
                RUNTIME DESTINATION ${_install_runtime_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                LIBRARY DESTINATION ${_install_library_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                ARCHIVE DESTINATION ${_install_archive_dir}
            )
        else()
            install(TARGETS ${_target}
                ${_export}
                RUNTIME DESTINATION ${_install_runtime_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                LIBRARY DESTINATION ${_install_library_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
            )
        endif()

        if(NOT FUNC_NO_INSTALL_PDB AND ${_V}_INSTALL_PDB)
            _repo_install_pdb(${_target} ${_install_pdb_dir})
        endif()
    endif()

    _repo_post_configure_target_internal(${_target})
endfunction()

#[[
    Add a library, default to static library.

    <proj>_add_library(<target>
        [STATIC | SHARED | INTERFACE]
        [MACRO_PREFIX <prefix>] [LIBRARY_MACRO <macro>] [STATIC_MACRO <macro>]
        [TEST]
        [QT_AUTOGEN]
        [NO_EXPORT]
        [NO_INSTALL]
        [NO_INSTALL_PDB]
        [RUNTIME_DIRECTORY <dir>]
        [LIBRARY_DIRECTORY <dir>]
        [ARCHIVE_DIRECTORY <dir>]
        [PDB_DIRECTORY <dir>]
    )
]] #
function(${_F}_add_library _target)
    set(options TEST NO_EXPORT NO_INSTALL NO_INSTALL_PDB)
    set(oneValueArgs RUNTIME_DIRECTORY LIBRARY_DIRECTORY ARCHIVE_DIRECTORY PDB_DIRECTORY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_extra_args)
    _repo_add_library_internal(${_target} Library _extra_args ${FUNC_UNPARSED_ARGUMENTS})

    if(_extra_args)
        cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN} ${_extra_args})
    endif()

    get_target_property(_type ${_target} TYPE)

    # Set output directories
    if(FUNC_TEST)
        set(_build_runtime_dir ${${_V}_BUILD_TEST_RUNTIME_DIR})
        set(_build_library_dir ${${_V}_BUILD_TEST_LIBRARY_DIR})
        set(_build_archive_dir ${${_V}_BUILD_TEST_LIBRARY_DIR})
    else()
        set(_build_runtime_dir ${${_V}_BUILD_RUNTIME_DIR})
        set(_build_library_dir ${${_V}_BUILD_LIBRARY_DIR})
        set(_build_archive_dir ${${_V}_BUILD_LIBRARY_DIR})
    endif()

    set(_install_runtime_dir ${${_V}_INSTALL_RUNTIME_DIR})
    set(_install_library_dir ${${_V}_INSTALL_LIBRARY_DIR})
    set(_install_archive_dir ${${_V}_INSTALL_LIBRARY_DIR})

    if(WIN32)
        set(_install_pdb_dir ${${_V}_INSTALL_RUNTIME_DIR})
    else()
        set(_install_pdb_dir ${${_V}_INSTALL_LIBRARY_DIR})
    endif()

    _repo_add_target_generate_output_dirs(${_type})

    set_target_properties(${_target} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${_build_runtime_dir}
        LIBRARY_OUTPUT_DIRECTORY ${_build_library_dir}
        ARCHIVE_OUTPUT_DIRECTORY ${_build_archive_dir}
    )

    # Install target
    if(NOT FUNC_TEST AND NOT FUNC_NO_INSTALL AND ${_V}_INSTALL)
        if(FUNC_NO_EXPORT OR NOT ${_V}_DEVEL)
            set(_export)
        else()
            set(_export EXPORT ${${_V}_EXPORT})
        endif()

        if(${_V}_DEVEL)
            install(TARGETS ${_target}
                ${_export}
                RUNTIME DESTINATION ${_install_runtime_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                LIBRARY DESTINATION ${_install_library_dir}
                PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                ARCHIVE DESTINATION ${_install_archive_dir}
            )
        else()
            if(_type STREQUAL "SHARED_LIBRARY")
                install(TARGETS ${_target}
                    ${_export}
                    RUNTIME DESTINATION ${_install_runtime_dir}
                    PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                    LIBRARY DESTINATION ${_install_library_dir}
                    PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ WORLD_EXECUTE WORLD_READ
                )
            endif()
        endif()

        if(NOT FUNC_NO_INSTALL_PDB AND ${_V}_INSTALL_PDB)
            _repo_install_pdb(${_target} ${_install_pdb_dir})
        endif()
    endif()

    _repo_post_configure_target_internal(${_target})
endfunction()

#[[
    Add executable target.

    <proj>_add_executable(<target>
        [TEST]
        [QT_AUTOGEN]
        [CONSOLE] [WINDOWS]
        [NO_EXPORT]
        [NO_INSTALL]
        [NO_INSTALL_PDB]
        [RUNTIME_DIRECTORY <dir>]
        [PDB_DIRECTORY <dir>]
    )
]] #
function(${_F}_add_executable _target)
    set(options TEST CONSOLE WINDOWS NO_EXPORT NO_INSTALL NO_INSTALL_PDB)
    set(oneValueArgs RUNTIME_DIRECTORY PDB_DIRECTORY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_extra_args)
    _repo_add_executable_internal(${_target} Executable _extra_args ${FUNC_UNPARSED_ARGUMENTS})

    if(_extra_args)
        cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN} ${_extra_args})
    endif()

    if(WIN32 AND NOT FUNC_CONSOLE)
        if(FUNC_WINDOWS OR ${_V}_WINDOWS_APPLICATION)
            set_target_properties(${_target} PROPERTIES WIN32_EXECUTABLE TRUE)
        endif()
    endif()

    if(FUNC_TEST)
        set(_build_runtime_dir ${${_V}_BUILD_TEST_RUNTIME_DIR})
    else()
        set(_build_runtime_dir ${${_V}_BUILD_RUNTIME_DIR})
    endif()

    set(_install_runtime_dir ${${_V}_INSTALL_RUNTIME_DIR})
    set(_install_pdb_dir ${${_V}_INSTALL_RUNTIME_DIR})
    _repo_add_target_generate_output_dirs(EXECUTABLE)

    set_target_properties(${_target} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${_build_runtime_dir}
    )

    # Install target
    if(NOT FUNC_TEST AND NOT FUNC_NO_INSTALL AND ${_V}_INSTALL)
        if(FUNC_NO_EXPORT OR NOT ${_V}_DEVEL)
            set(_export)
        else()
            set(_export EXPORT ${${_V}_EXPORT})
        endif()

        install(TARGETS ${_target}
            ${_export}
            DESTINATION ${_install_runtime_dir} OPTIONAL
        )

        if(NOT FUNC_NO_INSTALL_PDB AND ${_V}_INSTALL_PDB)
            _repo_install_pdb(${_target} ${_install_pdb_dir})
        endif()
    endif()

    _repo_post_configure_target_internal(${_target})
endfunction()

#[[
    Add a resources copying command after building a given target.

    <proj>_add_attached_files(<target>
        [NO_BUILD] [NO_INSTALL] [VERBOSE]

        SRC <files1...> DEST <dir1>
        SRC <files2...> DEST <dir2> ...
    )
    
    SRC: source files or directories, use "*" to collect all items in directory
    DEST: destination directory, can be a generator expression
]] #
function(${_F}_add_attached_files _target)
    set(options NO_BUILD NO_INSTALL VERBOSE)
    set(oneValueArgs)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_error)
    set(_result)
    _repo_parse_copy_args("${FUNC_UNPARSED_ARGUMENTS}" _result _error)

    if(_error)
        message(FATAL_ERROR "${_F}_add_attached_files: ${_error}")
    endif()

    set(_options)

    if(FUNC_NO_BUILD)
        list(APPEND _options SKIP_BUILD)
    endif()

    if(FUNC_NO_INSTALL OR NOT ${_V}_INSTALL)
        list(APPEND _options SKIP_INSTALL)
    else()
        list(APPEND _options INSTALL_DIR .)
    endif()

    if(FUNC_VERBOSE)
        list(APPEND _options VERBOSE)
    endif()

    foreach(_src IN LISTS _result)
        list(POP_BACK _src _dest)

        qm_add_copy_command(${_target}
            SOURCES ${_src}
            DESTINATION ${_dest}
            ${_options}
        )
    endforeach()
endfunction()

#[[
    Sync include files for library or plugin target.

    <proj>_sync_include(<target>
        [DIRECTORY <dir>]
        [PREFIX <prefix>]
        [OPTIONS <options...>]
        [NO_INSTALL]
    )
]] #
function(${_F}_sync_include _target)
    set(options NO_INSTALL)
    set(oneValueArgs DIRECTORY PREFIX)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_extra_args)

    if(${_V}_SYNC_INCLUDE_COMMANDS)
        foreach(_cmd IN LISTS ${_V}_SYNC_INCLUDE_COMMANDS)
            cmake_language(CALL ${_cmd} ${_target} _extra_args)
        endforeach()
    endif()

    if(_extra_args)
        cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN} ${_extra_args})
    endif()

    set(_inc_name)
    qm_set_value(_inc_name FUNC_PREFIX ${_target})

    set(_dir)
    qm_set_value(_dir FUNC_DIRECTORY .)

    set(_sync_options)

    if(${_V}_INSTALL AND ${_V}_DEVEL AND NOT FUNC_NO_INSTALL)
        set(_sync_options
            INSTALL_DIR "${${_V}_INSTALL_INCLUDE_DIR}/${_inc_name}"
        )
    endif()

    # Generate a standard include directory in build directory
    qm_sync_include(${_dir} "${${_V}_BUILD_INCLUDE_DIR}/${_inc_name}" ${_sync_options}
        ${FUNC_UNPARSED_ARGUMENTS}
    )
endfunction()

#[[
    Install targets, CMake configuration files and include files.

    <proj>_install(
        [NO_EXPORT]
        [NO_INCLUDE]
    )
]] #
function(${_F}_install)
    set(options NO_EXPORT NO_INCLUDE)
    set(oneValueArgs)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(${_V}_INSTALL AND ${_V}_DEVEL)
        if(NOT FUNC_NO_EXPORT)
            qm_basic_install(
                NAME ${${_V}_INSTALL_NAME}
                VERSION ${${_V}_INSTALL_VERSION}
                INSTALL_DIR ${${_V}_INSTALL_CMAKE_DIR}
                CONFIG_TEMPLATE ${${_V}_INSTALL_CONFIG_TEMPLATE}
                NAMESPACE ${${_V}_INSTALL_NAMESPACE}::
                EXPORT ${${_V}_EXPORT}
                WRITE_CONFIG_OPTIONS NO_CHECK_REQUIRED_COMPONENTS_MACRO
            )
        endif()

        if(NOT FUNC_NO_INCLUDE AND ${_V}_INCLUDE_DIR)
            install(DIRECTORY ${${_V}_INCLUDE_DIR}/
                DESTINATION ${${_V}_INSTALL_INCLUDE_DIR}
                FILES_MATCHING PATTERN "*.h" PATTERN "*.hpp" PATTERN "*.hxx" PATTERN "*.inc"
            )
        endif()
    endif()
endfunction()

#[[
    Set default install rpath for a target.

    <proj>_set_default_install_rpath(<target>)
]] #
function(${_F}_set_default_install_rpath _target)
    get_target_property(_type ${_target} ${_V}_TARGET_TYPE)

    if(APPLE)
        if(${_V}_MACOSX_BUNDLE_NAME)
            set_target_properties(${_target} PROPERTIES
                INSTALL_RPATH "@executable_path/../Frameworks;@loader_path"
            )
        else()
            set_target_properties(${_target} PROPERTIES
                INSTALL_RPATH "@executable_path/../lib;@loader_path"
            )
        endif()
    else()
        if(_type STREQUAL "Plugin")
            # <proj>_add_plugin() always appends a category, falling back to the target name when
            # CATEGORY is omitted, so a plugin lands in
            # <prefix>/<install-plugins-dir>/<category>:
            #
            # <prefix>/lib/<name>/plugins/<category>/libfoo.so
            # ^4    ^3      ^2       ^1
            #
            # Three of those are fixed and the category is not. It is a path rather than a name,
            # so `CATEGORY a/b` is two directories and the count is one more, which is why it is
            # read off the target rather than written down here.
            get_target_property(_category ${_target} ${_V}_PLUGIN_CATEGORY)

            if(NOT _category)
                set(_category ".")
            endif()

            string(REGEX REPLACE "/+$" "" _category "${_category}")
            string(REPLACE "/" ";" _category_parts "${_category}")
            list(LENGTH _category_parts _category_depth)

            math(EXPR _levels "3 + ${_category_depth}")
            set(_up)

            foreach(_i RANGE 1 ${_levels})
                string(APPEND _up "../")
            endforeach()

            set_target_properties(${_target} PROPERTIES
                INSTALL_RPATH "\$ORIGIN:\$ORIGIN/${_up}lib"
            )
        else()
            set_target_properties(${_target} PROPERTIES
                INSTALL_RPATH "\$ORIGIN:\$ORIGIN/../lib"
            )
        endif()
    endif()
endfunction()

# ----------------------------------
# BuildAPI Internal Functions
# ----------------------------------
macro(_repo_set_option _key _val)
    if(NOT ${_key})
        set(${_key} ${_val})
    endif()
endmacro()

macro(_repo_normalize_path _path)
    if(${_path} MATCHES "^./(.+)")
        set(${_path} ${CMAKE_MATCH_1})
    endif()
endmacro()

macro(_repo_set_cmake_qt_autogen _target)
    set_target_properties(${_target} PROPERTIES
        AUTOMOC TRUE
        AUTOUIC TRUE
        AUTORCC TRUE
    )
endmacro()

macro(_repo_install_pdb _target _dest)
    get_target_property(_type ${_target} TYPE)

    if(_type MATCHES "EXECUTABLE|SHARED_LIBRARY")
        if(MSVC)
            install(FILES $<TARGET_PDB_FILE:${_target}>
                DESTINATION ${_dest} OPTIONAL
            )
        elseif(APPLE)
            if(CMAKE_DSYMUTIL)
                set(_dsymutil "${CMAKE_DSYMUTIL}")
            else()
                find_program(_dsymutil dsymutil)
            endif()

            if(NOT _dsymutil OR NOT CMAKE_STRIP)
                message(FATAL_ERROR "_repo_install_pdb: dsymutil and strip are required on macOS")
            endif()

            install(CODE "
                set(_source \"$<TARGET_FILE:${_target}>\")
                set(_bin \"${_dest}/$<TARGET_FILE_NAME:${_target}>\")
                set(_pdb \"${_dest}/$<TARGET_FILE_NAME:${_target}>.dSYM\")
                execute_process(
                    COMMAND \"${_dsymutil}\" \"\${_source}\" -o \"\${_pdb}\"
                    WORKING_DIRECTORY \"\${CMAKE_INSTALL_PREFIX}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"dsymutil failed for \${_source}: \${_error}\")
                endif()
                execute_process(
                    COMMAND \"${CMAKE_STRIP}\" -S \"\${_bin}\"
                    WORKING_DIRECTORY \"\${CMAKE_INSTALL_PREFIX}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"strip failed for \${_bin}: \${_error}\")
                endif()
            ")
        else()
            install(CODE "
                set(_bin \"${_dest}/$<TARGET_FILE_NAME:${_target}>\")
                set(_pdb \"${_dest}/$<TARGET_FILE_NAME:${_target}>.debug\")
                execute_process(
                    COMMAND \"${CMAKE_OBJCOPY}\" --only-keep-debug \${_bin} \${_pdb}
                    WORKING_DIRECTORY \"\${CMAKE_INSTALL_PREFIX}\"
                )
                execute_process(
                    COMMAND \"${CMAKE_STRIP}\" --strip-debug \${_bin}
                    WORKING_DIRECTORY \"\${CMAKE_INSTALL_PREFIX}\"
                )
                execute_process(
                    COMMAND \"${CMAKE_OBJCOPY}\" --add-gnu-debuglink \${_pdb} \${_bin}
                    WORKING_DIRECTORY \"\${CMAKE_INSTALL_PREFIX}\"
                )
            ")
        endif()
    endif()
endmacro()

macro(_repo_add_target_generate_output_dirs _type)
    if(FUNC_RUNTIME_DIRECTORY)
        string(GENEX_STRIP ${FUNC_RUNTIME_DIRECTORY} _stripped_dir)

        if(NOT _stripped_dir STREQUAL FUNC_RUNTIME_DIRECTORY)
            set(_build_runtime_dir ${FUNC_RUNTIME_DIRECTORY})
            set(_install_runtime_dir ${FUNC_RUNTIME_DIRECTORY})
        else()
            set(_build_runtime_dir ${_build_runtime_dir}/${FUNC_RUNTIME_DIRECTORY})
            set(_install_runtime_dir ${_install_runtime_dir}/${FUNC_RUNTIME_DIRECTORY})
        endif()
    endif()

    if(NOT _type MATCHES "EXECUTABLE")
        if(FUNC_LIBRARY_DIRECTORY)
            string(GENEX_STRIP ${FUNC_LIBRARY_DIRECTORY} _stripped_dir)

            if(NOT _stripped_dir STREQUAL FUNC_LIBRARY_DIRECTORY)
                set(_build_library_dir ${FUNC_LIBRARY_DIRECTORY})
                set(_install_library_dir ${FUNC_LIBRARY_DIRECTORY})
            else()
                set(_build_library_dir ${_build_library_dir}/${FUNC_LIBRARY_DIRECTORY})
                set(_install_library_dir ${_install_library_dir}/${FUNC_LIBRARY_DIRECTORY})
            endif()
        endif()

        if(FUNC_ARCHIVE_DIRECTORY)
            string(GENEX_STRIP ${FUNC_ARCHIVE_DIRECTORY} _stripped_dir)

            if(NOT _stripped_dir STREQUAL FUNC_ARCHIVE_DIRECTORY)
                set(_build_archive_dir ${FUNC_ARCHIVE_DIRECTORY})
                set(_install_archive_dir ${FUNC_ARCHIVE_DIRECTORY})
            else()
                set(_build_archive_dir ${_build_archive_dir}/${FUNC_ARCHIVE_DIRECTORY})
                set(_install_archive_dir ${_install_archive_dir}/${FUNC_ARCHIVE_DIRECTORY})
            endif()
        endif()
    endif()

    if(FUNC_PDB_DIRECTORY)
        string(GENEX_STRIP ${FUNC_PDB_DIRECTORY} _stripped_dir)

        if(NOT _stripped_dir STREQUAL FUNC_PDB_DIRECTORY)
            set(_install_pdb_dir ${FUNC_PDB_DIRECTORY})
        else()
            set(_install_pdb_dir ${_install_pdb_dir}/${FUNC_PDB_DIRECTORY})
        endif()
    endif()
endmacro()

#[[
    Pre-configure a target.

    _repo_pre_configure_target_internal(<target>)
]] #
macro(_repo_pre_configure_target_internal _target _extra_args_ref)
    if(${_V}_PRE_CONFIGURE_COMMANDS)
        foreach(_cmd IN LISTS ${_V}_PRE_CONFIGURE_COMMANDS)
            cmake_language(CALL ${_cmd} ${_target} ${_extra_args_ref})
        endforeach()
    endif()
endmacro()

#[[
    Post-configure a target.

    _repo_post_configure_target_internal(<target>)

    Required variables:
        FUNC_NO_INSTALL (nullable)
#]]
macro(_repo_post_configure_target_internal _target)
    if(${_V}_INCLUDE_DIR)
        qm_configure_target(${_target}
            INCLUDE $<BUILD_INTERFACE:${${_V}_INCLUDE_DIR}>
        )
    endif()

    qm_configure_target(${_target}
        INCLUDE $<BUILD_INTERFACE:${${_V}_BUILD_INCLUDE_DIR}>
    )

    if(${_V}_INSTALL AND ${_V}_DEVEL AND NOT FUNC_NO_INSTALL)
        qm_configure_target(${_target}
            INCLUDE $<INSTALL_INTERFACE:${${_V}_INSTALL_INCLUDE_DIR}>
        )
    endif()

    if(${_V}_POST_CONFIGURE_COMMANDS)
        foreach(_cmd IN LISTS ${_V}_POST_CONFIGURE_COMMANDS)
            cmake_language(CALL ${_cmd} ${_target})
        endforeach()
    endif()
endmacro()

#[[
    Add an executable target.

    _repo_add_executable_internal(<target>
        [QT_AUTOGEN]
    )
]] #
function(_repo_add_executable_internal _target _type _extra_args_ref)
    set(options QT_AUTOGEN)
    set(oneValueArgs)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    add_executable(${_target})

    if(FUNC_QT_AUTOGEN)
        _repo_set_cmake_qt_autogen(${_target})
    endif()

    set_target_properties(${_target} PROPERTIES
        ${_V}_TARGET_TYPE ${_type}
    )
    _repo_pre_configure_target_internal(${_target} ${_extra_args_ref})
    qm_configure_target(${_target} ${FUNC_UNPARSED_ARGUMENTS})

    set(${_extra_args_ref} ${${_extra_args_ref}} PARENT_SCOPE)
endfunction()

#[[
    Add a library target.

    _repo_add_library_internal(<target>
        [STATIC] [SHARED] [INTERFACE]
        [QT_AUTOGEN]
        [MACRO_PREFIX <prefix>]
        [LIBRARY_MACRO <name>]
        [STATIC_MACRO <name>]
    )
]] #
function(_repo_add_library_internal _target _type _extra_args_ref)
    set(options STATIC SHARED INTERFACE QT_AUTOGEN)
    set(oneValueArgs MACRO_PREFIX LIBRARY_MACRO STATIC_MACRO)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_options)

    if(FUNC_MACRO_PREFIX)
        list(APPEND _options PREFIX ${FUNC_MACRO_PREFIX})
    endif()

    if(FUNC_LIBRARY_MACRO)
        list(APPEND _options LIBRARY ${FUNC_LIBRARY_MACRO})
    endif()

    if(FUNC_STATIC_MACRO)
        list(APPEND _options STATIC ${FUNC_STATIC_MACRO})
    endif()

    set(_scope PUBLIC)
    set(_interface off)

    if(FUNC_SHARED)
        add_library(${_target} SHARED)
    elseif(FUNC_INTERFACE)
        set(_scope INTERFACE)
        set(_interface on)
        add_library(${_target} INTERFACE)
    elseif(FUNC_STATIC)
        add_library(${_target} STATIC)
    else()
        # Fallback to default behavior
        if(${_V}_BUILD_SHARED)
            add_library(${_target} SHARED)
        else()
            add_library(${_target} STATIC)
        endif()
    endif()

    if(FUNC_QT_AUTOGEN)
        _repo_set_cmake_qt_autogen(${_target})
    endif()

    set_target_properties(${_target} PROPERTIES
        ${_V}_TARGET_TYPE ${_type}
    )

    if(NOT _interface)
        qm_export_defines(${_target} ${_options})
    endif()

    _repo_pre_configure_target_internal(${_target} ${_extra_args_ref})
    qm_configure_target(${_target} ${FUNC_UNPARSED_ARGUMENTS})

    set(${_extra_args_ref} ${${_extra_args_ref}} PARENT_SCOPE)
endfunction()

#[[
    _repo_parse_copy_args(<args> <RESULT> <ERROR>)

    args:   SRC <files...> DEST <dir1>
            SRC <files...> DEST <dir2> ...
]] #
function(_repo_parse_copy_args _args _result _error)
    # State Machine
    set(_src)
    set(_dest)
    set(_status NONE) # NONE, SRC, DEST
    set(_count 0)

    set(_list)

    foreach(_item IN LISTS _args)
        if(${_item} STREQUAL SRC)
            if(${_status} STREQUAL NONE)
                set(_src)
                set(_status SRC)
            elseif(${_status} STREQUAL DEST)
                set(${_error} "missing directory name after DEST!" PARENT_SCOPE)
                return()
            else()
                set(${_error} "missing source files after SRC!" PARENT_SCOPE)
                return()
            endif()
        elseif(${_item} STREQUAL DEST)
            if(${_status} STREQUAL SRC)
                set(_status DEST)
            elseif(${_status} STREQUAL DEST)
                set(${_error} "missing directory name after DEST!" PARENT_SCOPE)
                return()
            else()
                set(${_error} "no source files specified for DEST!" PARENT_SCOPE)
                return()
            endif()
        else()
            if(${_status} STREQUAL NONE)
                set(${_error} "missing SRC or DEST token!" PARENT_SCOPE)
                return()
            elseif(${_status} STREQUAL DEST)
                if(NOT _src)
                    set(${_error} "no source files specified for DEST!" PARENT_SCOPE)
                    return()
                endif()

                set(_status NONE)
                math(EXPR _count "${_count} + 1")

                string(JOIN "\\;" _src_str ${_src})
                list(APPEND _list "${_src_str}\\;${_item}")
            else()
                set(_slash off)

                if(${_item} MATCHES "(.+)/\\**$")
                    set(_slash on)
                    set(_item ${CMAKE_MATCH_1})
                endif()

                get_filename_component(_path ${_item} ABSOLUTE)

                if(_slash)
                    set(_path "${_path}/")
                endif()

                list(APPEND _src ${_path})
            endif()
        endif()
    endforeach()

    if(${_status} STREQUAL SRC)
        set(${_error} "missing DEST after source files!" PARENT_SCOPE)
        return()
    elseif(${_status} STREQUAL DEST)
        set(${_error} "missing directory name after DEST!" PARENT_SCOPE)
        return()
    elseif(${_count} STREQUAL 0)
        set(${_error} "no files specified!" PARENT_SCOPE)
        return()
    endif()

    set(${_result} "${_list}" PARENT_SCOPE)
endfunction()

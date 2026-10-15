#[==[.rst:
QtQml
-----

Installing QML modules the way Qt lays them out.
#]==]

include_guard(DIRECTORY)

#[==[.rst:
.. cmake:command:: qm_install_qml_modules

  Installs a QML module and its runtime loadable plugin, meta information, QML files, and resources.
  The module is identified by the given target name.

  The Qt version should be greater than or equal to 6.3.

  .. code-block:: cmake

    qm_install_qml_modules(target
        [PREFIX prefix]
    )

  ``PREFIX``
    install directory prefix (default: "qml")

  .. note::
     For static library backing targets, you should specify ``OUTPUT_TARGETS``
     when calling ``qt_add_qml_module()`` to collect the internally generated
     targets (mainly object libraries), and then install them by calling:

     .. code-block:: cmake

        install(TARGETS ${_output_targets}
            EXPORT <target set>
            RUNTIME DESTINATION bin
            LIBRARY DESTINATION lib
            ARCHIVE DESTINATION lib
            OBJECTS DESTINATION lib
        )

  .. seealso:: `qt_add_qml_module <https://doc.qt.io/qt-6/qt-add-qml-module.html>`_
#]==]
function(qm_install_qml_modules _target)
    set(options)
    set(oneValueArgs PREFIX)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_prefix)
    qm_set_value(_prefix FUNC_PREFIX "qml")

    qt_query_qml_module(${_target}
        URI _module_uri
        VERSION _module_version
        PLUGIN_TARGET _module_plugin_target
        TARGET_PATH _module_target_path
        QMLDIR _module_qmldir
        TYPEINFO _module_typeinfo
        QML_FILES _module_qml_files
        QML_FILES_DEPLOY_PATHS _qml_files_deploy_paths
        RESOURCES _module_resources
        RESOURCES_DEPLOY_PATHS _resources_deploy_paths
    )

    # See also: https://doc.qt.io/qt-6/qt-query-qml-module.html#example

    # Install the QML module runtime loadable plugin
    set(_module_dir "${_prefix}/${_module_target_path}")
    if(_module_plugin_target)
        install(TARGETS "${_module_plugin_target}"
            LIBRARY DESTINATION "${_module_dir}"
            RUNTIME DESTINATION "${_module_dir}"
            ARCHIVE DESTINATION "${_module_dir}"
        )
    endif()

    # Install the QML module meta information.
    install(FILES "${_module_qmldir}" DESTINATION "${_module_dir}")
    if(_module_typeinfo)
        install(FILES "${_module_typeinfo}" DESTINATION "${_module_dir}")
    endif()

    # Install QML files, possibly renamed.
    list(LENGTH _module_qml_files _num_files)

    if(_num_files GREATER 0)
        math(EXPR _last_index "${_num_files} - 1")

        foreach(_i RANGE 0 ${_last_index})
            list(GET _module_qml_files ${_i} _src_file)
            list(GET _qml_files_deploy_paths ${_i} _deploy_path)
            get_filename_component(_dest_name "${_deploy_path}" NAME)
            get_filename_component(_dest_dir "${_deploy_path}" DIRECTORY)
            install(FILES "${_src_file}" DESTINATION "${_module_dir}/${_dest_dir}" RENAME "${_dest_name}")
        endforeach()
    endif()

    # Install resources, possibly renamed.
    list(LENGTH _module_resources _num_files)

    if(_num_files GREATER 0)
        math(EXPR _last_index "${_num_files} - 1")

        foreach(_i RANGE 0 ${_last_index})
            list(GET _module_resources ${_i} _src_file)
            list(GET _resources_deploy_paths ${_i} _deploy_path)
            get_filename_component(_dest_name "${_deploy_path}" NAME)
            get_filename_component(_dest_dir "${_deploy_path}" DIRECTORY)
            install(FILES "${_src_file}" DESTINATION "${_module_dir}/${_dest_dir}" RENAME "${_dest_name}")
        endforeach()
    endif()
endfunction()

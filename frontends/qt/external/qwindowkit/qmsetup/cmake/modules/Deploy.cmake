#[==[.rst:
Deploy
------

Gathering what a built or an installed binary needs to run, and putting it
beside the binary. Windows is done after a build and every platform can be done
during an install.

.. warning::
   This module depends on ``qmcorecmd`` after installation.
#]==]
if(NOT QMSETUP_CORECMD_EXECUTABLE)
    message(FATAL_ERROR "QMSETUP_CORECMD_EXECUTABLE not defined. Add find_package(qmsetup) to CMake first.")
endif()

if(NOT DEFINED QMSETUP_APPLOCAL_DEPS_PATHS)
    set(QMSETUP_APPLOCAL_DEPS_PATHS)
endif()

if(NOT DEFINED QMSETUP_APPLOCAL_DEPS_PATHS_DEBUG)
    set(QMSETUP_APPLOCAL_DEPS_PATHS_DEBUG ${QMSETUP_APPLOCAL_DEPS_PATHS})
endif()

if(NOT DEFINED QMSETUP_APPLOCAL_DEPS_PATHS_RELEASE)
    set(QMSETUP_APPLOCAL_DEPS_PATHS_RELEASE ${QMSETUP_APPLOCAL_DEPS_PATHS})
endif()

if(NOT DEFINED QMSETUP_APPLOCAL_DEPS_PATHS_RELWITHDEBINFO)
    set(QMSETUP_APPLOCAL_DEPS_PATHS_RELWITHDEBINFO ${QMSETUP_APPLOCAL_DEPS_PATHS_RELEASE})
endif()

if(NOT DEFINED QMSETUP_APPLOCAL_DEPS_PATHS_MINSIZEREL)
    set(QMSETUP_APPLOCAL_DEPS_PATHS_MINSIZEREL ${QMSETUP_APPLOCAL_DEPS_PATHS_RELEASE})
endif()

include_guard(DIRECTORY)

#[==[.rst:
.. cmake:command:: qm_win_applocal_deps

  Automatically copy dependencies for Windows Executables after build.

  .. code-block:: cmake

    qm_win_applocal_deps(<target>
        [CUSTOM_TARGET <target>]
        [FORCE] [VERBOSE]
        [EXTRA_SEARCHING_PATHS <path...>]
        [OUTPUT_DIR <dir>]
        [EXCLUDE <pattern...>]
    )

  Does nothing where the platform is not Windows, so a call needs no guard
  around it.

  .. seealso:: :cmake:command:`qm_deploy_directory`, for the same thing done
     while installing rather than after building.
#]==]
function(qm_win_applocal_deps _target)
    if(NOT WIN32)
        return()
    endif()

    set(options FORCE VERBOSE)
    set(oneValueArgs CUSTOM_TARGET OUTPUT_DIR)
    set(multiValueArgs EXTRA_SEARCHING_PATHS EXCLUDE)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    # Get output directory and deploy target
    set(_out_dir)
    set(_deploy_target)

    if(FUNC_CUSTOM_TARGET)
        set(_deploy_target ${FUNC_CUSTOM_TARGET})

        if(NOT TARGET ${_deploy_target})
            add_custom_target(${_deploy_target})
        endif()
    else()
        set(_deploy_target ${_target})
    endif()

    if(FUNC_OUTPUT_DIR)
        set(_out_dir ${FUNC_OUTPUT_DIR})
    else()
        set(_out_dir "$<TARGET_FILE_DIR:${_target}>")
    endif()

    if(NOT _out_dir)
        message(FATAL_ERROR "qm_win_applocal_deps: cannot determine output directory.")
    endif()

    # Prepare command
    set(_args)

    if(FUNC_FORCE)
        list(APPEND _args -f)
    endif()

    if(FUNC_VERBOSE)
        list(APPEND _args -V)
    endif()

    # Add extra searching paths
    foreach(_item IN LISTS FUNC_EXTRA_SEARCHING_PATHS)
        list(APPEND _args "-L${_item}")
    endforeach()

    # Add global extra searching paths
    if(CMAKE_BUILD_TYPE)
        string(TOUPPER ${CMAKE_BUILD_TYPE} _build_type_upper)

        if(QMSETUP_APPLOCAL_DEPS_PATHS_${_build_type_upper})
            foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS_${_build_type_upper})
                get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
                list(APPEND _args "-L${_item}")
            endforeach()
        elseif(QMSETUP_APPLOCAL_DEPS_PATHS)
            foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS)
                get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
                list(APPEND _args "-L${_item}")
            endforeach()
        endif()
    else()
        foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS)
            get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
            list(APPEND _args "-L${_item}")
        endforeach()
    endif()

    foreach(_item IN LISTS FUNC_EXCLUDE)
        list(APPEND _args -e ${_item})
    endforeach()

    list(APPEND _args "$<TARGET_FILE:${_target}>")

    # Made first, and on its own, since a working directory applies to every
    # command of the one it is given to and would be entered before this ran.
    # The default output directory is the one the target was built into and is
    # always there, but an OUTPUT_DIR of the caller's own need not be, and a
    # working directory that does not exist stops the build.
    add_custom_command(TARGET ${_deploy_target} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory ${_out_dir}
        VERBATIM
    )

    add_custom_command(TARGET ${_deploy_target} POST_BUILD
        COMMAND ${QMSETUP_CORECMD_EXECUTABLE} deploy ${_args}
        WORKING_DIRECTORY ${_out_dir}
        VERBATIM
    )
endfunction()

#[==[.rst:
.. cmake:command:: qm_deploy_directory

  Add a deploy command when installing the project. Not for a debug build.

  .. code-block:: cmake

    qm_deploy_directory(<install_dir>
        [FORCE] [STANDARD] [VERBOSE]
        [LIBRARY_DIR <dir>]
        [EXTRA_LIBRARIES <path>...]
        [EXTRA_PLUGIN_PATHS <path>...]
        [EXTRA_SEARCHING_PATHS <path>...]

        [PLUGINS <plugin>...]
        [PLUGIN_DIR <dir>]

        [QML <qml>...]
        [QML_DIR <dir>]

        [COMMENT <comment>]
    )

  ``PLUGINS``
    Qt plugins, in format of ``<category>/<name>``
  ``PLUGIN_DIR``
    Qt plugins destination
  ``EXTRA_PLUGIN_PATHS``
    Extra Qt plugins searching paths
  ``QML``
    Qt qml directories
  ``QML_DIR``
    Qt qml destination
  ``LIBRARY_DIR``
    Library destination
  ``EXTRA_LIBRARIES``
    Extra library names list to deploy
  ``EXTRA_SEARCHING_PATHS``
    Extra library searching paths

  What it gathers is the release flavour of everything, and that is decided in
  the scripts underneath rather than here. A plugin is looked for by the name it
  was given, so ``iconengines/qsvgicon`` finds ``qsvgicon.dll`` and never
  ``qsvgicond.dll``, and a debug build beside a release one is turned down on
  sight. Unix leaves out anything whose name carries ``debug``, which is how a
  macOS framework spells its debug library.

  So nothing stops this being called in a debug build, and what it leaves is a
  release deployment. Nothing here reads the configuration, and the note above is
  the whole of the enforcement.

  ``QML`` is the one thing here that cannot be asked for without a Qt, the
  modules being named relative to a directory only qmake can say where is.
  ``PLUGINS`` given ``EXTRA_PLUGIN_PATHS`` never reaches qmake.

  .. note::
     Where qmake is wanted it has to be found first, which
     :cmake:command:`qm_find_qt` with any component is the short way to. A call
     that needs it and does not have it stops with an error saying so.

  ``EXTRA_LIBRARIES`` is matched against what is on disk while the project is
  being read, so it names neither a target of this build nor a generator
  expression.
#]==]
function(qm_deploy_directory _install_dir)
    set(options FORCE STANDARD VERBOSE)
    set(oneValueArgs LIBRARY_DIR PLUGIN_DIR QML_DIR COMMENT)
    set(multiValueArgs EXTRA_PLUGIN_PATHS PLUGINS QML EXTRA_SEARCHING_PATHS EXTRA_LIBRARIES)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    # Get qmake
    if((FUNC_PLUGINS OR FUNC_QML) AND NOT DEFINED QT_QMAKE_EXECUTABLE)
        if(TARGET Qt${QT_VERSION_MAJOR}::qmake)
            qm_get_executable_location(Qt${QT_VERSION_MAJOR}::qmake _qmake_path)
            set(QT_QMAKE_EXECUTABLE "${_qmake_path}" CACHE FILEPATH "Path to qmake executable" FORCE)
        elseif((FUNC_PLUGINS AND NOT FUNC_EXTRA_PLUGIN_PATHS) OR FUNC_QML)
            message(FATAL_ERROR "qm_deploy_directory: qmake not defined. Add find_package(Qt5 COMPONENTS Core) to CMake to enable.")
        endif()
    endif()

    # Set values
    qm_set_value(_lib_dir FUNC_LIBRARY_DIR "${_install_dir}/${QMSETUP_SHARED_LIBRARY_CATEGORY}")
    qm_set_value(_plugin_dir FUNC_PLUGIN_DIR "${_install_dir}/plugins")
    qm_set_value(_qml_dir FUNC_QML_DIR "${_install_dir}/qml")

    # Prepare commands
    set(_args
        -i "${_install_dir}"
        -m "${QMSETUP_CORECMD_EXECUTABLE}"
        --plugindir "${_plugin_dir}"
        --libdir "${_lib_dir}"
        --qmldir "${_qml_dir}"
    )
    set(_searching_paths)

    if(QT_QMAKE_EXECUTABLE)
        list(APPEND _args --qmake "${QT_QMAKE_EXECUTABLE}")
    endif()

    # Add Qt plugins
    foreach(_item IN LISTS FUNC_PLUGINS)
        list(APPEND _args --plugin "${_item}")
    endforeach()

    # Add QML modules
    foreach(_item IN LISTS FUNC_QML)
        list(APPEND _args --qml "${_item}")
    endforeach()

    # Add extra plugin paths
    foreach(_item IN LISTS FUNC_EXTRA_PLUGIN_PATHS)
        list(APPEND _args --extra "${_item}")
    endforeach()

    # Add extra searching paths
    foreach(_item IN LISTS FUNC_EXTRA_SEARCHING_PATHS)
        get_filename_component(_item ${_item} ABSOLUTE)
        list(APPEND _searching_paths ${_item})
    endforeach()

    # Add global extra searching paths
    if(CMAKE_BUILD_TYPE)
        string(TOUPPER ${CMAKE_BUILD_TYPE} _build_type_upper)

        if(QMSETUP_APPLOCAL_DEPS_PATHS_${_build_type_upper})
            foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS_${_build_type_upper})
                get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
                list(APPEND _searching_paths ${_item})
            endforeach()
        elseif(QMSETUP_APPLOCAL_DEPS_PATHS)
            foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS)
                get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
                list(APPEND _searching_paths ${_item})
            endforeach()
        endif()
    else()
        foreach(_item IN LISTS QMSETUP_APPLOCAL_DEPS_PATHS)
            get_filename_component(_item ${_item} ABSOLUTE BASE_DIR ${CMAKE_SOURCE_DIR})
            list(APPEND _searching_paths ${_item})
        endforeach()
    endif()

    foreach(_item IN LISTS _searching_paths)
        list(APPEND _args -L "${_item}")
    endforeach()

    if(WIN32)
        set(_script cmd /c "${QMSETUP_MODULES_DIR}/scripts/windeps.bat")
    else()
        set(_script bash "${QMSETUP_MODULES_DIR}/scripts/unixdeps.sh")
    endif()

    # Add extra libraries
    #
    # One copy per library rather than per place it was found in. The search
    # paths are in the order they are to be searched, so the first that has it
    # is the one meant, and the rest are shadowed the way a loader would shadow
    # them.
    foreach(_lib IN LISTS FUNC_EXTRA_LIBRARIES)
        foreach(_item IN LISTS _searching_paths)
            set(_path "${_item}/${_lib}")

            if((EXISTS ${_path}) AND(NOT IS_DIRECTORY ${_path}))
                list(APPEND _args --copy ${_path} ${_lib_dir})
                break()
            endif()
        endforeach()
    endforeach()

    # Add options
    if(FUNC_FORCE)
        list(APPEND _args "-f")
    endif()

    if(FUNC_STANDARD)
        list(APPEND _args "-s")
    endif()

    if(FUNC_VERBOSE)
        list(APPEND _args "-V")
    endif()

    set(_comment_code)

    if(FUNC_COMMENT)
        set(_comment_code "message(STATUS [==[${FUNC_COMMENT}]==])")
    endif()

    # Add install command
    #
    # The command is carried over as a list and rebuilt on the other side, so
    # that a path with a space or a quote in it is one argument there as it is
    # one here. Written by pasting each argument into a string between quotes,
    # anything holding a quote of its own ended the argument early.
    #
    # Bracket arguments, since what goes between them is text and nothing in it
    # is a variable reference or an escape. The list itself is expanded on the
    # way in, being what varies.
    install(CODE "
        ${_comment_code}
        set(_command [==[${_script};${_args}]==])
        execute_process(
            COMMAND \${_command}
            WORKING_DIRECTORY [==[${_install_dir}]==]
            COMMAND_ERROR_IS_FATAL ANY
        )
    ")
endfunction()

#[==[.rst:
Global API
==========

What ``find_package(qmsetup)`` brings on its own, before any module is imported.
Paths, versions, target configuration and the Qt helpers are here.
#]==]

cmake_minimum_required(VERSION 3.19)

#[[
    NOTICE

    Never wrap `find_package(Qt)` in a function. Use a macro, and do not wrap
    that in a function either.

    Qt's own modules set the private header directory variables only when the Qt
    targets have not been defined yet. Inside a function those variables belong
    to the function's scope and go when it returns, while the targets they came
    with stay. The next call sees the targets, sets nothing, and the directories
    are gone for good.
]] #
set(QMSETUP_MODULES_DIR ${CMAKE_CURRENT_LIST_DIR})

# What the modules used to be called, which qm_import reads.
include("${CMAKE_CURRENT_LIST_DIR}/private/ModuleAliases.cmake")

if(WIN32)
    set(QMSETUP_SHARED_LIBRARY_CATEGORY bin)
    set(QMSETUP_NULL_FILE "NUL")
    set(QMSETUP_REGEX_ABSOLUTE_PATH "^[a-zA-Z]:|\\\\")
else()
    set(QMSETUP_SHARED_LIBRARY_CATEGORY lib)
    set(QMSETUP_NULL_FILE "/dev/null")
    set(QMSETUP_REGEX_ABSOLUTE_PATH "^/")
endif()

set(QMSETUP_IGNORE_STDOUT > ${QMSETUP_NULL_FILE})
set(QMSETUP_IGNORE_STDERR 2> ${QMSETUP_NULL_FILE})
set(QMSETUP_IGNORE_STDOUT_STDERR > ${QMSETUP_NULL_FILE} 2>&1)

if(TARGET qmsetup::corecmd)
    get_target_property(QMSETUP_CORECMD_EXECUTABLE qmsetup::corecmd LOCATION)
else()
    set(QMSETUP_CORECMD_EXECUTABLE)
endif()

if(NOT DEFINED QMSETUP_FIND_QT_ORDER)
    set(QMSETUP_FIND_QT_ORDER Qt6 Qt5)
endif()

include_guard(DIRECTORY)

#[==[.rst:
.. cmake:command:: qm_import

  Include modules of this library.

  .. code-block:: cmake

    qm_import(<module...>)

  The suffix may be left off or written out, and a module under a subdirectory
  is named through it, as ``private/CompilerOptions``.

  A module that has been renamed answers to what it used to be called as well,
  with a deprecation warning naming the new one. ``cmake/private/ModuleAliases.cmake``
  is the list of those.
#]==]
macro(qm_import)
    foreach(_module ${ARGN})
        # Asked of the name without its suffix, so that Qml and Qml.cmake are
        # the same question, and of the whole of it, so that a module under a
        # subdirectory is one name rather than two.
        string(REGEX REPLACE "\\.cmake$" "" _qm_import_name "${_module}")

        if(DEFINED QMSETUP_MODULE_ALIAS_${_qm_import_name})
            message(DEPRECATION
                "qm_import: \"${_qm_import_name}\" is now "
                "\"${QMSETUP_MODULE_ALIAS_${_qm_import_name}}\". The old name still works.")
            set(_qm_import_name "${QMSETUP_MODULE_ALIAS_${_qm_import_name}}")
        endif()

        set(_module_path "${QMSETUP_MODULES_DIR}/modules/${_qm_import_name}.cmake")

        if(NOT EXISTS "${_module_path}")
            message(FATAL_ERROR "qm_import: module \"${_module}\" not found.")
        endif()

        include("${_module_path}")
    endforeach()

    unset(_qm_import_name)
endmacro()

#[==[.rst:
.. cmake:command:: qm_import_all

  Include all modules of this library.

  .. code-block:: cmake

    qm_import_all()
#]==]
macro(qm_import_all)
    file(GLOB _tmp_modules "${QMSETUP_MODULES_DIR}/modules/*.cmake")

    foreach(_module IN LISTS _tmp_modules)
        include("${_module}")
    endforeach()

    unset(_tmp_modules)
endmacro()

#[==[.rst:
.. cmake:command:: qm_find_package

  Find third-party packages by including scripts in ``find-modules``.

  .. code-block:: cmake

    qm_find_package(<module...>)
#]==]
macro(qm_find_package)
    foreach(_module ${ARGN})
        if(NOT _module MATCHES "(.+)\\.cmake")
            set(_module "${_module}.cmake")
        endif()

        set(_module_path "${QMSETUP_MODULES_DIR}/find-modules/${_module}")

        # Prepend "Find" to the file name
        if(NOT EXISTS "${_module_path}")
            set(_module_path "${QMSETUP_MODULES_DIR}/find-modules/Find${_module}")
        endif()

        if(NOT EXISTS "${_module_path}")
            message(FATAL_ERROR "qm_find_package: find script \"${_module}\" not found.")
        endif()

        include("${_module_path}")
    endforeach()
endmacro()

#[==[.rst:
.. cmake:command:: qm_parse_version

  Parse version and create seq vars with specified prefix.

  .. code-block:: cmake

    qm_parse_version(<prefix> <version>)
#]==]
function(qm_parse_version _prefix _version)
    string(REPLACE "." ";" _version_list ${_version})
    list(LENGTH _version_list _version_count)
    list(PREPEND _version_list 0) # Add placeholder

    foreach(_i RANGE 1 4)
        if(_i LESS_EQUAL _version_count)
            list(GET _version_list ${_i} _item)
        else()
            set(_item 0)
        endif()

        set(${_prefix}_${_i} ${_item} PARENT_SCOPE)
    endforeach()
endfunction()

#[==[.rst:
.. cmake:command:: qm_crop_version

  Get shorter version number.

  .. code-block:: cmake

    qm_crop_version(<VAR> <version> <count>)
#]==]
function(qm_crop_version _var _version _count)
    qm_parse_version(FUNC ${_version})

    set(_list)

    foreach(_i RANGE 1 ${_count})
        list(APPEND _list ${FUNC_${_i}})
    endforeach()

    string(JOIN "." _short_version ${_list})
    set(${_var} ${_short_version} PARENT_SCOPE)
endfunction()

#[==[.rst:
.. cmake:command:: qm_paths_equal

  Tell if the given paths are same in canonical form.

  .. code-block:: cmake

    qm_paths_equal(<VAR> <path1> <path2>)
#]==]
function(qm_paths_equal _out _path1 _path2)
    # cmake_path(NORMAL_PATH) is introduced in CMake 3.20, we don't use it
    # We call `get_filename_component` twice to normalize the paths
    get_filename_component(_path1 ${_path1} ABSOLUTE)
    get_filename_component(_path1 ${_path1} REALPATH)

    get_filename_component(_path2 ${_path2} ABSOLUTE)
    get_filename_component(_path2 ${_path2} REALPATH)

    if(_path1 STREQUAL _path2)
        set(${_out} on PARENT_SCOPE)
    else()
        set(${_out} off PARENT_SCOPE)
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_set_value

  Set a variable to the first of several that holds something, or to a default.

  .. code-block:: cmake

    qm_set_value(<key> [<variable>...] <default>)

  ``<key>``
    the variable to set, in the caller's scope
  ``<variable>``
    the *name* of a variable to try rather than its value. They are tried in
    the order given and the first that ``if()`` calls true is taken, so a
    variable that is unset, empty or ``OFF`` falls through to the next.
  ``<default>``
    a value rather than a name, taken where none of the variables answered

  .. code-block:: cmake

    qm_set_value(_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")

  Naming no variable at all is allowed, and comes to ``set(<key> <default>)``.
#]==]
function(qm_set_value _key)
    set(_args "${ARGN}")
    list(POP_BACK _args _default)

    foreach(_item IN LISTS _args)
        if(${_item})
            set(${_key} ${${_item}} PARENT_SCOPE)
            return()
        endif()
    endforeach()

    set(${_key} ${_default} PARENT_SCOPE)
endfunction()

#[==[.rst:
.. cmake:command:: qm_skip_automoc

  Skip CMAKE_AUTOMOC for sources files or ones in directories.

  .. code-block:: cmake

    qm_skip_automoc(<file/dir...> [RECURSIVE])

  A directory stands for the sources directly in it. RECURSIVE takes what is
  under them as well.

  A name that is neither a file nor a directory is passed over rather than
  being an error, so that a caller may name something optional.

  \note A source file property belongs to the directory it was set in, so this
  has to be called where the target using those sources is defined.
#]==]
function(qm_skip_automoc)
    set(options RECURSIVE)
    set(oneValueArgs)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_patterns *.h *.hpp *.hh *.hxx *.cpp *.cxx *.c *.cc *.m *.mm)

    foreach(_item IN LISTS FUNC_UNPARSED_ARGUMENTS)
        get_filename_component(_item ${_item} ABSOLUTE)

        if(IS_DIRECTORY ${_item})
            set(_globs)

            foreach(_pattern IN LISTS _patterns)
                list(APPEND _globs "${_item}/${_pattern}")
            endforeach()

            if(FUNC_RECURSIVE)
                file(GLOB_RECURSE _src ${_globs})
            else()
                file(GLOB _src ${_globs})
            endif()

            set_source_files_properties(${_src} PROPERTIES SKIP_AUTOMOC ON)
        elseif(EXISTS ${_item})
            set_source_files_properties(${_item} PROPERTIES SKIP_AUTOMOC ON)
        endif()
    endforeach()
endfunction()

#[==[.rst:
.. cmake:command:: qm_find_qt

  Find Qt libraries. Don't wrap it in any functions.

  .. code-block:: cmake

    qm_find_qt(<modules...> [QUIET] [REQUIRED] [EXACT])

  QUIET and REQUIRED are passed on to find_package and may be given together,
  which is what find_package itself allows. With neither given, REQUIRED is
  what is meant.
#]==]
macro(qm_find_qt)
    # unread-keyword: EXACT
    #
    ##FIXME EXACT is accepted and does nothing. It says how to match a version
    ##FIXME and nothing here ever asks for one, so find_package answers it with
    ##FIXME "Ignoring EXACT since no version is requested". It is not passed on,
    ##FIXME since all that would add is that warning at every call site. Giving
    ##FIXME it something to do means a VERSION argument, which this has never
    ##FIXME had.
    set(options QUIET REQUIRED EXACT)
    set(oneValueArgs)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    set(_qm_find_qt_options)

    if(FUNC_QUIET)
        list(APPEND _qm_find_qt_options QUIET)
    endif()

    if(FUNC_REQUIRED)
        list(APPEND _qm_find_qt_options REQUIRED)
    endif()

    if(NOT FUNC_QUIET AND NOT FUNC_REQUIRED)
        list(APPEND _qm_find_qt_options REQUIRED)
    endif()

    foreach(_module IN LISTS FUNC_UNPARSED_ARGUMENTS)
        if(NOT QT_VERSION_MAJOR)
            find_package(QT NAMES ${QMSETUP_FIND_QT_ORDER} COMPONENTS ${_module} ${_qm_find_qt_options})
        endif()

        if(NOT TARGET Qt${QT_VERSION_MAJOR}::${_module})
            find_package(Qt${QT_VERSION_MAJOR} COMPONENTS ${_module} ${_qm_find_qt_options})
        endif()
    endforeach()

    unset(_qm_find_qt_options)
endmacro()

#[==[.rst:
.. cmake:command:: qm_link_qt

  Link Qt libraries. Don't wrap it in any functions.

  .. code-block:: cmake

    qm_link_qt(<target> <scope> <modules...>)
#]==]
macro(qm_link_qt _target _scope)
    foreach(_module ${ARGN})
        qm_find_qt(${_module})
        target_link_libraries(${_target} ${_scope} Qt${QT_VERSION_MAJOR}::${_module})
    endforeach()
endmacro()

#[==[.rst:
.. cmake:command:: qm_include_qt_private

  Include Qt private header directories. Don't wrap it in any functions.

  .. code-block:: cmake

    qm_include_qt_private(<target> <scope> <modules...>)
#]==]
macro(qm_include_qt_private _target _scope)
    foreach(_module ${ARGN})
        qm_find_qt(${_module}Private QUIET)

        if(TARGET Qt${QT_VERSION_MAJOR}::${_module}Private)
            target_link_libraries(${_target} ${_scope} Qt${QT_VERSION_MAJOR}::${_module}Private)
        else()
            qm_find_qt(${_module})
            set(_var_name Qt${QT_VERSION_MAJOR}${_module}_PRIVATE_INCLUDE_DIRS)

            # Dereferenced twice, _var_name holding the name of the variable to
            # read rather than the directories themselves.
            if(${_var_name})
                target_include_directories(${_target} ${_scope} ${${_var_name}})
            else()
                # On Linux, QtGuiPrivate depends on XKB which may not be installed, directly include the
                # private headers as a workaround.
                if(NOT QT_INSTALL_HEADERS)
                    if(NOT QT_QMAKE_EXECUTABLE)
                        if(TARGET Qt${QT_VERSION_MAJOR}::qmake)
                            qm_get_executable_location(Qt${QT_VERSION_MAJOR}::qmake _qmake_path)
                            set(QT_QMAKE_EXECUTABLE "${_qmake_path}" CACHE FILEPATH "Path to qmake executable" FORCE)
                        else()
                            message(WARNING "qm_include_qt_private: qmake not defined, can't include private headers.")
                        endif()
                    endif()

                    execute_process(
                        COMMAND ${QT_QMAKE_EXECUTABLE} -query QT_INSTALL_HEADERS
                        OUTPUT_VARIABLE _install_headers
                        OUTPUT_STRIP_TRAILING_WHITESPACE
                        COMMAND_ERROR_IS_FATAL ANY
                    )

                    set(QT_INSTALL_HEADERS ${_install_headers} CACHE PATH "Path to Qt headers" FORCE)
                endif()

                target_include_directories(${_target} ${_scope} ${QT_INSTALL_HEADERS}/Qt${_module}/${QT_VERSION})
                target_include_directories(${_target} ${_scope} ${QT_INSTALL_HEADERS}/Qt${_module}/${QT_VERSION}/Qt${_module})
                target_include_directories(${_target} ${_scope} ${QT_INSTALL_HEADERS}/Qt${_module}/${QT_VERSION}/Qt${_module}/private)
            endif()
        endif()
    endforeach()
endmacro()

#[==[.rst:
.. cmake:command:: qm_configure_target

  Helper to set or append all kinds of attributes to a target. Don't wrap it in any functions.

  .. code-block:: cmake

    qm_configure_target(<target>
        [SOURCES           <files>]

        [LINKS             <libs>]
        [LINKS_INTERFACE   <libs>]
        [LINKS_PRIVATE     <libs>]

        [INCLUDE           <dirs>]
        [INCLUDE_INTERFACE <dirs>]
        [INCLUDE_PRIVATE   <dirs>]

        [LINKDIR           <dirs>]
        [LINKDIR_INTERFACE <dirs>]
        [LINKDIR_PRIVATE   <dirs>]

        [DEFINES           <defs>]
        [DEFINES_INTERFACE <defs>]
        [DEFINES_PRIVATE   <defs>]

        [FEATURES           <features>]
        [FEATURES_INTERFACE <features>]
        [FEATURES_PRIVATE   <features>]

        [CCFLAGS           <flags>]
        [CCFLAGS_INTERFACE <flags>]
        [CCFLAGS_PUBLIC    <flags>]

        [LDFLAGS           <flags>]
        [LDFLAGS_INTERFACE <flags>]
        [LDFLAGS_PUBLIC    <flags>]

        [QT_LINKS            <modules>]
        [QT_LINKS_INTERFACE  <modules>]
        [QT_LINKS_PRIVATE    <modules>]

        [QT_INCLUDE_PRIVATE  <modules>]

        [SKIP_AUTOMOC   <dir/file...>]
    )

  INCLUDE/LINKDIR: ``dir/*`` will be expanded to all subdirectories
  ``dir/**`` will be expanded to all descendent directories recursively

  Scopes: for LINKS, INCLUDE, LINKDIR, DEFINES and FEATURES the bare name is
  public, and the _INTERFACE and _PRIVATE forms are the other two.

  CCFLAGS and LDFLAGS go the other way. The bare name is private, and public
  is spelt CCFLAGS_PUBLIC and LDFLAGS_PUBLIC. A compiler or linker flag is
  usually about how this target is built rather than about how to use it, so
  private is the answer wanted nearly every time and is what the short spelling
  gives. Worth knowing, since it is the one place here where the bare name does
  not mean public.
#]==]
macro(qm_configure_target _target)
    set(options)
    set(oneValueArgs)
    set(multiValueArgs
        SOURCES
        LINKS LINKS_INTERFACE LINKS_PRIVATE
        INCLUDE INCLUDE_INTERFACE INCLUDE_PRIVATE
        LINKDIR LINKDIR_INTERFACE LINKDIR_PRIVATE
        DEFINES DEFINES_INTERFACE DEFINES_PRIVATE
        FEATURES FEATURES_INTERFACE FEATURES_PRIVATE
        CCFLAGS CCFLAGS_INTERFACE CCFLAGS_PUBLIC
        LDFLAGS LDFLAGS_INTERFACE LDFLAGS_PUBLIC
        QT_LINKS QT_LINKS_PRIVATE QT_LINKS_INTERFACE
        QT_INCLUDE_PRIVATE
        SKIP_AUTOMOC
    )
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    get_target_property(_type ${_target} TYPE)
    set(_public_scope PUBLIC)
    set(_private_scope PRIVATE)

    # Interface libraries only accept interface scope.
    if(_type STREQUAL "INTERFACE_LIBRARY")
        set(_public_scope INTERFACE)
        set(_private_scope INTERFACE)
    else()
        target_sources(${_target} PRIVATE ${FUNC_SOURCES})
    endif()

    target_link_libraries(${_target} ${_public_scope} ${FUNC_LINKS})
    target_link_libraries(${_target} INTERFACE ${FUNC_LINKS_INTERFACE})
    target_link_libraries(${_target} ${_private_scope} ${FUNC_LINKS_PRIVATE})

    if(FUNC_INCLUDE)
        _qm_resolve_dir_helper("${FUNC_INCLUDE}" _temp_dirs)
        target_include_directories(${_target} ${_public_scope} ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    if(FUNC_INCLUDE_INTERFACE)
        _qm_resolve_dir_helper("${FUNC_INCLUDE_INTERFACE}" _temp_dirs)
        target_include_directories(${_target} INTERFACE ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    if(FUNC_INCLUDE_PRIVATE)
        _qm_resolve_dir_helper("${FUNC_INCLUDE_PRIVATE}" _temp_dirs)
        target_include_directories(${_target} ${_private_scope} ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    if(FUNC_LINKDIR)
        _qm_resolve_dir_helper("${FUNC_LINKDIR}" _temp_dirs)
        target_link_directories(${_target} ${_public_scope} ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    if(FUNC_LINKDIR_INTERFACE)
        _qm_resolve_dir_helper("${FUNC_LINKDIR_INTERFACE}" _temp_dirs)
        target_link_directories(${_target} INTERFACE ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    if(FUNC_LINKDIR_PRIVATE)
        _qm_resolve_dir_helper("${FUNC_LINKDIR_PRIVATE}" _temp_dirs)
        target_link_directories(${_target} ${_private_scope} ${_temp_dirs})
        unset(_temp_dirs)
    endif()

    target_compile_definitions(${_target} ${_public_scope} ${FUNC_DEFINES})
    target_compile_definitions(${_target} INTERFACE ${FUNC_DEFINES_INTERFACE})
    target_compile_definitions(${_target} ${_private_scope} ${FUNC_DEFINES_PRIVATE})

    target_compile_features(${_target} ${_public_scope} ${FUNC_FEATURES})
    target_compile_features(${_target} INTERFACE ${FUNC_FEATURES_INTERFACE})
    target_compile_features(${_target} ${_private_scope} ${FUNC_FEATURES_PRIVATE})

    # CMake won't add language standard flag if the compiler default mode supports the standard,
    # however, if the -std argument is not explicitly specified, the clang language server will
    # not work properly.
    # https://discourse.cmake.org/t/cmake-does-not-set-the-compiler-option-std-to-gnu17-or-c-17-although-i-set-the-target-compile-features-to-cxx-std-17/3299/8
    foreach(_item IN LISTS FUNC_FEATURES FUNC_FEATURES_PRIVATE)
        if(_item MATCHES "cxx_std_(.+)")
            set_property(TARGET ${_target} PROPERTY CXX_STANDARD ${CMAKE_MATCH_1})
        elseif(_item MATCHES "c_std_(.+)")
            set_property(TARGET ${_target} PROPERTY C_STANDARD ${CMAKE_MATCH_1})
        endif()
    endforeach()

    target_compile_options(${_target} ${_public_scope} ${FUNC_CCFLAGS_PUBLIC})
    target_compile_options(${_target} INTERFACE ${FUNC_CCFLAGS_INTERFACE})
    target_compile_options(${_target} ${_private_scope} ${FUNC_CCFLAGS})

    target_link_options(${_target} ${_public_scope} ${FUNC_LDFLAGS_PUBLIC})
    target_link_options(${_target} INTERFACE ${FUNC_LDFLAGS_INTERFACE})
    target_link_options(${_target} ${_private_scope} ${FUNC_LDFLAGS})

    qm_link_qt(${_target} ${_public_scope} ${FUNC_QT_LINKS})
    qm_link_qt(${_target} INTERFACE ${FUNC_QT_LINKS_INTERFACE})
    qm_link_qt(${_target} ${_private_scope} ${FUNC_QT_LINKS_PRIVATE})

    qm_include_qt_private(${_target} ${_private_scope} ${FUNC_QT_INCLUDE_PRIVATE})

    unset(_type)
    unset(_public_scope)
    unset(_private_scope)

    if(FUNC_SKIP_AUTOMOC)
        _qm_resolve_file_helper("${FUNC_SKIP_AUTOMOC}" _temp_files)
        qm_skip_automoc(${_temp_files})
        unset(_temp_files)
    endif()
endmacro()

#[==[.rst:
.. cmake:command:: qm_export_defines

  Helper to define export macros.

  .. code-block:: cmake

    qm_export_defines(<target>
        [PREFIX     <prefix>]
        [STATIC     <token>]
        [LIBRARY    <token>]
    )
#]==]
function(qm_export_defines _target)
    set(options)
    set(oneValueArgs PREFIX STATIC LIBRARY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(NOT FUNC_PREFIX)
        string(TOUPPER ${_target} _prefix)
    else()
        set(_prefix ${FUNC_PREFIX})
    endif()

    string(MAKE_C_IDENTIFIER ${_prefix} _prefix)

    qm_set_value(_static_macro FUNC_STATIC ${_prefix}_STATIC)
    qm_set_value(_library_macro FUNC_LIBRARY ${_prefix}_LIBRARY)

    get_target_property(_type ${_target} TYPE)

    if(_type STREQUAL "INTERFACE_LIBRARY")
        return()
    endif()

    if(_type STREQUAL "STATIC_LIBRARY")
        target_compile_definitions(${_target} PUBLIC ${_static_macro})
    endif()

    target_compile_definitions(${_target} PRIVATE ${_library_macro})
endfunction()

#[==[.rst:
.. cmake:command:: qm_add_win_rc

  Attach windows RC file to a target.

  .. code-block:: cmake

    qm_add_win_rc(<target>
        [NAME           name]
        [VERSION        version]
        [DESCRIPTION    desc]
        [COPYRIGHT      copyright]
        [ICON           ico]
        [OUTPUT_DIR     dir]
    )
#]==]
function(qm_add_win_rc _target)
    if(NOT WIN32)
        return()
    endif()

    _qm_return_unless_target_type(${_target} _ "EXECUTABLE" "SHARED_LIBRARY")

    set(options)
    set(oneValueArgs NAME VERSION DESCRIPTION COPYRIGHT ICON OUTPUT_DIR)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_name FUNC_NAME ${_target})
    qm_set_value(_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")
    qm_set_value(_desc FUNC_DESCRIPTION PROJECT_DESCRIPTION ${_name})
    qm_set_value(_copyright FUNC_COPYRIGHT ${_name})

    qm_parse_version(_ver ${_version})
    set(RC_VERSION ${_ver_1},${_ver_2},${_ver_3},${_ver_4})

    set(RC_APPLICATION_NAME ${_name})
    set(RC_VERSION_STRING ${_version})
    set(RC_DESCRIPTION ${_desc})
    set(RC_COPYRIGHT ${_copyright})

    if(NOT FUNC_ICON)
        set(RC_ICON_COMMENT "//")
        set(RC_ICON_PATH)
    else()
        get_filename_component(RC_ICON_PATH ${FUNC_ICON} ABSOLUTE)
    endif()

    qm_set_value(_out_dir FUNC_OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR})
    set(_out_path "${_out_dir}/${_target}_res.rc")
    configure_file("${QMSETUP_MODULES_DIR}/windows/WinResource.rc.in" ${_out_path} @ONLY)
    target_sources(${_target} PRIVATE ${_out_path})

    if(FUNC_ICON)
        if(${FUNC_ICON} IS_NEWER_THAN ${_out_path})
            file(TOUCH_NOCREATE ${_out_path})
        endif()
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_add_win_rc_enhanced

  Attach windows RC file to a target, enhanced edition.

  .. code-block:: cmake

    qm_add_win_rc_enhanced(<target>
        [NAME              name]
        [VERSION           version]
        [DESCRIPTION       description]
        [COPYRIGHT         copyright]
        [COMMENTS          comments]
        [COMPANY           company]
        [INTERNAL_NAME     internal name]
        [TRADEMARK         trademark]
        [ORIGINAL_FILENAME original filename]
        [ICONS             icon file paths]
        [OUTPUT_DIR        dir]
    )
#]==]
function(qm_add_win_rc_enhanced _target)
    if(NOT WIN32)
        return()
    endif()

    _qm_return_unless_target_type(${_target} _type "EXECUTABLE" "SHARED_LIBRARY")

    set(options)
    set(oneValueArgs
        NAME VERSION DESCRIPTION COPYRIGHT COMMENTS COMPANY
        INTERNAL_NAME TRADEMARK ORIGINAL_FILENAME OUTPUT_DIR
    )
    set(multiValueArgs ICONS)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_name FUNC_NAME ${_target})
    qm_set_value(_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")
    qm_set_value(_desc FUNC_DESCRIPTION PROJECT_DESCRIPTION ${_name})
    qm_set_value(_copyright FUNC_COPYRIGHT ${_name})
    qm_set_value(_comments FUNC_COMMENTS "")
    qm_set_value(_company FUNC_COMPANY "")
    qm_set_value(_internal_name FUNC_INTERNAL_NAME "")
    qm_set_value(_trademark FUNC_TRADEMARK "")
    qm_set_value(_original_filename FUNC_ORIGINAL_FILENAME "")

    qm_parse_version(_ver ${_version})
    set(RC_VERSION ${_ver_1},${_ver_2},${_ver_3},${_ver_4})

    set(RC_APPLICATION_NAME ${_name})
    set(RC_VERSION_STRING ${_version})
    set(RC_DESCRIPTION ${_desc})
    set(RC_COPYRIGHT ${_copyright})
    set(RC_COMMENTS ${_comments})
    set(RC_COMPANY ${_company})
    set(RC_INTERNAL_NAME ${_internal_name})
    set(RC_TRADEMARK ${_trademark})
    set(RC_ORIGINAL_FILENAME ${_original_filename})

    set(_file_type)

    if(_type STREQUAL "EXECUTABLE")
        set(_file_type "VFT_APP")
    else()
        set(_file_type "VFT_DLL")
    endif()

    set(RC_FILE_TYPE ${_file_type})

    set(_icons)

    if(FUNC_ICONS)
        set(_index 1)

        foreach(_icon IN LISTS FUNC_ICONS)
            get_filename_component(_icon_path ${_icon} ABSOLUTE)
            string(APPEND _icons "IDI_ICON${_index}    ICON    \"${_icon_path}\"\n")
            math(EXPR _index "${_index} +1")
        endforeach()
    endif()

    set(RC_ICONS ${_icons})

    qm_set_value(_out_dir FUNC_OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR})
    set(_out_path "${_out_dir}/${_target}_res.rc")
    configure_file("${QMSETUP_MODULES_DIR}/windows/WinResource2.rc.in" ${_out_path} @ONLY)
    target_sources(${_target} PRIVATE ${_out_path})

    foreach(_icon IN LISTS FUNC_ICONS)
        if(${_icon} IS_NEWER_THAN ${_out_path})
            file(TOUCH_NOCREATE ${_out_path})
            break()
        endif()
    endforeach()
endfunction()

#[==[.rst:
.. cmake:command:: qm_add_win_manifest

  Attach windows manifest file to a target.

  .. code-block:: cmake

    qm_add_win_manifest(<target>
        [NAME           name]
        [VERSION        version]
        [DESCRIPTION    desc]
        [OUTPUT_DIR     dir]
        [UTF8]
        [ADMIN]
    )
#]==]
function(qm_add_win_manifest _target)
    if(NOT WIN32)
        return()
    endif()

    _qm_return_unless_target_type(${_target} _ "EXECUTABLE")

    set(options UTF8 ADMIN)
    set(oneValueArgs NAME VERSION DESCRIPTION OUTPUT_DIR)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_name FUNC_NAME ${_target})
    qm_set_value(_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")
    qm_set_value(_desc FUNC_DESCRIPTION PROJECT_DESCRIPTION ${_name})

    qm_crop_version(_version ${_version} 4)

    set(MANIFEST_IDENTIFIER ${_name})
    set(MANIFEST_VERSION ${_version})
    set(MANIFEST_DESCRIPTION ${_desc})

    set(MANIFEST_UTF8)

    if(FUNC_UTF8)
        set(MANIFEST_UTF8 "<activeCodePage xmlns=\"http://schemas.microsoft.com/SMI/2019/WindowsSettings\">UTF-8</activeCodePage>")
    endif()

    if(FUNC_ADMIN)
        set(MANIFEST_PRIVILEGES "<requestedExecutionLevel level=\"requireAdministrator\" uiAccess=\"false\" />")
    else()
        set(MANIFEST_PRIVILEGES "<requestedExecutionLevel level=\"asInvoker\" uiAccess=\"false\" />")
    endif()

    qm_set_value(_out_dir FUNC_OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR})
    set(_out_path "${_out_dir}/${_target}_manifest.exe.manifest")
    configure_file("${QMSETUP_MODULES_DIR}/windows/WinManifest.manifest.in" ${_out_path} @ONLY)

    if(MSVC)
        if(CMAKE_GENERATOR MATCHES "Visual Studio")
            # The manifest goes to the linker as an input, and /manifestuac:no stops the linker
            # writing a UAC field of its own, this one carrying one already.
            target_link_options(${_target} PRIVATE
                "/manifest" "/manifestinput:${_out_path}" "/manifestuac:no"
            )
        else() # Ninja
            # https://cmake.org/cmake/help/latest/release/3.4.html#other
            # CMake learned to honor *.manifest source files with MSVC tools. Manifest files named as sources
            # of .exe and .dll targets will be merged with linker-generated manifests and embedded in the binary.

            # NOTE: CMake will automatically generate a default manifest file and embed it into the binary file
            # when we are using MSVC toolchain, so it will conflict with the one we embed in the RC file. So in
            # this case, we just follow the CMake documentation, add the manifest file into the sources and let
            # CMake handle it. What's more, CMake can automatically merge all manifest files so we can actually
            # add multiple manifest files, eg. each manifest file contains a separate section.
            target_sources(${_target} PRIVATE ${_out_path})
            target_link_options(${_target} PRIVATE "/manifestuac:no")
        endif()
    else()
        # For non-MSVC toolchains we can only embed the manifest file into the RC file, sadly we have
        # to merge all manifest files into one by ourself if we have multiple of them, but luckily
        # CMake won't embed a default one so we don't need to worry about resource conflicts.
        set(_manifest_rc ${_out_path}.rc)
        file(WRITE ${_manifest_rc} "#include <windows.h>\n\n1 RT_MANIFEST \"${_out_path}\"")
        target_sources(${_target} PRIVATE ${_manifest_rc})
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_add_mac_bundle

  Add Mac bundle info.

  .. code-block:: cmake

    qm_add_mac_bundle(<target>
        [NAME           <name>]
        [VERSION        <version>]
        [DESCRIPTION    <desc>]
        [COPYRIGHT      <copyright>]
        [ICON           <file>]
        [INFO_PLIST     <file>]
    )
#]==]
function(qm_add_mac_bundle _target)
    if(NOT APPLE)
        return()
    endif()

    _qm_return_unless_target_type(${_target} _ "EXECUTABLE")

    set(options)
    set(oneValueArgs NAME VERSION DESCRIPTION COPYRIGHT ICON INFO_PLIST)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_app_name FUNC_NAME ${_target})
    qm_set_value(_app_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")
    qm_set_value(_app_desc FUNC_DESCRIPTION PROJECT_DESCRIPTION ${_app_name})
    qm_set_value(_app_copyright FUNC_COPYRIGHT ${_app_name})

    qm_parse_version(_app_version ${_app_version})

    # configure mac plist
    set_target_properties(${_target} PROPERTIES
        MACOSX_BUNDLE TRUE
        OUTPUT_NAME ${_app_name}
        MACOSX_BUNDLE_BUNDLE_NAME ${_app_name}
        MACOSX_BUNDLE_EXECUTABLE_NAME ${_app_name}
        MACOSX_BUNDLE_INFO_STRING ${_app_desc}
        MACOSX_BUNDLE_GUI_IDENTIFIER ${_app_name}
        MACOSX_BUNDLE_BUNDLE_VERSION ${_app_version}
        MACOSX_BUNDLE_SHORT_VERSION_STRING ${_app_version_1}.${_app_version_2}
        MACOSX_BUNDLE_COPYRIGHT ${_app_copyright}
    )

    if(FUNC_INFO_PLIST)
        set_target_properties(${_target} PROPERTIES
            MACOSX_BUNDLE_INFO_PLIST ${FUNC_INFO_PLIST}
        )
    endif()

    if(FUNC_ICON)
        # And this part tells CMake where to find and install the file itself
        set_source_files_properties(${FUNC_ICON} PROPERTIES
            MACOSX_PACKAGE_LOCATION "Resources"
        )

        # NOTE: Don't include the path in MACOSX_BUNDLE_ICON_FILE -- this is
        # the property added to Info.plist
        get_filename_component(_icns_name ${FUNC_ICON} NAME)

        # configure mac plist
        set_target_properties(${_target} PROPERTIES
            MACOSX_BUNDLE_ICON_FILE ${_icns_name}
        )

        # ICNS icon MUST be added to executable's sources list, for some reason
        # Only apple can do
        target_sources(${_target} PRIVATE ${FUNC_ICON})
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_create_win_shortcut

  Generate Windows shortcut after building target.

  .. code-block:: cmake

    qm_create_win_shortcut(<target> <dir>
        [OUTPUT_NAME <name>]
    )
#]==]
function(qm_create_win_shortcut _target _dir)
    if(NOT WIN32)
        return()
    endif()

    set(options)
    set(oneValueArgs OUTPUT_NAME)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_output_name FUNC_OUTPUT_NAME $<TARGET_FILE_BASE_NAME:${_target}>)

    # One script per configuration, since a shortcut to a debug build and one to
    # a release build point at different files.
    set(_vbs_name ${CMAKE_CURRENT_BINARY_DIR}/${_target}_shortcut_$<CONFIG>.vbs)

    # A name of its own for the one configure_file writes, carrying no generator
    # expression. configure_file does not evaluate one, so a $<CONFIG> in the
    # name would be asked of the operating system as it stands, and an angle
    # bracket is among the characters a Windows file name may not hold.
    set(_vbs_temp ${CMAKE_CURRENT_BINARY_DIR}/${_target}_shortcut.vbs.in)

    set(_lnk_path "${_dir}/${_output_name}.lnk")

    set(SHORTCUT_PATH ${_lnk_path})
    set(SHORTCUT_TARGET_PATH $<TARGET_FILE:${_target}>)
    set(SHORTCUT_WORKING_DIRECTORY $<TARGET_FILE_DIR:${_target}>)
    set(SHORTCUT_DESCRIPTION $<TARGET_FILE_BASE_NAME:${_target}>)
    set(SHORTCUT_ICON_LOCATION $<TARGET_FILE:${_target}>)

    configure_file(
        "${QMSETUP_MODULES_DIR}/windows/WinCreateShortcut.vbs.in"
        ${_vbs_temp}
        @ONLY
    )
    file(GENERATE OUTPUT ${_vbs_name} INPUT ${_vbs_temp})

    # No BYPRODUCTS. A byproduct takes only a restricted set of generator
    # expressions and target dependent ones are not among them, so where
    # OUTPUT_NAME was not given and the path still held
    # $<TARGET_FILE_BASE_NAME:...> the generate step stopped, saying there was
    # no such target. Nothing ever depends on a shortcut, so all that declaring
    # it bought was having it removed by a clean, which is not worth a call that
    # does not work at all.
    add_custom_command(
        TARGET ${_target} POST_BUILD
        COMMAND cscript ${_vbs_name} ${QMSETUP_IGNORE_STDOUT}
        VERBATIM
    )
endfunction()

#[==[.rst:
.. cmake:command:: qm_collect_targets

  Collect targets of given types recursively in a directory.

  .. code-block:: cmake

    qm_collect_targets(<list> [DIRECTORY directory]
                              [EXECUTABLE] [SHARED]
                              [STATIC] [INTERFACE] [UTILITY])

  If one or more types are specified, return targets matching the types.
  If no type is specified, return all targets.
#]==]
function(qm_collect_targets _var)
    set(options EXECUTABLE SHARED STATIC INTERFACE UTILITY)
    set(oneValueArgs DIRECTORY)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(FUNC_DIRECTORY)
        set(_dir ${FUNC_DIRECTORY})
    else()
        set(_dir ${CMAKE_CURRENT_SOURCE_DIR})
    endif()

    # Get targets
    set(_tmp_targets)
    _qm_collect_targets_recursive(_tmp_targets ${_dir})
    set(_targets)

    if(NOT FUNC_EXECUTABLE AND NOT FUNC_SHARED AND NOT FUNC_STATIC AND NOT FUNC_INTERFACE AND NOT FUNC_UTILITY)
        set(_targets ${_tmp_targets})
    else()
        # Filter targets
        foreach(_item IN LISTS _tmp_targets)
            get_target_property(_type ${_item} TYPE)

            if(_type STREQUAL "EXECUTABLE")
                if(FUNC_EXECUTABLE)
                    list(APPEND _targets ${_item})
                endif()
            elseif(_type STREQUAL "SHARED_LIBRARY")
                if(FUNC_SHARED)
                    list(APPEND _targets ${_item})
                endif()
            elseif(_type STREQUAL "STATIC_LIBRARY")
                if(FUNC_STATIC)
                    list(APPEND _targets ${_item})
                endif()
            elseif(_type STREQUAL "INTERFACE_LIBRARY")
                if(FUNC_INTERFACE)
                    list(APPEND _targets ${_item})
                endif()
            elseif(_type STREQUAL "UTILITY")
                if(FUNC_UTILITY)
                    list(APPEND _targets ${_item})
                endif()
            endif()
        endforeach()
    endif()

    set(${_var} ${_targets} PARENT_SCOPE)
endfunction()

#[==[.rst:
.. cmake:command:: qm_get_subdirs

  Get subdirectories' names or paths.

  .. code-block:: cmake

    qm_get_subdirs(<list>
        [DIRECTORY dir]
        [EXCLUDE names...]
        [REGEX_INCLUDE exps...]
        [REGEX_EXCLUDE exps...]
        [RELATIVE path]
        [ABSOLUTE]
    )

  If ``DIRECTORY`` is not specified, consider ``CMAKE_CURRENT_SOURCE_DIR``.
  If ``RELATIVE`` is specified, return paths evaluated as a relative path to it.
  If ``ABSOLUTE`` is specified, return absolute paths.
  If neither of them is specified, return names.

  A directory is kept where it matches any of the ``REGEX_INCLUDE``
  expressions, and dropped where it matches any of the ``REGEX_EXCLUDE`` ones.
  Two names cannot both be true of one directory, so asking for two of them and
  getting what matches both would be asking for nothing.
#]==]
function(qm_get_subdirs _var)
    set(options ABSOLUTE)
    set(oneValueArgs DIRECTORY RELATIVE)
    set(multiValueArgs EXCLUDE REGEX_INCLUDE REGEX_EXCLUDE)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(FUNC_DIRECTORY)
        get_filename_component(_dir ${FUNC_DIRECTORY} ABSOLUTE)
    else()
        set(_dir ${CMAKE_CURRENT_SOURCE_DIR})
    endif()

    file(GLOB _entries LIST_DIRECTORIES true RELATIVE ${_dir} "${_dir}/*")

    if(FUNC_EXCLUDE)
        foreach(_exclude_dir IN LISTS FUNC_EXCLUDE)
            list(REMOVE_ITEM _entries ${_exclude_dir})
        endforeach()
    endif()

    # What matches any of them, rather than what matches all of them. Filtering
    # in a loop narrows the list each time round, so two expressions kept only
    # what satisfied both, and asking to include two different names gave
    # nothing. Excluding below is the other way about and does compose, since
    # leaving out this and also that is one thing after another.
    if(FUNC_REGEX_INCLUDE)
        set(_matching)

        foreach(_entry IN LISTS _entries)
            foreach(_exp IN LISTS FUNC_REGEX_INCLUDE)
                if(_entry MATCHES "${_exp}")
                    list(APPEND _matching "${_entry}")
                    break()
                endif()
            endforeach()
        endforeach()

        set(_entries ${_matching})
    endif()

    if(FUNC_REGEX_EXCLUDE)
        foreach(_exp IN LISTS FUNC_REGEX_EXCLUDE)
            list(FILTER _entries EXCLUDE REGEX ${_exp})
        endforeach()
    endif()

    set(_res)

    if(FUNC_RELATIVE)
        get_filename_component(_relative ${FUNC_RELATIVE} ABSOLUTE)
    else()
        set(_relative)
    endif()

    foreach(_sub IN LISTS _entries)
        if(IS_DIRECTORY ${_dir}/${_sub})
            if(FUNC_ABSOLUTE)
                list(APPEND _res ${_dir}/${_sub})
            elseif(_relative)
                file(RELATIVE_PATH _rel_path ${_relative} ${_dir}/${_sub})
                list(APPEND _res ${_rel_path})
            else()
                list(APPEND _res ${_sub})
            endif()
        endif()
    endforeach()

    set(${_var} ${_res} PARENT_SCOPE)
endfunction()

#[==[.rst:
.. cmake:command:: qm_basic_install

  Basic template to install a CMake project.

  .. code-block:: cmake

    qm_basic_install(
        [NAME <name>]
        [VERSION <version>]
        [COMPATIBILITY <compatibility>]
        [INSTALL_DIR <dir>]
        [CONFIG_TEMPLATE <file>]
        [NAMESPACE <namespace>]
        [EXPORT <sets...>]

        [WRITE_VERSION_OPTIONS <options...>]
        [WRITE_CONFIG_OPTIONS <options...>]
    )

  Include ``GNUInstallDirs``, ``CMakePackageConfigHelpers`` before calling this function.
#]==]
function(qm_basic_install)
    set(options)
    set(oneValueArgs NAME VERSION COMPATIBILITY INSTALL_DIR CONFIG_TEMPLATE NAMESPACE)
    set(multiValueArgs WRITE_VERSION_OPTIONS WRITE_CONFIG_OPTIONS EXPORT)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    qm_set_value(_lib_dir CMAKE_INSTALL_LIBDIR lib)

    qm_set_value(_name FUNC_NAME PROJECT_NAME "unknown")
    qm_set_value(_version FUNC_VERSION PROJECT_VERSION "0.0.0.0")
    qm_set_value(_compatibility FUNC_COMPATIBILITY AnyNewerVersion)
    qm_set_value(_install_dir FUNC_INSTALL_DIR "${_lib_dir}/cmake/${_name}")
    qm_set_value(_config_template FUNC_CONFIG_TEMPLATE "${CMAKE_CURRENT_LIST_DIR}/${_name}Config.cmake.in")

    set(_namespace)

    if(FUNC_NAMESPACE)
        set(_namespace NAMESPACE ${FUNC_NAMESPACE})
    endif()

    set(_export_files)

    # Install cmake targets files
    foreach(_item IN LISTS FUNC_EXPORT)
        install(EXPORT ${_item}
            FILE "${_item}.cmake"
            DESTINATION ${_install_dir}
            ${_namespace}
        )
        list(APPEND _export_files "${_item}.cmake")
    endforeach()

    # Prepare config template file
    get_filename_component(_config_template ${_config_template} ABSOLUTE)

    if(NOT EXISTS ${_config_template})
        set(_config_content "@PACKAGE_INIT@\n\n")

        foreach(_item IN LISTS _export_files)
            string(APPEND _config_content "include(\"\${CMAKE_CURRENT_LIST_DIR}/${_item}\")\n")
        endforeach()

        set(_config_template "${CMAKE_CURRENT_BINARY_DIR}/${_name}Config.cmake.in")
        file(WRITE ${_config_template} ${_config_content})
    endif()

    # Add version file
    write_basic_package_version_file(
        "${CMAKE_CURRENT_BINARY_DIR}/${_name}ConfigVersion.cmake"
        VERSION ${_version}
        COMPATIBILITY ${_compatibility}
        ${FUNC_WRITE_VERSION_OPTIONS}
    )

    # Add configuration file
    configure_package_config_file(
        ${_config_template}
        "${CMAKE_CURRENT_BINARY_DIR}/${_name}Config.cmake"
        INSTALL_DESTINATION ${_install_dir}
        ${FUNC_WRITE_CONFIG_OPTIONS}
    )

    # Install cmake files
    install(FILES
        "${CMAKE_CURRENT_BINARY_DIR}/${_name}Config.cmake"
        "${CMAKE_CURRENT_BINARY_DIR}/${_name}ConfigVersion.cmake"
        DESTINATION ${_install_dir}
    )
endfunction()

#[==[.rst:
.. cmake:command:: qm_include_recursive

  Recursively include directories in a target.

  .. code-block:: cmake

    qm_include_recursive(<target> <scope> <dir...>)

  Every directory under each one named becomes an include directory, with no
  filtering, so a tree carrying a .git or a build directory contributes those
  too. Name the directories that hold headers rather than the root of a
  checkout.
#]==]
function(qm_include_recursive _target _scope)
    foreach(_dir ${ARGN})
        if(IS_DIRECTORY ${_dir})
            target_include_directories(${_target} ${_scope} ${_dir})
            file(GLOB_RECURSE _subdirs LIST_DIRECTORIES TRUE RELATIVE ${_dir} ${_dir}/*)

            foreach(_subdir IN LISTS _subdirs)
                if(IS_DIRECTORY ${_dir}/${_subdir})
                    target_include_directories(${_target} ${_scope} ${_dir}/${_subdir})
                endif()
            endforeach()
        endif()
    endforeach()
endfunction()

#[==[.rst:
.. cmake:command:: qm_get_executable_location

  Get the location of an imported executable target.

  .. code-block:: cmake

    qm_get_executable_location(<target> <var>)

  Reads IMPORTED_LOCATION and the four configuration specific spellings of it,
  in that order, and takes the first that answers. A target built by this
  project has none of them, so this is for the ones a find_package brought,
  and it stops with an error rather than returning empty.
#]==]
function(qm_get_executable_location _target _var)
    set(_path)

    foreach(_type IMPORTED_LOCATION IMPORTED_LOCATION_RELEASE IMPORTED_LOCATION_RELWITHDEBINFO IMPORTED_LOCATION_MINSIZEREL IMPORTED_LOCATION_DEBUG)
        get_target_property(_path ${_target} ${_type})

        if(_path)
            break()
        endif()
    endforeach()

    if(NOT _path)
        message(FATAL_ERROR "Could not find imported location of target: ${_target}")
    endif()

    set(${_var} ${_path} PARENT_SCOPE)
endfunction()

# ----------------------------------
# Private functions
# ----------------------------------

# Every target in \a _dir and in the directories under it, appended to the list
# named by \a _out.
#
# A function rather than a macro, since a macro defined inside a function is
# defined for the whole project and redefined on every call, and its locals are
# the caller's. Recursion needs the answer carried back out, which is what the
# read and write of \a _out around the loop is for.
function(_qm_collect_targets_recursive _out _dir)
    set(_found ${${_out}})

    get_property(_subdirs DIRECTORY ${_dir} PROPERTY SUBDIRECTORIES)

    foreach(_subdir IN LISTS _subdirs)
        _qm_collect_targets_recursive(_found ${_subdir})
    endforeach()

    get_property(_current DIRECTORY ${_dir} PROPERTY BUILDSYSTEM_TARGETS)
    list(APPEND _found ${_current})

    set(${_out} ${_found} PARENT_SCOPE)
endfunction()
#[[
    Return from the calling function unless \a _target is one of the types named,
    and answer the type in \a _type where it is.

      _qm_return_unless_target_type(<target> <type_var> <type...>)

    A macro, since the return is the caller's. Named for that: called
    _qm_check_target_type_helper, nothing at a call site said that the lines
    after it might not run.

    ##FIXME A target of the wrong type is passed over without a word, so
    ##FIXME qm_add_win_rc on a static library does nothing and says nothing. A
    ##FIXME diagnostic belongs here, and is left out for now because projects
    ##FIXME already call these on whatever they have.
]] #
macro(_qm_return_unless_target_type _target _type)
    set(_tmp_target_type_list ${ARGN})
    get_target_property(_tmp_target_type ${_target} TYPE)

    if(NOT "${_tmp_target_type}" IN_LIST _tmp_target_type_list)
        return()
    endif()

    set(${_type} ${_tmp_target_type})
    unset(_tmp_target_type)
    unset(_tmp_target_type_list)
endmacro()

function(_qm_resolve_file_helper _items _out)
    set(_res)

    foreach(_item IN LISTS _items)
        string(GENEX_STRIP ${_item} _stripped_item)

        if(NOT _stripped_item STREQUAL _item)
            list(APPEND _res ${_item})
            continue()
        endif()

        if(_item STREQUAL "*")
            set(_cur_dir ".")
            file(GLOB _files LIST_DIRECTORIES true "*")
        elseif(_item STREQUAL "**")
            set(_cur_dir ".")
            file(GLOB_RECURSE _files LIST_DIRECTORIES true "*")
        elseif(_item MATCHES "(.+)[/\\]\\*$")
            set(_cur_dir ${CMAKE_MATCH_1})
            file(GLOB _files LIST_DIRECTORIES true "${_cur_dir}/*")
        elseif(_item MATCHES "(.+)[/\\]\\*\\*$")
            set(_cur_dir ${CMAKE_MATCH_1})
            file(GLOB_RECURSE _files LIST_DIRECTORIES true "${_cur_dir}/*")
        else()
            get_filename_component(_item ${_item} ABSOLUTE)
            list(APPEND _res ${_item})
            continue()
        endif()

        get_filename_component(_cur_dir ${_cur_dir} ABSOLUTE)
        list(APPEND _res ${_cur_dir})

        foreach(_item IN LISTS _files)
            get_filename_component(_item ${_item} ABSOLUTE)
            list(APPEND _res ${_item})
        endforeach()
    endforeach()

    set(${_out} ${_res} PARENT_SCOPE)
endfunction()

function(_qm_resolve_dir_helper _dirs _out)
    set(_files)
    # Emptied first. Its one caller is reached through a macro, so this runs in
    # the user's scope and a variable of the same name may already be there.
    set(_res)
    _qm_resolve_file_helper("${_dirs}" _files)

    foreach(_item IN LISTS _files)
        string(GENEX_STRIP ${_item} _stripped_item)

        if(NOT _stripped_item STREQUAL _item)
            list(APPEND _res ${_item})
        elseif(IS_DIRECTORY ${_item})
            list(APPEND _res ${_item})
        endif()
    endforeach()

    set(${_out} ${_res} PARENT_SCOPE)
endfunction()
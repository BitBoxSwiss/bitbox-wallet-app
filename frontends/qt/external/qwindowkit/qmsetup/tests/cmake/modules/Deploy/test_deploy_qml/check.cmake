# What qm_deploy_directory brought in for the QML module it was given.
#
# Included by testing/build.cmake once the tree exists. `_prefix` is where it
# was installed.

set(_library_dir "${_prefix}/qmtest_libs")
set(_qml_dir "${_prefix}/qmtest_qml")

# ------------------------------------------------------------------
# QML and QML_DIR
# ------------------------------------------------------------------

# A module is named relative to the directory Qt keeps them in and keeps that
# name where it lands, so what was under QtCore is under QtCore here.
qmtest_exists("the module description came along" "${_qml_dir}/QtCore/qmldir")
qmtest_exists("and so did the type description" "${_qml_dir}/QtCore/plugins.qmltypes")

qmtest_not_exists("and nothing was flattened into the top of the tree"
    "${_qml_dir}/qmldir")

# Where the modules would have gone had nothing said otherwise.
qmtest_not_exists("nor left where QML_DIR was there to override" "${_prefix}/qml")

# ------------------------------------------------------------------
# The plugin inside the module
# ------------------------------------------------------------------

# A file that is a binary goes through qmcorecmd rather than being copied, which
# is the whole reason the deployment has to look inside a module at all. Named
# by a pattern, a shared library being called something different on every
# platform.
file(GLOB _plugins "${_qml_dir}/QtCore/*qtqmlcoreplugin*")
set(_plugin_names)

foreach(_item IN LISTS _plugins)
    get_filename_component(_name "${_item}" NAME)
    list(APPEND _plugin_names "${_name}")
endforeach()

qmtest_true("the plugin the module loads came along" "${_plugin_names}")

# Going through qmcorecmd is what makes the difference: a plain copy would have
# left the Qt libraries the plugin asks for behind.
file(GLOB _deployed "${_library_dir}/*")
set(_qt_core)

foreach(_item IN LISTS _deployed)
    get_filename_component(_name "${_item}" NAME)

    if(_name MATCHES "Qt[0-9]*Core")
        list(APPEND _qt_core "${_name}")
    endif()
endforeach()

qmtest_true("and with it what it needs of Qt" "${_qt_core}")

# ------------------------------------------------------------------
# The debug build of the module
# ------------------------------------------------------------------

# Qt installs the debug plugin beside the release one on Windows, and what the
# deployment gathers is the release flavour. Elsewhere there is nothing beside
# it to leave out.
if(WIN32)
    qmtest_lacks("the debug plugin was left where it was" "${_plugin_names}"
        "qtqmlcoreplugind.dll")

    file(GLOB_RECURSE _symbols "${_qml_dir}/*.pdb")
    qmtest_equal("and so were the debug symbols" "${_symbols}" "")
endif()

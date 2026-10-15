# What qm_install_qml_modules put under the prefix.
#
# Included by testing/build.cmake, which builds and installs Release. `_prefix`
# is where it went.

# ------------------------------------------------------------------
# A module with a prefix of its own
# ------------------------------------------------------------------

set(_dir "${_prefix}/share/qml/QmTest")

qmtest_exists("the module's meta information arrives" "${_dir}/qmldir")
qmtest_exists("and its type information" "${_dir}/qmtest_qmlmod.qmltypes")

# The plugin is named by Qt and decorated by the platform, so it is looked for
# rather than spelt out.
file(GLOB _plugin "${_dir}/*qmtest_qmlmodplugin*")
qmtest_true("the runtime loadable plugin comes too" "${_plugin}")

# The QML files and the resources go through two loops of their own, one pairing
# each file with where it is to be deployed. A file arriving under its deploy
# path rather than its source path is what says those were read in step.
file(GLOB_RECURSE _qml_files RELATIVE "${_dir}" "${_dir}/*.qml")
qmtest_equal("the QML file lands at the path Qt deploys it to" "${_qml_files}" "Thing.qml")

file(GLOB_RECURSE _notes RELATIVE "${_dir}" "${_dir}/*.txt")
qmtest_equal("and a resource that is not QML lands beside it" "${_notes}" "note.txt")

# ------------------------------------------------------------------
# PREFIX, and what it is when nothing says
# ------------------------------------------------------------------

qmtest_not_exists("PREFIX is where the module goes" "${_prefix}/qml/QmTest/qmldir")

# ------------------------------------------------------------------
# A URI with a dot in it
# ------------------------------------------------------------------

# Qt answers a target path of QmTest/Nested for a URI of QmTest.Nested, and the
# function follows that rather than the URI, so the dot becomes a directory.
set(_nested "${_prefix}/qml/QmTest/Nested")

qmtest_exists("with nothing said the module goes under qml" "${_nested}/qmldir")
qmtest_exists("and its type information with it" "${_nested}/qmtest_qmlmod_nested.qmltypes")
qmtest_exists("a dotted URI becomes one directory per part" "${_nested}/Nested.qml")

qmtest_not_exists("rather than one directory with a dot in its name"
    "${_prefix}/qml/QmTest.Nested/qmldir")

# ------------------------------------------------------------------
# Optional module products
# ------------------------------------------------------------------

set(_no_plugin "${_prefix}/qml/QmTest/NoPlugin")
qmtest_exists("a module without a plugin still has its qmldir" "${_no_plugin}/qmldir")
qmtest_exists("and its QML file" "${_no_plugin}/NoPlugin.qml")
file(GLOB _no_plugin_binaries "${_no_plugin}/*qmtest_qmlmod_no_pluginplugin*")
qmtest_false("and no plugin was invented for it" "${_no_plugin_binaries}")

set(_no_types "${_prefix}/qml/QmTest/NoTypes")
qmtest_exists("a module without type information still has its qmldir" "${_no_types}/qmldir")
qmtest_exists("and its QML file too" "${_no_types}/NoTypes.qml")
qmtest_not_exists("and no type information file was invented"
    "${_no_types}/qmtest_qmlmod_no_types.qmltypes")
file(GLOB _no_types_plugin "${_no_types}/*qmtest_qmlmod_no_typesplugin*")
qmtest_false("and no plugin was invented for it" "${_no_types_plugin}")

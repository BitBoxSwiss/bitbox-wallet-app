# qm_install_qml_modules, against a real Qt.
#
# It is install rules and nothing else, so nothing short of a real install
# reaches any of it. Built and installed by testing/build.cmake and asserted in
# check.cmake.
#
# What it installs it learns from qt_query_qml_module rather than from its own
# arguments, so the two modules below are shaped to make that answer
# interesting: one has a QML file and a resource beside it, and the other has a
# dotted URI, which Qt turns into nested directories.
#
# AUTOMOC is on because qt_add_qml_module registers the module's types and
# refuses to without it.

cmake_minimum_required(VERSION 3.19)
project(qmtest_install_qml_modules CXX)

include(${QMSETUP_API})

qm_import(QtQml)

qm_find_qt(Qml)

set(CMAKE_AUTOMOC ON)

# Two modules in one directory would otherwise be built into the same place,
# which Qt refuses. Told where to start, it gives each one a directory named
# after its URI.
set(QT_QML_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qml")

# The prefix said out loud, so that what lands says whether PREFIX was read
# rather than whether the default happens to be right.
qt_add_qml_module(qmtest_qmlmod
    URI QmTest
    VERSION 1.0
    QML_FILES Thing.qml
    RESOURCES note.txt
)
qm_install_qml_modules(qmtest_qmlmod PREFIX share/qml)

# A dotted URI, which becomes one directory per part, and no PREFIX, so the
# default of "qml" is what decides where it goes.
qt_add_qml_module(qmtest_qmlmod_nested
    URI QmTest.Nested
    VERSION 1.0
    QML_FILES Nested.qml
)
qm_install_qml_modules(qmtest_qmlmod_nested)

# A module does not have to build a runtime plugin. An empty PLUGIN_TARGET from
# qt_query_qml_module means there is simply no plugin install rule to add.
qt_add_qml_module(qmtest_qmlmod_no_plugin
    URI QmTest.NoPlugin
    VERSION 1.0
    NO_PLUGIN
    QML_FILES NoPlugin.qml
)
qm_install_qml_modules(qmtest_qmlmod_no_plugin)

# Type information is optional too. The qmldir and QML file still have to be
# installed when no qmltypes file was generated.
qt_add_qml_module(qmtest_qmlmod_no_types
    URI QmTest.NoTypes
    VERSION 1.0
    NO_PLUGIN
    NO_GENERATE_QMLTYPES
    QML_FILES NoTypes.qml
)
qm_install_qml_modules(qmtest_qmlmod_no_types)

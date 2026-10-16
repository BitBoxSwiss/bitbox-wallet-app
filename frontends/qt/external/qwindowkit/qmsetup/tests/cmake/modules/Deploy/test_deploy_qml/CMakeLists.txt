# The QML half of qm_deploy_directory, against a real Qt.
#
# The other deployment test covers everything that can be asked for without a
# Qt installed, which is all of it but this: PLUGINS given EXTRA_PLUGIN_PATHS
# never reaches qmake, while QML always does, the modules being named relative
# to a directory only qmake can say where is.
#
# Registered only where tests/cmake/CMakeLists.txt found a Qt of 6.5 or later,
# and built and installed by testing/build.cmake. What is asserted is in
# check.cmake.
#
# QtCore is the module deployed. It is the smallest one Qt ships that is worth
# anything here, six files holding a qmldir, a type description and a plugin,
# so all three of what the deployment does with a QML module are reached:
# copying a file that is not a binary, handing one that is to qmcorecmd so that
# what it needs comes too, and leaving the debug build of it alone.

cmake_minimum_required(VERSION 3.19)
# C++ as well, nothing here being written in it but Qt6Config wanting it enabled
# to answer for itself.
project(qmtest_deploy_qml VERSION 1.0.0 LANGUAGES C CXX)

include(GNUInstallDirs)

include(${QMSETUP_API})

if(DEFINED QMCORECMD)
    set(QMSETUP_CORECMD_EXECUTABLE "${QMCORECMD}")
endif()

qm_import(Deploy)

# For Qt${QT_VERSION_MAJOR}::qmake, which is what tells the deployment where the
# QML modules are. Core is asked for rather than Qml, nothing here linking
# either and the qmake target coming with the first component found.
qm_find_qt(Core)

qm_get_executable_location(Qt${QT_VERSION_MAJOR}::qmake _qmake)

# Asked here as well, so that the search path can name where Qt keeps its
# libraries and the checks can be told which module was deployed rather than
# working it out again.
execute_process(COMMAND "${_qmake}" -query QT_INSTALL_QML
    OUTPUT_VARIABLE _qt_qml_dir
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY
)
execute_process(COMMAND "${_qmake}" -query QT_INSTALL_BINS
    OUTPUT_VARIABLE _qt_bin_dir
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY
)
execute_process(COMMAND "${_qmake}" -query QT_INSTALL_LIBS
    OUTPUT_VARIABLE _qt_lib_dir
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY
)

if(NOT EXISTS "${_qt_qml_dir}/QtCore/qmldir")
    message(FATAL_ERROR
        "This installation has no QtCore QML module under ${_qt_qml_dir}, so there is nothing "
        "for the test to deploy. It comes with qtdeclarative.")
endif()

add_executable(qmtest_qml_app src/app.c)

install(TARGETS qmtest_qml_app
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# Both directories, Windows keeping the shared libraries beside the tools and
# everywhere else keeping them apart. Whichever is the wrong one holds no Qt
# library and costs a look.
qm_deploy_directory("${CMAKE_INSTALL_PREFIX}"
    EXTRA_SEARCHING_PATHS "${_qt_bin_dir}" "${_qt_lib_dir}"
    LIBRARY_DIR "${CMAKE_INSTALL_PREFIX}/qmtest_libs"
    QML "QtCore"
    QML_DIR "${CMAKE_INSTALL_PREFIX}/qmtest_qml"
    STANDARD
    VERBOSE
    COMMENT "Deploying the QML modules the installed binaries need"
)

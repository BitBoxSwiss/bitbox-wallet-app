# Tests for the CMake layer, the qm_* functions in cmake/.
#
# Everything here sits where what it tests sits, so the tests for a module are
# where you would look for them:
#
#   cmake/QMSetupAPI.cmake          QMSetupAPI/
#   cmake/modules/Preprocess.cmake  modules/Preprocess/
#
# testing/ is the exception, being the only thing under here that is not a test:
# the assertions every test uses, and the two drivers that run the ones that are
# projects.
#
# There are three kinds, and each covers one group of functions:
#
#   test_*.cmake     a script, run with `cmake -P`. Nothing it checks needs a
#                    project to exist, so nothing configures or builds, and it
#                    finishes in hundredths of a second.
#
#   test_*/          a project, configured by testing/configure.cmake, for the
#                    functions that work on targets. The assertions are in its
#                    CMakeLists.txt, so a configure that stops is a test that
#                    failed. Nothing is built.
#
#   test_*/          with a check.cmake beside it, a project that is built and
#                    installed by testing/build.cmake, for the functions
#                    that work by adding install rules. The assertions are in
#                    check.cmake, which runs against the installed tree. These
#                    are the slowest here by a long way.
#
# Not covered:
#
#   qm_compiler_*, under modules/private, is left alone on purpose. Every one of
#   them is a list of compiler flags chosen per compiler, so a test could only
#   read the list back to itself, which says nothing about whether the flags are
#   the right ones. What would catch a mistake there is compiling with them,
#   which is a different kind of test from any of these.
#
#   Anything wanting Qt, protobuf or doxygen installed, and the standalone
#   scripts under cmake/scripts.

# ------------------------------------------------------------------
# Scripts
# ------------------------------------------------------------------

set(_scripts
    test_argument_keywords
    QMSetupAPI/test_import
    QMSetupAPI/test_version
    QMSetupAPI/test_values
    QMSetupAPI/test_subdirs
    modules/Filesystem/test_directories
    modules/Preprocess/test_definitions
    modules/Preprocess/test_generate_config
    modules/Preprocess/test_sync_include
    modules/Preprocess/test_build_info
)

# ------------------------------------------------------------------
# Projects that are configured
# ------------------------------------------------------------------

set(_configured_projects
    QMSetupAPI/test_targets
    modules/Preprocess/test_definition_scopes
    modules/private/InstallPackage/test_make_program
)

# Registered only where they do anything, rather than configuring a project
# whose every check is behind a platform test.
if(WIN32)
    list(APPEND _configured_projects QMSetupAPI/test_win_resources)
endif()

if(APPLE)
    list(APPEND _configured_projects QMSetupAPI/test_mac_bundle)
endif()

# ------------------------------------------------------------------
# Projects that are built and installed
# ------------------------------------------------------------------

set(_built_projects
    QMSetupAPI/test_basic_install
    modules/Filesystem/test_copy_command
    modules/Filesystem/test_future_configure_file
    modules/Preprocess/test_sync_include_install
    modules/Deploy/test_deploy_directory
    modules/private/Generate/test_binary_resource
)

if(WIN32)
    list(APPEND _built_projects modules/Deploy/test_win_applocal_deps)

    # qm_create_win_shortcut turns its script into a shortcut with cscript, and
    # does it at build time, so a machine that will not run one cannot build the
    # project at all and there would be nothing left to report on. Windows
    # Script Host is a feature on demand now and policy can switch it off, so
    # whether it works is asked here rather than assumed.
    #
    # Asked by doing the thing itself. That cscript is on the path says nothing
    # about whether it is allowed to run, and being allowed to run says nothing
    # about whether a shell link can be saved.
    set(_probe_dir "${CMAKE_CURRENT_BINARY_DIR}/wsh_probe")
    file(REMOVE_RECURSE "${_probe_dir}")
    file(MAKE_DIRECTORY "${_probe_dir}")
    file(WRITE "${_probe_dir}/probe.vbs"
        "Set oWS = WScript.CreateObject(\"WScript.Shell\")\n"
        "Set oLink = oWS.CreateShortcut(\"${_probe_dir}/probe.lnk\")\n"
        "oLink.TargetPath = \"${CMAKE_COMMAND}\"\n"
        "oLink.Save\n"
    )
    execute_process(COMMAND cscript //nologo "${_probe_dir}/probe.vbs"
        RESULT_VARIABLE _probe_result
        OUTPUT_QUIET
        ERROR_QUIET
    )

    if(_probe_result EQUAL 0 AND EXISTS "${_probe_dir}/probe.lnk")
        list(APPEND _built_projects QMSetupAPI/test_win_shortcut)
    else()
        message(STATUS
            "qmsetup tests: cscript will not make a shortcut here, so "
            "qm_create_win_shortcut is left untested")
    endif()
endif()

# ------------------------------------------------------------------
# The ones that want Qt
# ------------------------------------------------------------------

# Asked once, here, so that a machine without Qt registers nothing rather than
# registering tests that pass themselves over. Point CMake at an installation
# the ordinary way, with -DCMAKE_PREFIX_PATH=/path/to/Qt/<version>/<compiler>,
# and the same search path is handed to every project below.
find_package(QT NAMES Qt6 Qt5 COMPONENTS Core QUIET)

if(QT_FOUND)
    message(STATUS "qmsetup tests: Qt${QT_VERSION_MAJOR} ${QT_VERSION} at ${QT_DIR}")
    list(APPEND _configured_projects QMSetupAPI/test_qt_targets)
    list(APPEND _built_projects modules/QtLinguist/test_translation)

    # qm_install_qml_modules is built on qt_query_qml_module, which arrived in
    # Qt 6.5, so a Qt5 or an early Qt6 has nothing for it to call. The QML half
    # of qm_deploy_directory wants the same version for its own reason: the
    # module it deploys is QtCore, which arrived then as well.
    find_package(Qt${QT_VERSION_MAJOR} COMPONENTS Qml QUIET)

    if(TARGET Qt${QT_VERSION_MAJOR}::Qml AND QT_VERSION VERSION_GREATER_EQUAL 6.5)
        list(APPEND _built_projects
            modules/QtQml/test_install_qml_modules
            modules/Deploy/test_deploy_qml
        )
    else()
        message(STATUS "qmsetup tests: no Qml module, or a Qt older than 6.5, so "
            "qm_install_qml_modules and the QML half of qm_deploy_directory are left untested")
    endif()
else()
    message(STATUS "qmsetup tests: no Qt found, so the functions that want one are left untested. "
        "Pass -DCMAKE_PREFIX_PATH=/path/to/Qt/<version>/<compiler> to have them run.")
endif()

# ------------------------------------------------------------------
# The one that wants protobuf
# ------------------------------------------------------------------

# Both ways, since neither reaches every protobuf. One built and installed the
# upstream way, which is what vcpkg ships, answers CONFIG and gives module mode
# the libraries without protobuf::protoc. A distribution package is the other
# way about: Ubuntu's libprotobuf-dev carries no CMake configuration at all, so
# CONFIG cannot find it, while FindProtobuf looks for the compiler on the path
# and makes the target out of what it finds.
#
# CONFIG first, and module mode only if that found nothing. The other order is
# an error, the second call stopping on targets the first has already defined.
find_package(Protobuf CONFIG QUIET)

if(NOT TARGET protobuf::protoc)
    find_package(Protobuf QUIET)
endif()

if(TARGET protobuf::protoc)
    # Where the compiler is rather than where the package was found. Module mode
    # leaves Protobuf_DIR not found, having no package to point at.
    get_target_property(_protoc_location protobuf::protoc LOCATION)
    message(STATUS "qmsetup tests: protobuf ${Protobuf_VERSION}, protoc at ${_protoc_location}")
    list(APPEND _built_projects modules/Protobuf/test_create_protobuf)
else()
    message(STATUS "qmsetup tests: no protobuf compiler found, so qm_create_protobuf is left "
        "untested. Name an installation in CMAKE_PREFIX_PATH to have it run.")
endif()

# Escaped, since this travels as one argument of a test command and a search
# path may name more than one place.
string(REPLACE ";" "\\;" _qmtest_prefix_path "${CMAKE_PREFIX_PATH}")

# ------------------------------------------------------------------
# Registration
# ------------------------------------------------------------------

# The path is the name, so a failure says which directory to open.
function(qmtest_cmake_add _module _driver)
    string(REPLACE "/" "." _name ${_module})

    add_test(NAME cmake.${_name}
        COMMAND ${CMAKE_COMMAND}
            -DQMSETUP_API=${QMSETUP_PROJECT_ROOT}/cmake/QMSetupAPI.cmake
            -DQMCORECMD=$<TARGET_FILE:qmcorecmd>
            # Passed in rather than found relative to the test, which would have
            # every file counting how deep it sits.
            -DQMTEST_HARNESS=${CMAKE_CURRENT_SOURCE_DIR}/testing/harness.cmake
            -DQMTEST_WORK_DIR=${CMAKE_CURRENT_BINARY_DIR}/${_module}/work
            -DQMTEST_PROJECT=${CMAKE_CURRENT_SOURCE_DIR}/${_module}
            -DQMTEST_PROJECT_BUILD=${CMAKE_CURRENT_BINARY_DIR}/${_module}/build
            -DQMTEST_INSTALL_PREFIX=${CMAKE_CURRENT_BINARY_DIR}/${_module}/prefix
            -DQMTEST_GENERATOR=${CMAKE_GENERATOR}
            -DQMTEST_C_COMPILER=${CMAKE_C_COMPILER}
            -DQMTEST_CXX_COMPILER=${CMAKE_CXX_COMPILER}
            -DQMTEST_PREFIX_PATH=${_qmtest_prefix_path}
            -P ${_driver}
    )
    set_tests_properties(cmake.${_name} PROPERTIES
        LABELS cmake
        # The default is 1500 seconds, long enough for a hang to pass for slowness. Fifteen
        # seconds at the worst measured on CI, which is test_install_qml_modules configuring and
        # building a QML project, so anything still running at two minutes is stuck. One number
        # for all of them, a script that finishes in hundredths of a second being the same kind
        # of stuck at two minutes as a project that takes fifteen.
        TIMEOUT 120
    )
endfunction()

foreach(_module IN LISTS _scripts)
    qmtest_cmake_add(${_module} ${CMAKE_CURRENT_SOURCE_DIR}/${_module}.cmake)
endforeach()

foreach(_module IN LISTS _configured_projects)
    qmtest_cmake_add(${_module} ${CMAKE_CURRENT_SOURCE_DIR}/testing/configure.cmake)
endforeach()

foreach(_module IN LISTS _built_projects)
    qmtest_cmake_add(${_module} ${CMAKE_CURRENT_SOURCE_DIR}/testing/build.cmake)
endforeach()

# This project deliberately makes its install fail, so it has a driver that
# treats the nonzero install result as the expected behavior.
qmtest_cmake_add(modules/Filesystem/test_copy_command_failure
    ${CMAKE_CURRENT_SOURCE_DIR}/testing/install_failure.cmake)

# qm_deploy_directory, which gathers what an installed tree needs to run.
#
# It works by adding an install rule that runs windeps.bat or unixdeps.sh, which
# runs qmcorecmd, so nothing short of a real install exercises any of it. The
# project is built and installed by testing/build.cmake and what it left
# behind is asserted in check.cmake.
#
# The application is installed. The library it links is deliberately not, which
# is the only reason the deployment has anything to do.

cmake_minimum_required(VERSION 3.19)
project(qmtest_deploy_directory VERSION 1.0.0 LANGUAGES C)

include(GNUInstallDirs)

include(${QMSETUP_API})

if(DEFINED QMCORECMD)
    set(QMSETUP_CORECMD_EXECUTABLE "${QMCORECMD}")
endif()

qm_import(Deploy)

add_library(qmtest_extra_lib SHARED src/extra.c)
target_include_directories(qmtest_extra_lib PUBLIC src)

add_executable(qmtest_deploy_app src/app.c)
target_link_libraries(qmtest_deploy_app PRIVATE qmtest_extra_lib)

# Both in one place, so that the deployment has one directory to be told about
# rather than several.
set_target_properties(qmtest_extra_lib qmtest_deploy_app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/built"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/built"
)

install(TARGETS qmtest_deploy_app
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# Linked by nothing, so following the graph from the application never arrives
# at it and only EXTRA_LIBRARIES brings it.
add_library(qmtest_loose_lib SHARED src/loose.c)
target_include_directories(qmtest_loose_lib PUBLIC src)
set_target_properties(qmtest_loose_lib PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/built"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/built"
)

# A plugin, in the shape the scripts underneath look for: a category directory
# with the library inside it, named `lib<name>.*` on Unix and `<name>.dll` on
# Windows. The prefix is dropped on Windows for that reason, which is also what
# Qt does with its own plugins, MinGW otherwise writing libqmtest_svgicon.dll
# where windeps.bat asks for qmtest_svgicon.dll and finds nothing.
add_library(qmtest_svgicon SHARED src/plugin.c)
target_include_directories(qmtest_svgicon PUBLIC src)
set_target_properties(qmtest_svgicon PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qmtest_plugins/iconengines"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qmtest_plugins/iconengines"
)

if(WIN32)
    set_target_properties(qmtest_svgicon PROPERTIES PREFIX "")
endif()

# EXTRA_LIBRARIES is matched against what is on disk while the project is being
# read, so it cannot name anything this build has yet to make. What it is for is
# a binary that was already there, and a real one is needed rather than a file
# with the right name, the deployment reading each thing it copies. qmcorecmd
# is one, and the test is handed its path anyway.
get_filename_component(_prebuilt_name "${QMSETUP_CORECMD_EXECUTABLE}" NAME)
file(COPY "${QMSETUP_CORECMD_EXECUTABLE}" DESTINATION "${CMAKE_BINARY_DIR}/prebuilt")

# PLUGINS with EXTRA_PLUGIN_PATHS asks for no qmake, which is what lets the
# plugin half of this run without a Qt. QML is the part that cannot.
qm_deploy_directory("${CMAKE_INSTALL_PREFIX}"
    EXTRA_SEARCHING_PATHS "${CMAKE_BINARY_DIR}/built" "${CMAKE_BINARY_DIR}/prebuilt"
    LIBRARY_DIR "${CMAKE_INSTALL_PREFIX}/qmtest_libs"
    EXTRA_LIBRARIES "${_prebuilt_name}"
    PLUGINS "iconengines/qmtest_svgicon"
    PLUGIN_DIR "${CMAKE_INSTALL_PREFIX}/qmtest_plugins"
    EXTRA_PLUGIN_PATHS "${CMAKE_BINARY_DIR}/qmtest_plugins"
    STANDARD
    VERBOSE
    COMMENT "Deploying what the installed binaries need"
)

# What the platform decided to call these, for check.cmake to read rather than
# guess at. Windows is not one naming scheme: MSVC writes qmtest_extra_lib.dll
# and MinGW writes libqmtest_extra_lib.dll, so a name spelt out in the checks
# was right for whichever compiler happened to be at hand.
#
# A quoted string rather than a bracket one, since the last of these is settled
# while the project is being read and the others only when it is generated.
file(GENERATE OUTPUT "${CMAKE_BINARY_DIR}/built_names.cmake" CONTENT
"set(_extra_name \"$<TARGET_FILE_NAME:qmtest_extra_lib>\")
set(_loose_name \"$<TARGET_FILE_NAME:qmtest_loose_lib>\")
set(_plugin_name \"$<TARGET_FILE_NAME:qmtest_svgicon>\")
set(_prebuilt_name \"${_prebuilt_name}\")
")

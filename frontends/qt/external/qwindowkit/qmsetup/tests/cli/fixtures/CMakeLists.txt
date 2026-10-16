# The binaries the deploy tests run against.
#
# `qmcorecmd deploy` finds what shared libraries a binary needs and copies them
# somewhere. Testing that needs real binaries, so this builds them. They do
# nothing at all. What matters is who links whom, and where each one sits,
# because that is what a deployment has to work out.
#
# The shape is the one a program has after it is installed alongside an SDK it
# uses. Read the SDK as Qt and it is the familiar case: an application that
# links one has to carry its libraries and its plugins, and the plugins are
# linked by nothing, so following the graph never finds them. They are named on
# the command line instead.
#
# A name says where a thing sits. The prefix is the tree it belongs to, which is
# also the directory that tree is in, so the two cannot drift apart. The rest of
# the name says what it is doing in the graph:
#
#   _exe            the executable, which nothing links
#   _lib            what the executable links, and the way into the tree
#   _leaf           reached only through _lib, so a resolver that stops after
#                   one level never sees it
#   _alone          linked by nothing at all
#   _plugin         a plugin, linked by nothing, that needs its own tree
#   _plugin_<tree>  a plugin that reaches into the tree named
#   _plugin_alone   the plugin that drags _alone in with it
#
#   app/bin/            qmtest_app_exe          links app_lib
#                       qmtest_app_lib          links app_leaf and sdk_lib
#                       qmtest_app_leaf         a leaf
#   app/lib/plugins/    qmtest_app_plugin       needs app_lib
#                       qmtest_app_plugin_sdk   needs sdk_lib, so a plugin of
#                                               mine reaches across the boundary
#
#   sdk/bin/            qmtest_sdk_lib          links sdk_leaf
#                       qmtest_sdk_leaf         a leaf
#                       qmtest_sdk_alone        a leaf nothing of mine reaches
#   sdk/lib/plugins/    qmtest_sdk_plugin       needs sdk_lib
#                       qmtest_sdk_plugin_alone needs sdk_alone
#
# So the application links app_lib and nothing else, and everything else is two
# or three steps behind it: app_leaf and sdk_lib through app_lib, sdk_leaf
# through sdk_lib. A resolver that reads one level deep finds app_lib and stops.
#
# sdk_alone is the one nothing links. No amount of following the graph from the
# application arrives at it, and it is there only because sdk_plugin_alone wants
# it. That is the case plugin deployment exists for: naming the plugin has to
# bring a library along that nothing else asked for.
#
# What a build leaves behind is that tree, laid out under this file's build
# directory rather than flattened into one place. On Windows:
#
#   app/bin/            qmtest_app_exe.exe qmtest_app_lib.dll qmtest_app_leaf.dll
#   app/lib/plugins/    qmtest_app_plugin.dll qmtest_app_plugin_sdk.dll
#   sdk/bin/            qmtest_sdk_lib.dll qmtest_sdk_leaf.dll qmtest_sdk_alone.dll
#   sdk/lib/plugins/    qmtest_sdk_plugin.dll qmtest_sdk_plugin_alone.dll
#
# Elsewhere the platform decorates them its own way, as qmtest_app_exe and
# libqmtest_app_lib.so, or libqmtest_app_lib.dylib on macOS. That is why the
# tests name artifacts rather than files, and why nothing here carries a debug
# postfix. The qmtest_ prefix is there so that no fixture is ever named like
# something in C:\Windows\System32, which a deployment filters out on sight and
# would turn into a failure on one machine and not another.
#
# A test copies both trees into a sandbox of its own, keeping the structure. It
# does not rearrange them, because the arrangement is the point. Which command
# lines are run against it, and what each should leave behind, are declared in
# ../deploy_scenarios.json, and the names there have to agree with these.

# Symbols are exported by hand in fixture.h rather than wholesale, because
# CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS does not cover MODULE libraries, and a
# plugin entry point with no caller and no export is dropped by the linker,
# taking with it the very import that makes the plugin worth deploying.

set(_fixture_root ${CMAKE_CURRENT_BINARY_DIR})

# Where a binary goes, and what it has to be able to find from there.
#
# On Unix a binary carries its own search path, and CMake would write the build
# tree's absolute directories into it. That would let every fixture find every
# other one wherever it was copied to, which is exactly what these tests must
# not have. Each one is given a relative path instead, worked out from where it
# sits in the tree above, so that resolving depends on the layout rather than
# on where the build happened.
if(APPLE)
    set(_origin "@loader_path")
else()
    set(_origin "$ORIGIN")
endif()

set(_app_bin           app/bin)
set(_app_plugins       app/lib/plugins)
set(_sdk_bin           sdk/bin)
set(_sdk_plugins       sdk/lib/plugins)

# app/bin goes up two to the root and across to sdk/bin.
set(_app_bin_rpath     "${_origin};${_origin}/../../sdk/bin")
# app/lib/plugins goes up two to app/bin, and three to the root.
set(_app_plugins_rpath "${_origin};${_origin}/../../bin;${_origin}/../../../sdk/bin")
set(_sdk_bin_rpath     "${_origin}")
# sdk/lib/plugins goes up two to sdk/bin.
set(_sdk_plugins_rpath "${_origin};${_origin}/../../bin")

# name, kind, output directory, rpath
function(qmtest_fixture name kind directory rpath)
    if(kind STREQUAL "application")
        add_executable(qmtest_${name} ${name}.c)
    elseif(kind STREQUAL "plugin")
        add_library(qmtest_${name} MODULE ${name}.c)
    else()
        add_library(qmtest_${name} SHARED ${name}.c)
    endif()

    target_link_libraries(qmtest_${name} PRIVATE ${ARGN})

    set_target_properties(qmtest_${name} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${_fixture_root}/${directory}"
        LIBRARY_OUTPUT_DIRECTORY "${_fixture_root}/${directory}"
        # No configuration in the name. The tests look these up by what they
        # are, and a debug postfix would make that depend on how the project
        # was configured.
        DEBUG_POSTFIX ""
        SKIP_BUILD_RPATH ON
        BUILD_WITH_INSTALL_RPATH ON
        INSTALL_RPATH "${rpath}"
    )
    if(APPLE)
        set_target_properties(qmtest_${name} PROPERTIES INSTALL_NAME_DIR "@rpath")
    endif()
    if(MSVC)
        # A static runtime keeps the import tables down to what these actually
        # depend on, so that what a test sees does not turn on which C runtime
        # the machine happens to have.
        set_target_properties(qmtest_${name} PROPERTIES
            MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>"
        )
    endif()
endfunction()

# Theirs first, since mine link it.
qmtest_fixture(sdk_leaf         library     "${_sdk_bin}"      "${_sdk_bin_rpath}")
qmtest_fixture(sdk_alone        library     "${_sdk_bin}"      "${_sdk_bin_rpath}")
qmtest_fixture(sdk_lib          library     "${_sdk_bin}"      "${_sdk_bin_rpath}"     qmtest_sdk_leaf)
qmtest_fixture(sdk_plugin       plugin      "${_sdk_plugins}"  "${_sdk_plugins_rpath}" qmtest_sdk_lib)
qmtest_fixture(sdk_plugin_alone plugin      "${_sdk_plugins}"  "${_sdk_plugins_rpath}" qmtest_sdk_alone)

qmtest_fixture(app_leaf         library     "${_app_bin}"      "${_app_bin_rpath}")
qmtest_fixture(app_lib          library     "${_app_bin}"      "${_app_bin_rpath}"     qmtest_app_leaf qmtest_sdk_lib)
qmtest_fixture(app_exe          application "${_app_bin}"      "${_app_bin_rpath}"     qmtest_app_lib)
qmtest_fixture(app_plugin       plugin      "${_app_plugins}"  "${_app_plugins_rpath}" qmtest_app_lib)
qmtest_fixture(app_plugin_sdk   plugin      "${_app_plugins}"  "${_app_plugins_rpath}" qmtest_sdk_lib)

# A real framework bundle, which is a shape only macOS has.
#
# Deploying one is not deploying a file. The bundle is a directory, the library is inside it
# under Versions/A, and what a binary names is @rpath/Name.framework/Versions/A/Name. A whole
# body of code in the deployment exists for that, and nothing above reaches any of it, so this
# tree is here on its own rather than being worked into the graph above. Nothing links it but
# the one application beside it, and no declared scenario mentions it.
if(APPLE)
    set(_framework_dir "${_fixture_root}/frameworks")

    # A bundle takes a fair amount of saying, so it is said once.
    #
    # The header is a source as well as a PUBLIC_HEADER. Named only as the latter it is placed
    # when installing rather than when building, and the bundle comes out without a Headers
    # directory at all, which a deployment is meant to leave behind and cannot be seen to.
    function(qmtest_framework name)
        add_library(qmtest_${name} SHARED ${name}.c ${name}.h)
        target_link_libraries(qmtest_${name} PRIVATE ${ARGN})
        set_target_properties(qmtest_${name} PROPERTIES
            FRAMEWORK TRUE
            FRAMEWORK_VERSION A
            MACOSX_FRAMEWORK_IDENTIFIER org.stdware.qmtest.${name}
            PUBLIC_HEADER ${name}.h
            LIBRARY_OUTPUT_DIRECTORY "${_framework_dir}"
            DEBUG_POSTFIX ""
            SKIP_BUILD_RPATH ON
            BUILD_WITH_INSTALL_RPATH ON
            INSTALL_NAME_DIR "@rpath"
            INSTALL_RPATH "${_origin}/../../.."
        )
    endfunction()

    # An ordinary shared library that a framework needs, so that the walk leaves a bundle as well
    # as entering one.
    add_library(qmtest_fw_plain SHARED fw_plain.c)
    set_target_properties(qmtest_fw_plain PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${_framework_dir}"
        DEBUG_POSTFIX ""
        SKIP_BUILD_RPATH ON
        BUILD_WITH_INSTALL_RPATH ON
        INSTALL_NAME_DIR "@rpath"
    )

    # fw_exe -> fw_lib.framework -> fw_deep.framework
    #                            -> fw_plain
    #
    # Three levels, and the middle one is a bundle. Reaching fw_deep or fw_plain means going into
    # fw_lib for the library inside it, reading what that names, and coming back out to a bundle
    # again. One level of framework never asks for any of that.
    qmtest_framework(fw_deep)
    qmtest_framework(fw_lib qmtest_fw_deep qmtest_fw_plain)

    # Linked by nothing. It is the framework equivalent of sdk_alone above: no amount of following
    # the graph arrives at it, so the only way it is ever deployed is by being named with -c,
    # and that is a different path through the deployment.
    qmtest_framework(fw_alone)

    add_executable(qmtest_fw_exe fw_exe.c)
    target_link_libraries(qmtest_fw_exe PRIVATE qmtest_fw_lib)
    set_target_properties(qmtest_fw_exe PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${_framework_dir}"
        DEBUG_POSTFIX ""
        SKIP_BUILD_RPATH ON
        BUILD_WITH_INSTALL_RPATH ON
        INSTALL_RPATH "${_origin}"
    )

    set(QMSETUP_TEST_FRAMEWORK_DIR "${_framework_dir}" PARENT_SCOPE)
endif()

# The tests are told where the tree ended up, whatever the generator decided.
set(QMSETUP_TEST_FIXTURE_DIR "${_fixture_root}" PARENT_SCOPE)

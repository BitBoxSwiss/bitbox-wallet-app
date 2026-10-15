project(test_auto LANGUAGES CXX)

find_package(Boost CONFIG COMPONENTS unit_test_framework)

# Fatal rather than a warning and a return. Somebody who set STDC_BUILD_TESTS=ON and got a green
# build with no tests in it has been told nothing, which is how six CI jobs came back passing
# while running not one case.
if(NOT Boost_FOUND)
    message(FATAL_ERROR
        "STDC_BUILD_TESTS is on but Boost.Test was not found. Install it, or point CMake at it "
        "with -DCMAKE_PREFIX_PATH, or turn the tests off with -DSTDC_BUILD_TESTS=OFF.")
endif()

file(GLOB _common_src *.cpp)
file(GLOB_RECURSE _subdir_src
    support/*.cpp
    adt/*.cpp
    stlextra/*.cpp
)

if(WIN32)
    file(GLOB _platform_src platform/windows/*.cpp)
else()
    set(_platform_src)
endif()

set(_src ${_common_src} ${_subdir_src} ${_platform_src})
add_executable(${PROJECT_NAME} ${_src})

target_link_libraries(${PROJECT_NAME} PRIVATE Boost::unit_test_framework)

target_link_libraries(${PROJECT_NAME} PRIVATE stdcorelib)
target_link_libraries(${PROJECT_NAME} PRIVATE test_staticregistry_hub)

# Some tests reach into private headers (src/*_p.h) to cover internals that the public API
# cannot get at on its own.
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../../src)

set_target_properties(${PROJECT_NAME} PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# Two modules loaded at run time, one per suite that needs a second binary to ask its question.
# Whether a value keeps its identity across a module boundary, and whether a registry reached
# from two modules is one registry, cannot be answered from inside one binary.
#
# Their visibility is hidden on purpose: that is the configuration in which identity schemes
# built on comparing addresses come apart.
foreach(_plugin any dynamicregistry)
    add_library(test_${_plugin}_plugin MODULE plugins/test_${_plugin}_plugin.cpp)
    target_link_libraries(test_${_plugin}_plugin PRIVATE stdcorelib)
    set_target_properties(test_${_plugin}_plugin PROPERTIES
        CXX_EXTENSIONS OFF
        CXX_STANDARD 17
        CXX_STANDARD_REQUIRED ON
        CXX_VISIBILITY_PRESET hidden
        VISIBILITY_INLINES_HIDDEN ON
        LIBRARY_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
    )
endforeach()

# A module for the SharedLibrary tests, which have to watch one being loaded and unloaded. It
# cannot be either of the two above: a module another suite left loaded answers "still loaded"
# whatever ownership did. Nothing else in the binary touches this one, so what it says is about
# the case that is asking.
add_library(test_sharedlibrary_unloadable MODULE plugins/test_sharedlibrary_unloadable.cpp)
target_include_directories(test_sharedlibrary_unloadable PRIVATE ${stdcorelib_SOURCE_DIR}/include)
set_target_properties(test_sharedlibrary_unloadable PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

# A second one for PreventUnloadHint, which cannot share the first: a module that was pinned
# stays for the life of the process by definition, so the case would leave every later question
# about the first one answered before it was asked.
add_library(test_sharedlibrary_pinned MODULE plugins/test_sharedlibrary_unloadable.cpp)
target_include_directories(test_sharedlibrary_pinned PRIVATE ${stdcorelib_SOURCE_DIR}/include)
set_target_properties(test_sharedlibrary_pinned PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

# A module with a private dependency, both put in a directory of their own rather than beside the
# test binary. That directory is on no search path the loader consults by default, which is the
# whole point: without SearchLibraryLoadDirectoryHint the dependency is not found on Windows.
#
# On POSIX the module carries $ORIGIN in its rpath, which is how the same layout is made to work
# there, so the case can ask whether the hint changes anything rather than whether it is needed.
set(_private_dir ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/privatedeps)

add_library(test_sharedlibrary_dependency SHARED plugins/test_sharedlibrary_dependency.cpp)
target_include_directories(test_sharedlibrary_dependency PRIVATE ${stdcorelib_SOURCE_DIR}/include)
set_target_properties(test_sharedlibrary_dependency PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    LIBRARY_OUTPUT_DIRECTORY ${_private_dir}
    RUNTIME_OUTPUT_DIRECTORY ${_private_dir}
)

add_library(test_sharedlibrary_needs_dependency MODULE plugins/test_sharedlibrary_needs_dependency.cpp)
target_include_directories(test_sharedlibrary_needs_dependency PRIVATE ${stdcorelib_SOURCE_DIR}/include)
target_link_libraries(test_sharedlibrary_needs_dependency PRIVATE test_sharedlibrary_dependency)
set_target_properties(test_sharedlibrary_needs_dependency PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    LIBRARY_OUTPUT_DIRECTORY ${_private_dir}
    RUNTIME_OUTPUT_DIRECTORY ${_private_dir}
)
if(APPLE)
    # dyld does not know $ORIGIN. @loader_path is the one that means the same thing.
    set(_own_dir "@loader_path")
else()
    set(_own_dir "$ORIGIN")
endif()
if(NOT WIN32)
    set_target_properties(test_sharedlibrary_needs_dependency PROPERTIES
        BUILD_RPATH "${_own_dir}"
        INSTALL_RPATH "${_own_dir}"
        BUILD_WITH_INSTALL_RPATH ON
    )
endif()

# A shared library owns the registry while a module registers into it. Hidden visibility ensures
# that only the registry declaration's export decoration makes the shared storage reachable.
add_library(test_staticregistry_hub SHARED plugins/test_staticregistry_hub.cpp)
target_include_directories(test_staticregistry_hub PUBLIC ${stdcorelib_SOURCE_DIR}/include)
target_compile_definitions(test_staticregistry_hub PRIVATE TEST_STATICREGISTRY_HUB_LIBRARY)
set_target_properties(test_staticregistry_hub PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

add_library(test_staticregistry_plugin MODULE plugins/test_staticregistry_plugin.cpp)
target_link_libraries(test_staticregistry_plugin PRIVATE test_staticregistry_hub)
set_target_properties(test_staticregistry_plugin PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

# A program for the popen tests to start. The shell covers most of what a child has to do, but
# it cannot report the argument vector it was given, since it parses the command line a second
# time before the program sees it.
add_executable(test_popen_child helpers/test_popen_child.cpp)
set_target_properties(test_popen_child PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

# Fatal logging has to run in a child because the behavior under test terminates its process.
add_executable(test_logging_fatal helpers/test_logging_fatal.cpp)
target_link_libraries(test_logging_fatal PRIVATE stdcorelib)
set_target_properties(test_logging_fatal PROPERTIES
    CXX_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
)

add_dependencies(${PROJECT_NAME}
    test_any_plugin test_dynamicregistry_plugin test_sharedlibrary_unloadable test_sharedlibrary_pinned test_popen_child test_logging_fatal
    test_sharedlibrary_dependency test_sharedlibrary_needs_dependency test_staticregistry_plugin)
target_compile_definitions(${PROJECT_NAME} PRIVATE
    TEST_ANY_PLUGIN_PATH="$<TARGET_FILE:test_any_plugin>"
    TEST_DYNAMICREGISTRY_PLUGIN_PATH="$<TARGET_FILE:test_dynamicregistry_plugin>"
    TEST_SHAREDLIBRARY_UNLOADABLE_PATH="$<TARGET_FILE:test_sharedlibrary_unloadable>"
    TEST_SHAREDLIBRARY_PINNED_PATH="$<TARGET_FILE:test_sharedlibrary_pinned>"
    TEST_SHAREDLIBRARY_NEEDS_DEPENDENCY_PATH="$<TARGET_FILE:test_sharedlibrary_needs_dependency>"
    TEST_POPEN_CHILD_PATH="$<TARGET_FILE:test_popen_child>"
    TEST_LOGGING_FATAL_PATH="$<TARGET_FILE:test_logging_fatal>"
    TEST_STATICREGISTRY_PLUGIN_PATH="$<TARGET_FILE:test_staticregistry_plugin>"
)

# One entry rather than one per suite. The whole binary is a second, and twenty five process
# starts cost more than the suites they would be splitting.
#
# Note that ctest exits 0 when it finds no tests at all, so anything running this in anger wants
# --no-tests=error, or it is back to a green run of nothing.
add_test(NAME ${PROJECT_NAME} COMMAND ${PROJECT_NAME})

# The default is 1500 seconds, long enough for a hang to pass for slowness. Two seconds here and
# twenty four at the worst measured on CI, so anything still running at two minutes is stuck.
set_tests_properties(${PROJECT_NAME} PROPERTIES TIMEOUT 120)

# The same binary again, narrowed to the one case that needs privilege to say anything: user(),
# group() and extraGroups() do nothing without it. Labeled rather than added to the run above,
# because being root changes what several of the other cases are asking about, the descriptor
# count and the umask among them. CI runs this entry under sudo and excludes the label from the
# ordinary run, where the same case is covered anyway by the whole-binary entry.
#
# Linux only. The case writes 65534 and "0 65534" into its expectations, and macOS answers
# `id -u nobody` with 4294967294, so it is wrong there before privilege comes into it.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    add_test(NAME ${PROJECT_NAME}_root
        COMMAND ${PROJECT_NAME} --run_test=test_popen/test_user_and_groups)
    set_tests_properties(${PROJECT_NAME}_root PROPERTIES LABELS root TIMEOUT 60)
endif()

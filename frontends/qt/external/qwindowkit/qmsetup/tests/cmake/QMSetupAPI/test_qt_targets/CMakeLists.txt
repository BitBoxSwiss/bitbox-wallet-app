# qm_find_qt, qm_link_qt and qm_include_qt_private, against a real Qt.
#
# Registered only where tests/cmake/CMakeLists.txt found one, so there are no
# checks in here asking whether Qt is present. It is, or this project was never
# added. The search path it was found on is handed down as CMAKE_PREFIX_PATH, so
# nothing here names a path of its own.
#
# All three are macros rather than functions, because find_package(Qt) clears
# the private header directory variables on a second call and a function scope
# would throw away the first answer. That is written up at the top of
# QMSetupAPI.cmake. It matters here because what they do lands in this scope,
# which is what lets the last section below set a variable and have the macro
# read it.
#
# Nothing is built. What these functions do is put properties on a target, and
# those can be read straight back.

cmake_minimum_required(VERSION 3.19)
project(qmtest_qt_targets CXX)

include(${QMTEST_HARNESS})

# ------------------------------------------------------------------
# qm_find_qt
# ------------------------------------------------------------------

qm_find_qt(Core)

qmtest_true("a major version is settled on" "${QT_VERSION_MAJOR}")

# if(TARGET) rather than a generator expression, which is not evaluated while
# the project is being read and would be a non-empty string either way.
set(_core_found off)

if(TARGET Qt${QT_VERSION_MAJOR}::Core)
    set(_core_found on)
endif()

qmtest_true("and the module's target is there" "${_core_found}")

# Asking twice is what a project made of several directories does, and the
# second time has to be quiet about it rather than searching again.
qm_find_qt(Core)
qmtest_true("asking again is no trouble" "${QT_VERSION_MAJOR}")

# Two of the options together, which a chain of elseif could not take. What
# find_package does with them is its own business, so what is checked is that
# the call goes through and still finds the module.
qm_find_qt(Concurrent QUIET REQUIRED)

set(_concurrent_found off)

if(TARGET Qt${QT_VERSION_MAJOR}::Concurrent)
    set(_concurrent_found on)
endif()

qmtest_true("QUIET and REQUIRED may be given together" "${_concurrent_found}")

# Nothing of that name anywhere, asked for quietly, so the configure carries on
# and no target appears.
qm_find_qt(QmTestNoSuchModule QUIET)

set(_absent_found off)

if(TARGET Qt${QT_VERSION_MAJOR}::QmTestNoSuchModule)
    set(_absent_found on)
endif()

qmtest_false("a module that is not there is passed over when asked quietly"
    "${_absent_found}")

# ------------------------------------------------------------------
# qm_link_qt
# ------------------------------------------------------------------

add_library(qtlib STATIC src/lib.cpp)
qm_link_qt(qtlib PRIVATE Core)

get_target_property(_links qtlib LINK_LIBRARIES)
qmtest_contains("the module is linked" "${_links}" "Qt${QT_VERSION_MAJOR}::Core")

get_target_property(_ilinks qtlib INTERFACE_LINK_LIBRARIES)
qmtest_lacks("privately, as asked" "${_ilinks}" "Qt${QT_VERSION_MAJOR}::Core")

add_library(qtlib_public STATIC src/lib.cpp)
qm_link_qt(qtlib_public PUBLIC Core)
get_target_property(_ilinks_public qtlib_public INTERFACE_LINK_LIBRARIES)
qmtest_contains("and publicly when that is what was asked"
    "${_ilinks_public}" "Qt${QT_VERSION_MAJOR}::Core")

# Several at once, since the body is a loop over them.
add_library(qtlib_several STATIC src/lib.cpp)
qm_link_qt(qtlib_several PRIVATE Core Concurrent)
get_target_property(_links_several qtlib_several LINK_LIBRARIES)
qmtest_contains("one of several" "${_links_several}" "Qt${QT_VERSION_MAJOR}::Core")
qmtest_contains("and the other" "${_links_several}" "Qt${QT_VERSION_MAJOR}::Concurrent")

# ------------------------------------------------------------------
# qm_include_qt_private, where the module has a Private target
# ------------------------------------------------------------------

# The way Qt6 ships. Linking the Private target is all there is to it, and the
# include directories come with it.
add_library(qtprivlib STATIC src/lib.cpp)
qm_include_qt_private(qtprivlib PRIVATE Core)

get_target_property(_priv_links qtprivlib LINK_LIBRARIES)
qmtest_contains("the private target is linked where there is one"
    "${_priv_links}" "Qt${QT_VERSION_MAJOR}::CorePrivate")

# ------------------------------------------------------------------
# qm_include_qt_private, where there is no Private target
# ------------------------------------------------------------------

# The other half of that function, which is the shape Qt5 has: no Private target
# to link, and a variable naming the directories instead. Qt6 gives every module
# with private headers a Private package, so no real module reaches this branch
# here, and it was wrong for a long time without anything saying so. What it did
# was hand target_include_directories the name of the variable rather than what
# the variable held, adding a directory literally called
# Qt6Gui_PRIVATE_INCLUDE_DIRS.
#
# LinguistTools is a module that exists and has no Private package, so the
# lookup fails the way it is meant to, and the variable below is set here to
# stand in for what Qt5 would have set. qm_include_qt_private is a macro, so it
# reads this scope.
set(_faked_private "${CMAKE_CURRENT_BINARY_DIR}/faked_private_headers")
file(MAKE_DIRECTORY "${_faked_private}")
set(Qt${QT_VERSION_MAJOR}LinguistTools_PRIVATE_INCLUDE_DIRS "${_faked_private}")

add_library(qtfallbacklib STATIC src/lib.cpp)
qm_include_qt_private(qtfallbacklib PRIVATE LinguistTools)

get_target_property(_fallback_inc qtfallbacklib INCLUDE_DIRECTORIES)
qmtest_contains("the directories the variable names are included"
    "${_fallback_inc}" "${_faked_private}")
qmtest_lacks("rather than the name of the variable holding them"
    "${_fallback_inc}" "Qt${QT_VERSION_MAJOR}LinguistTools_PRIVATE_INCLUDE_DIRS")

# ------------------------------------------------------------------
# The same three through qm_configure_target
# ------------------------------------------------------------------

add_library(qtconfigured STATIC src/lib.cpp)
qm_configure_target(qtconfigured
    QT_LINKS Core
    QT_LINKS_PRIVATE Concurrent
    QT_INCLUDE_PRIVATE Core
)

get_target_property(_cfg_links qtconfigured LINK_LIBRARIES)
get_target_property(_cfg_ilinks qtconfigured INTERFACE_LINK_LIBRARIES)

qmtest_contains("QT_LINKS reaches the target" "${_cfg_links}" "Qt${QT_VERSION_MAJOR}::Core")
qmtest_contains("and whatever links it" "${_cfg_ilinks}" "Qt${QT_VERSION_MAJOR}::Core")
qmtest_contains("QT_LINKS_PRIVATE reaches the target"
    "${_cfg_links}" "Qt${QT_VERSION_MAJOR}::Concurrent")
qmtest_lacks("and stops there" "${_cfg_ilinks}" "Qt${QT_VERSION_MAJOR}::Concurrent")
qmtest_contains("QT_INCLUDE_PRIVATE brings the private target"
    "${_cfg_links}" "Qt${QT_VERSION_MAJOR}::CorePrivate")

qmtest_report()

# qm_add_mac_bundle.
#
# Registered only on macOS, where alone it does anything, so there are no
# platform checks in here. Nothing is built: everything the function does is a
# target property, which can be read back as soon as it is set.

cmake_minimum_required(VERSION 3.19)
project(qmtest_mac_bundle C)

include(${QMTEST_HARNESS})

add_executable(macapp src/app.c)
qm_add_mac_bundle(macapp
    NAME "MyMacApp"
    VERSION 1.2.3.4
    DESCRIPTION "Something to read the bundle of"
    COPYRIGHT "Copyright nobody"
)

get_target_property(_bundle macapp MACOSX_BUNDLE)
qmtest_true("it is made a bundle" "${_bundle}")

get_target_property(_output macapp OUTPUT_NAME)
qmtest_equal("NAME is what the binary is called" "${_output}" "MyMacApp")

get_target_property(_name macapp MACOSX_BUNDLE_BUNDLE_NAME)
qmtest_equal("and what the bundle is called" "${_name}" "MyMacApp")

get_target_property(_version macapp MACOSX_BUNDLE_BUNDLE_VERSION)
qmtest_equal("the version is carried whole" "${_version}" "1.2.3.4")

# The short one is what a user is shown, so it is only the first two.
get_target_property(_short macapp MACOSX_BUNDLE_SHORT_VERSION_STRING)
qmtest_equal("and the short one is the first two of it" "${_short}" "1.2")

get_target_property(_copyright macapp MACOSX_BUNDLE_COPYRIGHT)
qmtest_equal("the copyright is carried" "${_copyright}" "Copyright nobody")

get_target_property(_info macapp MACOSX_BUNDLE_INFO_STRING)
qmtest_equal("and the description" "${_info}" "Something to read the bundle of")

# Nothing given, so the target names itself.
add_executable(macbare src/app.c)
qm_add_mac_bundle(macbare)

get_target_property(_name macbare MACOSX_BUNDLE_BUNDLE_NAME)
qmtest_equal("the target names itself" "${_name}" "macbare")

# An icon is named in the plist without its path, and goes into the bundle by
# being one of the target's sources.
set(_icon "${CMAKE_CURRENT_BINARY_DIR}/icons/app.icns")
file(WRITE "${_icon}" "not really an icon")

add_executable(maciconapp src/app.c)
qm_add_mac_bundle(maciconapp NAME "IconApp" ICON "${_icon}")

get_target_property(_icon_file maciconapp MACOSX_BUNDLE_ICON_FILE)
qmtest_equal("the plist names the icon without its path" "${_icon_file}" "app.icns")

get_target_property(_sources maciconapp SOURCES)
qmtest_contains("and the icon is one of the sources" "${_sources}" "${_icon}")

get_source_file_property(_where "${_icon}" MACOSX_PACKAGE_LOCATION)
qmtest_equal("which is put under Resources" "${_where}" "Resources")

# A plist of the caller's own is used in place of the one CMake would write.
set(_plist "${CMAKE_CURRENT_BINARY_DIR}/Custom.plist.in")
file(WRITE "${_plist}" "<plist></plist>")

add_executable(macplist src/app.c)
qm_add_mac_bundle(macplist NAME "PlistApp" INFO_PLIST "${_plist}")

get_target_property(_used macplist MACOSX_BUNDLE_INFO_PLIST)
qmtest_equal("INFO_PLIST names the template to use" "${_used}" "${_plist}")

qmtest_report()

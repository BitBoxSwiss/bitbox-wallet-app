# qm_add_win_rc, qm_add_win_rc_enhanced and qm_add_win_manifest.
#
# Registered only on Windows, where alone they do anything, so there are no
# platform checks in here.
#
# The resource and the manifest are configured rather than built, so what they
# say can be read straight off the file and nothing needs a resource compiler.

cmake_minimum_required(VERSION 3.19)
project(qmtest_win_resources C)

include(${QMTEST_HARNESS})

set(_res_dir "${CMAKE_CURRENT_BINARY_DIR}/resources")

# Icons that no resource compiler will ever see, since nothing here is built.
# What is checked is that the path reaches the resource file.
set(_icon_dir "${CMAKE_CURRENT_BINARY_DIR}/icons")
file(WRITE "${_icon_dir}/main.ico" "not really an icon")
file(WRITE "${_icon_dir}/second.ico" "nor is this one")

# ------------------------------------------------------------------
# qm_add_win_rc
# ------------------------------------------------------------------

add_executable(winapp src/app.c)
qm_add_win_rc(winapp
    NAME "A Test Application"
    VERSION 1.2.3.4
    DESCRIPTION "Something to read the resource of"
    COPYRIGHT "Copyright nobody"
    OUTPUT_DIR "${_res_dir}"
)

set(_rc "${_res_dir}/winapp_res.rc")
qmtest_exists("OUTPUT_DIR is where the resource goes" "${_rc}")
qmtest_file_contains("the name is in it" "${_rc}" "A Test Application")
qmtest_file_contains("the description too" "${_rc}" "Something to read the resource of")
qmtest_file_contains("and the copyright" "${_rc}" "Copyright nobody")
# A version resource wants four numbers with commas, not the string form.
qmtest_file_contains("the version is four numbers" "${_rc}" "1,2,3,4")
qmtest_file_contains("and the string form is there as well" "${_rc}" "1\\.2\\.3\\.4")

get_target_property(_sources winapp SOURCES)
qmtest_contains("the resource is compiled into the target" "${_sources}" "${_rc}")

# A version with fewer components is filled out, the same as anywhere else.
add_executable(winshort src/app.c)
qm_add_win_rc(winshort VERSION 2.0 OUTPUT_DIR "${_res_dir}")
qmtest_file_contains("a short version is filled out" "${_res_dir}/winshort_res.rc" "2,0,0,0")

# Nothing given, so the target names itself.
add_executable(winbare src/app.c)
qm_add_win_rc(winbare OUTPUT_DIR "${_res_dir}")
qmtest_file_contains("the target names itself" "${_res_dir}/winbare_res.rc" "winbare")

# An icon is a line in the resource, and no icon is that line commented out
# rather than left half written.
qmtest_file_lacks("with no icon nothing points at one" "${_res_dir}/winbare_res.rc" "\n[^/\n]*IDI_ICON1")

add_executable(winicon src/app.c)
qm_add_win_rc(winicon ICON "${_icon_dir}/main.ico" OUTPUT_DIR "${_res_dir}")
qmtest_file_contains("ICON reaches the resource" "${_res_dir}/winicon_res.rc" "main\\.ico")

# A library takes a resource as readily as an executable does.
add_library(winrclib SHARED src/lib.c)
qm_add_win_rc(winrclib NAME "A Test Library" VERSION 3.4.5.6 OUTPUT_DIR "${_res_dir}")
qmtest_file_contains("a library takes one too" "${_res_dir}/winrclib_res.rc" "A Test Library")

get_target_property(_sources winrclib SOURCES)
qmtest_contains("and compiles it in" "${_sources}" "${_res_dir}/winrclib_res.rc")

# ------------------------------------------------------------------
# qm_add_win_rc_enhanced
# ------------------------------------------------------------------

add_executable(winrich src/app.c)
qm_add_win_rc_enhanced(winrich
    NAME "A Richer Application"
    VERSION 5.6.7.8
    COMPANY "Nobody Ltd"
    INTERNAL_NAME "richer"
    TRADEMARK "None at all"
    ORIGINAL_FILENAME "winrich.exe"
    COMMENTS "Nothing to add"
    OUTPUT_DIR "${_res_dir}"
)

set(_rc2 "${_res_dir}/winrich_res.rc")
qmtest_file_contains("the company is in it" "${_rc2}" "Nobody Ltd")
qmtest_file_contains("the internal name too" "${_rc2}" "richer")
qmtest_file_contains("the trademark" "${_rc2}" "None at all")
qmtest_file_contains("the original file name" "${_rc2}" "winrich\\.exe")
qmtest_file_contains("and the comments" "${_rc2}" "Nothing to add")
# An executable and a library are different kinds of file to Windows.
qmtest_file_contains("an executable says it is one" "${_rc2}" "VFT_APP")

add_library(winrichlib SHARED src/lib.c)
qm_add_win_rc_enhanced(winrichlib VERSION 1.0.0.0 OUTPUT_DIR "${_res_dir}")
qmtest_file_contains("and a library says it is one" "${_res_dir}/winrichlib_res.rc" "VFT_DLL")

# This one takes any number of icons, numbered in the order they were given,
# the first being the one Windows shows for the file.
add_executable(winicons src/app.c)
qm_add_win_rc_enhanced(winicons
    VERSION 1.0.0.0
    ICONS "${_icon_dir}/main.ico" "${_icon_dir}/second.ico"
    OUTPUT_DIR "${_res_dir}"
)

set(_rc3 "${_res_dir}/winicons_res.rc")
qmtest_file_contains("the first icon is the first" "${_rc3}" "IDI_ICON1[ \t]+ICON[ \t]+\"[^\"]*main\\.ico\"")
qmtest_file_contains("and the second the second" "${_rc3}" "IDI_ICON2[ \t]+ICON[ \t]+\"[^\"]*second\\.ico\"")

# ------------------------------------------------------------------
# qm_add_win_manifest
# ------------------------------------------------------------------

add_executable(winplain src/app.c)
qm_add_win_manifest(winplain NAME "Plain" VERSION 1.2.3.4 OUTPUT_DIR "${_res_dir}")

set(_manifest "${_res_dir}/winplain_manifest.exe.manifest")
qmtest_exists("the manifest is written" "${_manifest}")
qmtest_file_contains("it names the application" "${_manifest}" "Plain")
qmtest_file_contains("it asks for no more than it was started with" "${_manifest}" "asInvoker")
qmtest_file_lacks("and says nothing about the code page" "${_manifest}" "activeCodePage")

add_executable(winadmin src/app.c)
qm_add_win_manifest(winadmin NAME "Admin" VERSION 1.0.0.0 UTF8 ADMIN OUTPUT_DIR "${_res_dir}")

set(_manifest2 "${_res_dir}/winadmin_manifest.exe.manifest")
qmtest_file_contains("ADMIN asks to be run as one" "${_manifest2}" "requireAdministrator")
qmtest_file_contains("UTF8 asks for that code page" "${_manifest2}" "UTF-8")

qmtest_report()

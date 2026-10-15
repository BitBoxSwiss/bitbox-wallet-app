# qm_import and qm_import_all, which bring the modules in, and qm_find_package,
# which brings in a find script.
#
# All three work out a file name from what they are given and include it, so
# what there is to check is which file that turns out to be and what happens
# when it is not there.

include(${QMTEST_HARNESS})

# ------------------------------------------------------------------
# qm_import
# ------------------------------------------------------------------

# The suffix may be left off or written out.
qm_import(Preprocess)
qmtest_command("a module named without its suffix" qm_add_definition)

qm_import(Filesystem.cmake)
qmtest_command("and one named with it" qm_add_copy_command)

# Several at once.
qm_import(Protobuf QtLinguist)
qmtest_command("several named at once" qm_create_protobuf)
qmtest_command("all of them" qm_add_translation)

# A module that has been renamed answers to what it used to be called, which
# cmake/private/ModuleAliases.cmake is the list of. Asked before qm_import_all
# below, which would bring the module in under its own name and leave nothing
# for this to show.
#
# The warning is turned off around the call rather than left to print, it being
# what this asks for rather than something going wrong.
set(CMAKE_WARN_DEPRECATED OFF)
qm_import(Qml)
set(CMAKE_WARN_DEPRECATED ON)
qmtest_command("a module answers to what it used to be called" qm_install_qml_modules)

# And says so. CMAKE_ERROR_DEPRECATED turns the warning into a failure, which is
# how a script that is meant to finish can be asked what it said on the way.
qmtest_script_fails("and says what it is called now"
    "\"Translate\" is now \"QtLinguist\""
    "set(CMAKE_ERROR_DEPRECATED ON)\nqm_import(Translate)")

# Bringing one in twice is what an include guard is for, and is not an error.
qm_import(Preprocess)
qmtest_equal("a module brought in twice is not an error" "reached here" "reached here")

qmtest_script_fails("a module that is not there is refused"
    "not found"
    "qm_import(NoSuchModule)")

# ------------------------------------------------------------------
# qm_import_all
#
# Every module in the directory, for a project that would rather not name them
# one at a time.
# ------------------------------------------------------------------

qm_import_all()

qmtest_command("everything is brought in" qm_deploy_directory)
qmtest_command("all of it" qm_setup_doxygen)
qmtest_command("the whole of it" qm_install_qml_modules)

# ------------------------------------------------------------------
# qm_find_package
#
# The scripts under find-modules, which are named with or without the Find
# prefix the file itself may carry.
# ------------------------------------------------------------------

# Nothing of VC-LTL happens away from MSVC, which a script run is, so this is
# the name being placed rather than the script doing anything.
qm_find_package(VC-LTL)
qmtest_equal("a find script is brought in by its name" "reached here" "reached here")

qm_find_package(VC-LTL.cmake)
qmtest_equal("named with its suffix as well" "reached here" "reached here")

qmtest_script_fails("a find script that is not there is refused"
    "not found"
    "qm_find_package(NoSuchPackage)")

qmtest_report()

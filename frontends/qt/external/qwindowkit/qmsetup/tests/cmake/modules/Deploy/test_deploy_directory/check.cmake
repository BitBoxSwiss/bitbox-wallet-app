# What qm_deploy_directory brought into the install tree.
#
# Included by testing/build.cmake once the tree exists. `_prefix` is
# where it was installed.
#
# The application was installed without the library it links, so a deployment
# that did nothing would leave it unable to start.

# The file names the build settled on, written out by the project. Read rather
# than spelt out here, since a shared library is named differently by every
# platform and, on Windows, by every compiler.
include("${_build}/built_names.cmake")

set(_library_dir "${_prefix}/qmtest_libs")
set(_plugin_dir "${_prefix}/qmtest_plugins")

# ------------------------------------------------------------------
# What following the graph found
# ------------------------------------------------------------------

qmtest_exists("the library the application needs was brought along"
    "${_library_dir}/${_extra_name}")

# ------------------------------------------------------------------
# LIBRARY_DIR
# ------------------------------------------------------------------

# Where a library lands when nothing says is beside the binaries on Windows and
# under lib everywhere else, and LIBRARY_DIR is what overrides that. So neither
# of those two has anything in it.
qmtest_not_exists("and not where it would have gone by default"
    "${_prefix}/bin/${_extra_name}")
qmtest_not_exists("nor the other default" "${_prefix}/lib/${_extra_name}")

# ------------------------------------------------------------------
# EXTRA_LIBRARIES
# ------------------------------------------------------------------

# Matched by name against what is in the searching paths, and copied where the
# libraries go.
qmtest_exists("a binary named outright is brought along"
    "${_library_dir}/${_prebuilt_name}")

# And a searching path is somewhere to look rather than something to take. This
# library sits in one, is linked by nothing, and is named by nothing, so nothing
# should have brought it.
qmtest_not_exists("while what is merely in a searching path is left alone"
    "${_library_dir}/${_loose_name}")

# ------------------------------------------------------------------
# PLUGINS, PLUGIN_DIR and EXTRA_PLUGIN_PATHS
# ------------------------------------------------------------------

# The category is kept, a plugin being named as <category>/<name> and belonging
# under a directory of that name wherever it is put.
qmtest_exists("a plugin named is brought along, under its category"
    "${_plugin_dir}/iconengines/${_plugin_name}")

qmtest_not_exists("and not flattened beside it" "${_plugin_dir}/${_plugin_name}")
qmtest_not_exists("nor left among the libraries" "${_library_dir}/${_plugin_name}")

# ------------------------------------------------------------------
# STANDARD
# ------------------------------------------------------------------

# Nothing of the system came with any of it.
file(GLOB_RECURSE _deployed "${_library_dir}/*" "${_plugin_dir}/*")
set(_runtime)

foreach(_item IN LISTS _deployed)
    get_filename_component(_name "${_item}" NAME)
    string(TOLOWER "${_name}" _lowered)

    if(_lowered MATCHES "^(libc\\.|libc-|libm\\.|libm-|libgcc|libstdc|libsystem|msvcp|vcruntime|ucrtbase|api-ms-win)")
        list(APPEND _runtime "${_name}")
    endif()
endforeach()

qmtest_equal("and nothing of the system came with it" "${_runtime}" "")

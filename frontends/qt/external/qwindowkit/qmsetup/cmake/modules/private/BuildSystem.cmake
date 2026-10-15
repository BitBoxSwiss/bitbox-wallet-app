#[[
    Warning: This module is private, may be modified or removed in the future, please use with caution.
]] #

include_guard(DIRECTORY)

#[[
    Set up the build repo helpers.

    qm_setup_build_repo_helpers([<prefix>])

    Defines <prefix>_add_library, <prefix>_init_buildsystem and the rest, so that one repository
    can hold several projects each with a set of its own. <prefix> defaults to PROJECT_NAME, which
    is what a repository laid out one project per directory wants.

    These sit a layer above the modules, and import some of them themselves, which is why they are
    not one. What they bring is a whole build system rather than a group of functions to pick from.
]] #
macro(qm_setup_build_repo_helpers)
    if(${ARGC} GREATER 0)
        set(QM_BUILD_REPO_HELPERS_FUNCTION_PREFIX ${ARGV0})
    endif()

    include("${QMSETUP_MODULES_DIR}/buildsystem/BuildRepoHelpers.cmake")

    # Cleared rather than left to the caller's scope, where a stale one would silently name the
    # functions of whichever project reached here first.
    unset(QM_BUILD_REPO_HELPERS_FUNCTION_PREFIX)
endmacro()

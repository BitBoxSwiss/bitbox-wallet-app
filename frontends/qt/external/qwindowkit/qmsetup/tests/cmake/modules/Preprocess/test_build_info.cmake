# qm_generate_build_info, which writes a header saying what the build was made
# of: the system, the compiler and where in a repository it came from.
#
# The git part is asked of repositories made here rather than of whichever one
# the tests happen to be run from, so that the answers are known. Note that a
# directory under the build tree is still inside this project's own checkout, so
# a repository has to be made for git to stop at rather than an empty directory.

include(${QMTEST_HARNESS})

qm_import(Preprocess)

if(NOT QMSETUP_CORECMD_EXECUTABLE)
    message(FATAL_ERROR "QMCORECMD is not set, so there is nothing to generate with")
endif()

find_package(Git QUIET)

# ------------------------------------------------------------------
# What is in the header whatever git says
# ------------------------------------------------------------------

set(_header "${QMTEST_WORK_DIR}/build_info.h")
qm_generate_build_info("${_header}" PREFIX MYAPP NO_WARNING)

qmtest_file_contains("the system is named" "${_header}" "MYAPP_SYSTEM_NAME")
qmtest_file_contains("and its processor" "${_header}" "MYAPP_SYSTEM_PROCESSOR")
qmtest_file_contains("the host is named too" "${_header}" "MYAPP_HOST_SYSTEM_NAME")
qmtest_file_contains("the compiler is named" "${_header}" "MYAPP_COMPILER_ID")
qmtest_file_contains("the branch is named" "${_header}" "MYAPP_GIT_BRANCH")
qmtest_file_contains("it is a guarded header" "${_header}" "#ifndef")

# Nothing carries a prefix of its own, since PREFIX is what every name is built
# from and a header with two of them would be a mistake somewhere.
qmtest_file_lacks("no other prefix creeps in" "${_header}" "define (QMSETUP|PROJECT)_GIT_BRANCH")

# ------------------------------------------------------------------
# Neither the year nor the time unless asked for
#
# They are what would make a header different on every build, so they are opt in.
# ------------------------------------------------------------------

qmtest_file_lacks("nothing is dated by default" "${_header}" "BUILD_YEAR")
qmtest_file_lacks("nor timed" "${_header}" "BUILD_TIME")

set(_dated "${QMTEST_WORK_DIR}/dated.h")
qm_generate_build_info("${_dated}" PREFIX MYAPP YEAR TIME NO_WARNING)
qmtest_file_contains("YEAR asks for the year" "${_dated}" "MYAPP_BUILD_YEAR")
qmtest_file_contains("TIME asks for the time" "${_dated}" "MYAPP_BUILD_TIME")

# ------------------------------------------------------------------
# A prefix that is not an identifier
# ------------------------------------------------------------------

# The name a project goes by is not always something a macro may be called, and
# the one worked out from PROJECT_NAME was put right while the one given here
# was not, so a prefix of my-lib asked for macros no compiler would take.
set(_awkward "${QMTEST_WORK_DIR}/awkward.h")
qm_generate_build_info("${_awkward}" PREFIX "my-lib 1.0" NO_WARNING)

qmtest_file_contains("what cannot be in an identifier is replaced"
    "${_awkward}" "my_lib_1_0_SYSTEM_NAME")
qmtest_file_lacks("rather than written out as it stands" "${_awkward}" "my-lib")

# ------------------------------------------------------------------
# The repositories
# ------------------------------------------------------------------

if(NOT Git_FOUND)
    message(STATUS "git is not on the path, so the repository checks are passed over")
    qmtest_report()
    return()
endif()

# Runs git in the repository named, and stops the test if it will not.
macro(git _where)
    execute_process(COMMAND ${GIT_EXECUTABLE} ${ARGN}
        WORKING_DIRECTORY "${_where}"
        OUTPUT_QUIET
        ERROR_QUIET
        COMMAND_ERROR_IS_FATAL ANY
    )
endmacro()

macro(make_repo _where _branch)
    file(MAKE_DIRECTORY "${_where}")
    git("${_where}" init --initial-branch=${_branch})
    git("${_where}" config user.name "A Tester")
    git("${_where}" config user.email "tester@example.com")
    git("${_where}" config commit.gpgsign false)
endmacro()

# A repository with nothing committed to it. There is a branch to name but no
# commit to describe, which is the case the fallbacks are there for.
set(_empty "${QMTEST_WORK_DIR}/empty")
make_repo("${_empty}" nothingyet)

set(_from_empty "${QMTEST_WORK_DIR}/empty.h")
qm_generate_build_info("${_from_empty}" PREFIX MYAPP ROOT_DIRECTORY "${_empty}" NO_WARNING)

qmtest_file_contains("a branch with no commits is still a branch" "${_from_empty}" "MYAPP_GIT_BRANCH \"nothingyet\"")
qmtest_file_contains("with no commit to describe" "${_from_empty}" "MYAPP_GIT_LAST_COMMIT_HASH \"unknown\"")
qmtest_file_contains("and nobody to name" "${_from_empty}" "MYAPP_GIT_LAST_COMMIT_AUTHOR \"unknown\"")
qmtest_file_contains("the revision falls back to nought" "${_from_empty}" "MYAPP_GIT_REVISION_ID \"0\"")

# And one with something in it.
set(_repo "${QMTEST_WORK_DIR}/repo")
make_repo("${_repo}" trunk)
file(WRITE "${_repo}/a.txt" "something to commit")
git("${_repo}" add a.txt)
git("${_repo}" commit -m "the first one")

set(_from_repo "${QMTEST_WORK_DIR}/repo.h")
qm_generate_build_info("${_from_repo}" PREFIX MYAPP ROOT_DIRECTORY "${_repo}" NO_WARNING)

qmtest_file_contains("the branch is the one checked out" "${_from_repo}" "MYAPP_GIT_BRANCH \"trunk\"")
qmtest_file_contains("the author is whoever made the commit" "${_from_repo}" "MYAPP_GIT_LAST_COMMIT_AUTHOR \"A Tester\"")
qmtest_file_contains("and their address" "${_from_repo}" "MYAPP_GIT_LAST_COMMIT_EMAIL \"tester@example.com\"")
qmtest_file_contains("the revision counts the commits" "${_from_repo}" "MYAPP_GIT_REVISION_ID \"1\"")
qmtest_file_contains("the hash is a hash" "${_from_repo}" "MYAPP_GIT_LAST_COMMIT_HASH \"[0-9a-f]+\"")
qmtest_file_contains("the time is a date" "${_from_repo}" "MYAPP_GIT_LAST_COMMIT_TIME \"[0-9]+-[0-9]+-[0-9]+T")

# A second commit moves the count on, which is what the number is for.
file(WRITE "${_repo}/b.txt" "something else")
git("${_repo}" add b.txt)
git("${_repo}" commit -m "the second one")

qm_generate_build_info("${_from_repo}" PREFIX MYAPP ROOT_DIRECTORY "${_repo}" NO_WARNING)
qmtest_file_contains("and moves on with them" "${_from_repo}" "MYAPP_GIT_REVISION_ID \"2\"")

# A detached head has no branch to name, and that is not an error unless the
# caller said it was.
git("${_repo}" checkout --detach HEAD)

set(_detached "${QMTEST_WORK_DIR}/detached.h")
qm_generate_build_info("${_detached}" PREFIX MYAPP ROOT_DIRECTORY "${_repo}" NO_WARNING)
qmtest_file_contains("a detached head has no branch to give" "${_detached}" "MYAPP_GIT_BRANCH \"unknown\"")
qmtest_file_contains("but the commit is still known" "${_detached}" "MYAPP_GIT_REVISION_ID \"2\"")

qmtest_report()

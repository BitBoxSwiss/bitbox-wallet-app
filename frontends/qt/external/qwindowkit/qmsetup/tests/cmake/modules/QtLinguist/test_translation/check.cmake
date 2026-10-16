# What qm_add_translation produced, once the project was built.
#
# Included by testing/build.cmake. `_build` is the build directory. Nothing is
# installed here, so `_prefix` has nothing in it.

include("${_build}/translation_paths.cmake")

# ------------------------------------------------------------------
# What lupdate and lrelease left
# ------------------------------------------------------------------

qmtest_exists("CREATE_ONCE wrote a catalogue while configuring" "${_ts_dir}/qmtest_zh_CN.ts")
qmtest_exists("one per locale" "${_ts_dir}/qmtest_en_US.ts")

qmtest_file_contains("with what lupdate found in the sources"
    "${_ts_dir}/qmtest_zh_CN.ts" "Hello from the translation test")

qmtest_exists("lrelease turned each into a binary catalogue" "${_qm_dir}/qmtest_zh_CN.qm")
qmtest_exists("both of them" "${_qm_dir}/qmtest_en_US.qm")

# ------------------------------------------------------------------
# What lupdate was told to look at
# ------------------------------------------------------------------

# The list file exists so that the command line does not have to carry every
# source, and it carries the include directories as well. An entry that is not
# an absolute path would mean lupdate looking somewhere relative to wherever it
# happened to run.
set(_lst "${_lst_dir}/qmtest_zh_CN.ts_lst_file")
qmtest_exists("lupdate is handed a list file" "${_lst}")

if(EXISTS "${_lst}")
    file(STRINGS "${_lst}" _lines)
    set(_relative_includes)
    set(_sources 0)

    foreach(_line IN LISTS _lines)
        if(_line MATCHES "^-I(.+)$")
            if(NOT IS_ABSOLUTE "${CMAKE_MATCH_1}")
                list(APPEND _relative_includes "${CMAKE_MATCH_1}")
            endif()
        elseif(_line)
            math(EXPR _sources "${_sources} + 1")
        endif()
    endforeach()

    qmtest_equal("and every include directory in it is absolute" "${_relative_includes}" "")
    qmtest_true("along with the sources to read" "${_sources}")
endif()

# ------------------------------------------------------------------
# What a rule reads
# ------------------------------------------------------------------

# Each .qm is released from one .ts, so touching one catalogue is one file to
# rebuild. Named as the whole list, every .qm depended on every .ts and the lot
# came out again. There is no reading that off a target property, so it is done
# by doing it: note what is there, touch one, build again, and see what moved.

file(TIMESTAMP "${_qm_dir}/qmtest_zh_CN.qm" _zh_before "%Y%m%d%H%M%S" UTC)
file(TIMESTAMP "${_qm_dir}/qmtest_en_US.qm" _en_before "%Y%m%d%H%M%S" UTC)

# A second apart, since a timestamp to the second cannot tell two writes inside
# one apart and the build below is quick.
execute_process(COMMAND "${CMAKE_COMMAND}" -E sleep 2)
file(TOUCH "${_ts_dir}/qmtest_zh_CN.ts")

execute_process(COMMAND "${CMAKE_COMMAND}" --build "${_build}" --config Release
    RESULT_VARIABLE _rebuild_code
    OUTPUT_VARIABLE _rebuild_output
    ERROR_VARIABLE _rebuild_output
)

if(NOT _rebuild_code EQUAL 0)
    qmtest_equal("the second build finished" "${_rebuild_output}" "")
else()
    file(TIMESTAMP "${_qm_dir}/qmtest_zh_CN.qm" _zh_after "%Y%m%d%H%M%S" UTC)
    file(TIMESTAMP "${_qm_dir}/qmtest_en_US.qm" _en_after "%Y%m%d%H%M%S" UTC)

    set(_zh_state "unchanged")

    if(NOT _zh_after STREQUAL _zh_before)
        set(_zh_state "rebuilt")
    endif()

    set(_en_state "unchanged")

    if(NOT _en_after STREQUAL _en_before)
        set(_en_state "rebuilt")
    endif()

    qmtest_equal("the catalogue that was touched is released again" "${_zh_state}" "rebuilt")
    qmtest_equal("and the one that was not is left alone" "${_en_state}" "unchanged")
endif()

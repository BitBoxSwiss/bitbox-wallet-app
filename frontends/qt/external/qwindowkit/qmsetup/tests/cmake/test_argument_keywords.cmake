# Every keyword a function declares is read, and every one it reads is declared.
#
# cmake_parse_arguments says nothing about a name that appears in one of those
# two places and not the other. A keyword declared and never read is accepted
# and thrown away, and one read but never declared is always empty. Neither is a
# warning, and neither shows up in a test of what the function does, because the
# argument that would have caught it is the one nobody passed.
#
# That shape has been found here more than a dozen times, in eight functions. It
# costs nothing to ask mechanically, so it is asked here rather than by reading.
#
# This is a lint over the source rather than a test of behaviour, which is why
# it sits at the top of tests/cmake rather than beside any one module.
#
# A keyword that is meant to be accepted and not read is allowed, said with a
# line of its own inside the function:
#
#     # unread-keyword: EXACT

include(${QMTEST_HARNESS})

# QMSetupAPI.cmake and the modules, which is what the public API is made of.
# buildsystem/ and find-modules/ are left out, being neither.
set(_sources "${QMSETUP_MODULES_DIR}/QMSetupAPI.cmake")
file(GLOB_RECURSE _module_sources "${QMSETUP_MODULES_DIR}/modules/*.cmake")
list(SORT _module_sources)
list(APPEND _sources ${_module_sources})

qmtest_true("there are files to read" "${_sources}")

# The two names cmake_parse_arguments answers with by itself.
set(_builtin UNPARSED_ARGUMENTS KEYWORDS_MISSING_VALUES)

set_property(GLOBAL PROPERTY QMTEST_KEYWORD_PROBLEMS "")

# What one function or macro came to, once the whole of it has been read.
function(_check_block _where _name _prefix _declared _candidates _allowed)
    if(NOT _prefix)
        return()
    endif()

    # Of everything that looked like a parsed value, the ones under this
    # function's own prefix.
    set(_used)

    foreach(_item IN LISTS _candidates)
        if(_item MATCHES "^${_prefix}_(.+)$")
            list(APPEND _used "${CMAKE_MATCH_1}")
        endif()
    endforeach()

    if(_used)
        list(REMOVE_DUPLICATES _used)
    endif()

    if(_declared)
        list(REMOVE_DUPLICATES _declared)
    endif()

    set(_unread ${_declared})

    if(_unread)
        list(REMOVE_ITEM _unread ${_used} ${_allowed})
    endif()

    set(_undeclared ${_used})

    if(_undeclared)
        list(REMOVE_ITEM _undeclared ${_declared} ${_builtin})
    endif()

    foreach(_item IN LISTS _unread)
        set_property(GLOBAL APPEND PROPERTY QMTEST_KEYWORD_PROBLEMS
            "${_where} ${_name}: ${_item} is declared and never read")
    endforeach()

    foreach(_item IN LISTS _undeclared)
        set_property(GLOBAL APPEND PROPERTY QMTEST_KEYWORD_PROBLEMS
            "${_where} ${_name}: ${_prefix}_${_item} is read and never declared")
    endforeach()
endfunction()

foreach(_file IN LISTS _sources)
    file(RELATIVE_PATH _where "${QMSETUP_MODULES_DIR}" "${_file}")
    file(STRINGS "${_file}" _lines)

    # One block per function or macro. A definition nested inside one is counted
    # rather than starting a block of its own, so a helper written inside a
    # function does not cut the enclosing one in half.
    set(_depth 0)
    set(_name)
    set(_prefix)
    set(_declared)
    set(_candidates)
    set(_allowed)
    set(_collecting off)

    foreach(_line IN LISTS _lines)
        # A list of keywords may run over several lines, which is how the longer
        # ones here are written, so it is read until its closing bracket.
        if(_collecting)
            string(REGEX MATCHALL "[A-Za-z0-9_]+" _names "${_line}")
            list(APPEND _declared ${_names})

            if(_line MATCHES "\\)")
                set(_collecting off)
            endif()

            continue()
        endif()

        if(_line MATCHES "^[ \t]*end(function|macro)[ \t]*\\(")
            math(EXPR _depth "${_depth} - 1")

            if(_depth LESS_EQUAL 0 AND _name)
                _check_block("${_where}" "${_name}" "${_prefix}"
                    "${_declared}" "${_candidates}" "${_allowed}")
                set(_depth 0)
                set(_name)
                set(_prefix)
                set(_declared)
                set(_candidates)
                set(_allowed)
            endif()

            continue()
        endif()

        if(_line MATCHES "^[ \t]*(function|macro)[ \t]*\\([ \t]*([A-Za-z0-9_]+)")
            math(EXPR _depth "${_depth} + 1")

            if(_depth EQUAL 1)
                set(_name "${CMAKE_MATCH_2}")
            endif()

            continue()
        endif()

        if(_depth LESS 1)
            continue()
        endif()

        if(_line MATCHES "#[ \t]*unread-keyword:[ \t]*([A-Za-z0-9_]+)")
            list(APPEND _allowed "${CMAKE_MATCH_1}")
            continue()
        endif()

        # The three lists, whatever the variables holding them are called. The
        # tail is kept before anything else matches, string(REGEX) being what
        # sets CMAKE_MATCH_n and so what clears the last one.
        if(_line MATCHES "^[ \t]*set[ \t]*\\([ \t]*(options|oneValueArgs|multiValueArgs)[ \t]*(.*)$")
            set(_tail "${CMAKE_MATCH_2}")
            string(REGEX MATCHALL "[A-Za-z0-9_]+" _names "${_tail}")
            list(APPEND _declared ${_names})

            if(NOT _tail MATCHES "\\)")
                set(_collecting on)
            endif()

            continue()
        endif()

        # The prefix is read rather than assumed. Not every function here parses
        # under FUNC, and assuming it did reported two whole files as wrong.
        if(_line MATCHES "cmake_parse_arguments[ \t]*\\([ \t]*([A-Za-z0-9_]+)[ \t]*(.*)$")
            set(_prefix "${CMAKE_MATCH_1}")
            set(_tail "${CMAKE_MATCH_2}")

            # The three lists may be written out here rather than named, which
            # is how the shorter functions do it. Each is one quoted argument,
            # and the keywords in it are semicolon separated.
            string(REGEX MATCHALL "\"[^\"]*\"" _quoted "${_tail}")

            foreach(_group IN LISTS _quoted)
                if(NOT _group MATCHES "\\$")
                    string(REGEX MATCHALL "[A-Za-z0-9_]+" _names "${_group}")
                    list(APPEND _declared ${_names})
                endif()
            endforeach()

            continue()
        endif()

        # Anything shaped like a parsed value. Which of them belong to this
        # function is decided once the prefix is known.
        string(REGEX MATCHALL "[A-Za-z0-9_]+" _words "${_line}")
        list(APPEND _candidates ${_words})
    endforeach()
endforeach()

get_property(_problems GLOBAL PROPERTY QMTEST_KEYWORD_PROBLEMS)

if(_problems)
    string(REPLACE ";" "\n      " _shown "${_problems}")
else()
    set(_shown)
endif()

qmtest_equal("every keyword is both declared and read" "${_shown}" "")

qmtest_report()

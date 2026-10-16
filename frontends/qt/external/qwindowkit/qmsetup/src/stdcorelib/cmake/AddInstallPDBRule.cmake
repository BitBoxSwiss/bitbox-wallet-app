#[[
# Adds an installation rule for a target's native debug symbols.
#
# stdc_add_install_pdb_rule(<target>
#     [DESTINATION <dir>]
# )
#
# MSVC-compatible toolchains install the linker PDB. MinGW and other ELF toolchains split a
# .debug file and add its GNU debug link. macOS generates a .dSYM bundle. Static libraries and
# unsupported platforms do not add an installation rule.
#]]
function(stdc_add_install_pdb_rule _target)
    if(NOT TARGET ${_target})
        message(FATAL_ERROR "stdc_add_install_pdb_rule: '${_target}' is not a target")
    endif()

    set(options)
    set(oneValueArgs DESTINATION)
    set(multiValueArgs)
    cmake_parse_arguments(FUNC "${options}" "${oneValueArgs}" "${multiValueArgs}" ${ARGN})

    if(FUNC_UNPARSED_ARGUMENTS)
        message(FATAL_ERROR
            "stdc_add_install_pdb_rule: unknown arguments: ${FUNC_UNPARSED_ARGUMENTS}"
        )
    endif()

    get_target_property(_target_type ${_target} TYPE)

    if(NOT _target_type MATCHES "^(EXECUTABLE|SHARED_LIBRARY|MODULE_LIBRARY)$")
        return()
    endif()

    if(FUNC_DESTINATION)
        set(_destination "${FUNC_DESTINATION}")
    else()
        include(GNUInstallDirs)
        set(_destination "${CMAKE_INSTALL_BINDIR}")
    endif()

    if(MSVC)
        install(FILES "$<TARGET_PDB_FILE:${_target}>"
            DESTINATION "${_destination}"
            OPTIONAL
        )
        return()
    endif()

    if(IS_ABSOLUTE "${_destination}")
        set(_installed_dir "\$ENV{DESTDIR}${_destination}")
    else()
        set(_installed_dir "\$ENV{DESTDIR}\${CMAKE_INSTALL_PREFIX}/${_destination}")
    endif()

    if(APPLE)
        if(CMAKE_DSYMUTIL)
            set(_dsymutil "${CMAKE_DSYMUTIL}")
        else()
            find_program(_dsymutil dsymutil)
        endif()

        if(NOT _dsymutil OR NOT CMAKE_STRIP)
            message(FATAL_ERROR
                "stdc_add_install_pdb_rule: dsymutil and strip are required on macOS"
            )
        endif()

        install(CODE "
            set(_source \"$<TARGET_FILE:${_target}>\")
            set(_binary \"${_installed_dir}/$<TARGET_FILE_NAME:${_target}>\")
            if(EXISTS \"\${_source}\" AND EXISTS \"\${_binary}\")
                set(_symbols \"\${_binary}.dSYM\")
                execute_process(
                    COMMAND \"${_dsymutil}\" \"\${_source}\" -o \"\${_symbols}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"dsymutil failed for \${_binary}: \${_error}\")
                endif()
                execute_process(
                    COMMAND \"${CMAKE_STRIP}\" -S \"\${_binary}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"strip failed for \${_binary}: \${_error}\")
                endif()
            endif()
        ")
        return()
    endif()

    if(MINGW OR UNIX)
        if(NOT CMAKE_OBJCOPY OR NOT CMAKE_STRIP)
            message(FATAL_ERROR
                "stdc_add_install_pdb_rule: objcopy and strip are required on this toolchain"
            )
        endif()

        install(CODE "
            set(_source \"$<TARGET_FILE:${_target}>\")
            set(_binary \"${_installed_dir}/$<TARGET_FILE_NAME:${_target}>\")
            if(EXISTS \"\${_source}\" AND EXISTS \"\${_binary}\")
                set(_symbols \"\${_binary}.debug\")
                execute_process(
                    COMMAND \"${CMAKE_OBJCOPY}\" --only-keep-debug
                            \"\${_source}\" \"\${_symbols}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"objcopy failed for \${_binary}: \${_error}\")
                endif()
                execute_process(
                    COMMAND \"${CMAKE_STRIP}\" --strip-debug \"\${_binary}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR \"strip failed for \${_binary}: \${_error}\")
                endif()
                execute_process(
                    COMMAND \"${CMAKE_OBJCOPY}\" --add-gnu-debuglink
                            \"\${_symbols}\" \"\${_binary}\"
                    RESULT_VARIABLE _result
                    ERROR_VARIABLE _error
                )
                if(NOT _result EQUAL 0)
                    message(FATAL_ERROR
                        \"adding the debug link failed for \${_binary}: \${_error}\"
                    )
                endif()
            endif()
        ")
    endif()
endfunction()

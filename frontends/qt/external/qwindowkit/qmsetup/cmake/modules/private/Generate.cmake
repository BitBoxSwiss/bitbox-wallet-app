#[[
    Warning: This module is private, may be modified or removed in the future, please use with caution.
]] #

include_guard(DIRECTORY)

#[[
    Create the names of output files preserving relative dirs. (Ported from MOC command)

    qm_make_output_file(<infile> <prefix> <ext> <OUT>)

    OUT: output source file paths
#]]
function(qm_make_output_file _infile _prefix _ext _out)
    string(LENGTH ${CMAKE_CURRENT_BINARY_DIR} _binlength)
    string(LENGTH ${_infile} _infileLength)
    set(_checkinfile ${CMAKE_CURRENT_SOURCE_DIR})

    if(_infileLength GREATER _binlength)
        string(SUBSTRING "${_infile}" 0 ${_binlength} _checkinfile)

        if(_checkinfile STREQUAL "${CMAKE_CURRENT_BINARY_DIR}")
            file(RELATIVE_PATH _name ${CMAKE_CURRENT_BINARY_DIR} ${_infile})
        else()
            file(RELATIVE_PATH _name ${CMAKE_CURRENT_SOURCE_DIR} ${_infile})
        endif()
    else()
        file(RELATIVE_PATH _name ${CMAKE_CURRENT_SOURCE_DIR} ${_infile})
    endif()

    if(CMAKE_HOST_WIN32 AND _name MATCHES "^([a-zA-Z]):(.*)$") # absolute path
        set(_name "${CMAKE_MATCH_1}_${CMAKE_MATCH_2}")
    endif()

    set(_outfile "${CMAKE_CURRENT_BINARY_DIR}/${_name}")
    string(REPLACE ".." "__" _outfile ${_outfile})
    get_filename_component(_outpath ${_outfile} PATH)
    get_filename_component(_outfile ${_outfile} NAME_WLE)

    file(MAKE_DIRECTORY ${_outpath})
    set(${_out} ${_outpath}/${_prefix}${_outfile}.${_ext} PARENT_SCOPE)
endfunction()

#[[
    Create a custom command that writes a binary file out as a C array.

    qm_add_binary_resource(<input> <output>)

    The array is named after the output file, made into an identifier, and the
    number of bytes follows it as <name>_len.
#]]
function(qm_add_binary_resource _input _output)
    # Always the script, never the xxd the machine may have. They do not agree
    # on what to call the array, and cannot be made to.
    #
    # `xxd -i` names it after the input path as that path was written on the
    # command line, so an absolute one becomes _home_me_proj_assets_logo_png and
    # carries the whole checkout in the symbol, while a relative one gives
    # something else again. The script is told the name instead, and works it out
    # from the output. So the same call gave one symbol on a machine with xxd
    # installed and another on a machine without, and the first of the two
    # changed if the checkout moved.
    #
    # Running xxd from the input's own directory only narrows the difference. It
    # answers logo_png where the script answers logo_c, and the input may be a
    # generator expression, so there is no directory to change to until build
    # time anyway.
    get_filename_component(_name ${_output} NAME)
    string(MAKE_C_IDENTIFIER ${_name} _name)

    add_custom_command(
        OUTPUT ${_output}
        COMMAND ${CMAKE_COMMAND}
            -D "input=${_input}"
            -D "output=${_output}"
            -D "name=${_name}"
            -P "${QMSETUP_MODULES_DIR}/scripts/xxd.cmake"
        DEPENDS ${_input}
        VERBATIM
    )
endfunction()

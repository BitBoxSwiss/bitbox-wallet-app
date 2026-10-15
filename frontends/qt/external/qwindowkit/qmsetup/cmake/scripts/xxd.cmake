if(NOT DEFINED input)
    message(FATAL_ERROR "input not defined")
endif()

if(NOT DEFINED output)
    message(FATAL_ERROR "output not defined")
endif()

if(NOT DEFINED name)
    message(FATAL_ERROR "name not defined")
endif()

get_filename_component(_output_dir ${output} DIRECTORY)
if(NOT EXISTS ${_output_dir})
    file(MAKE_DIRECTORY ${_output_dir})
endif()

file(READ ${input} _file_content HEX)
string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1, " _hex_content ${_file_content})
file(WRITE ${output}
    "unsigned char ${name}[] = {${_hex_content}};\n"
    "unsigned int ${name}_len = sizeof(${name});\n"
)
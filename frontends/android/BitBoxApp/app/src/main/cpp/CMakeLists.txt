cmake_minimum_required(VERSION 3.16)

project(signal_handler)

add_library( # Specifies the name of the library.
             signal_handler

             # Sets the library as a shared library.
             SHARED

             # Provides a relative path to your source file(s).
             signal_handler.c
)

find_library(
        log-lib
        log
)

target_link_libraries(
        signal_handler
        ${log-lib}
)

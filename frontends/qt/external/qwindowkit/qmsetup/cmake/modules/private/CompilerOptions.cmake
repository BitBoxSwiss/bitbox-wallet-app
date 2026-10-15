#[[
    Warning: This module is private, may be modified or removed in the future, please use with caution.
]] #

include_guard(DIRECTORY)

#[==[.rst:
.. cmake:command:: qm_compiler_no_warnings

  Disable all possible warnings from the compiler.

  .. code-block:: cmake

    qm_compiler_no_warnings()
#]==]
macro(qm_compiler_no_warnings)
    foreach(__lang C CXX)
        # Padded at both ends, and repeated until nothing more comes off.
        #
        # The patterns want a space on either side of a flag, which the flag at
        # the start or the end of the string does not have, so those were never
        # seen. And a match takes the trailing space with it, which is the space
        # the flag after it needed, so of `-Wall -Wextra` only the first came
        # off. Both showed up wherever the flags were set without a space to
        # spare, which is how anybody writes them.
        set(__flags " ${CMAKE_${__lang}_FLAGS} ")
        set(__before)

        while(NOT __before STREQUAL __flags)
            set(__before "${__flags}")

            if(MSVC)
                string(REGEX REPLACE " [/-]W[01234] " " " __flags "${__flags}")
            else()
                # An alternation rather than two optional groups, which also
                # matched the nothing between them and so took a bare -W with
                # them, along with -Wallextra.
                string(REGEX REPLACE " -W(all|extra)? " " " __flags "${__flags}")
                string(REGEX REPLACE " -W?pedantic " " " __flags "${__flags}")
            endif()
        endwhile()

        string(STRIP "${__flags}" CMAKE_${__lang}_FLAGS)
        string(APPEND CMAKE_${__lang}_FLAGS " -w ")
    endforeach()

    unset(__flags)
    unset(__before)
    if(MSVC)
        add_compile_definitions(-D_CRT_NON_CONFORMING_SWPRINTFS)
        add_compile_definitions(-D_CRT_SECURE_NO_WARNINGS -D_CRT_SECURE_NO_DEPRECATE)
        add_compile_definitions(-D_CRT_NONSTDC_NO_WARNINGS -D_CRT_NONSTDC_NO_DEPRECATE)
        add_compile_definitions(-D_SCL_SECURE_NO_WARNINGS -D_SCL_SECURE_NO_DEPRECATE)
        add_compile_definitions(-D_SILENCE_ALL_MS_EXT_DEPRECATION_WARNINGS)
    else()
        foreach(__lang C CXX)
            string(APPEND CMAKE_${__lang}_FLAGS " -fpermissive ")
        endforeach()
    endif()
endmacro()

#[==[.rst:
.. cmake:command:: qm_compiler_max_warnings

  Enable all possible warnings from the compiler.

  .. code-block:: cmake

    qm_compiler_max_warnings()
#]==]
function(qm_compiler_max_warnings)
    if(MSVC)
        add_compile_options(-W4)
    elseif("x${CMAKE_CXX_COMPILER_ID}" STREQUAL "xClang")
        add_compile_options(-Weverything)
    else()
        add_compile_options(-Wall -Wextra -Wpedantic)
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_compiler_warnings_are_errors

  Treat all warnings as errors.

  .. code-block:: cmake

    qm_compiler_warnings_are_errors()
#]==]
function(qm_compiler_warnings_are_errors)
    if(MSVC)
        add_compile_options(-WX)
    else()
        add_compile_options(-Werror)
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_compiler_no_unknown_options

  Prevent the compiler from receiving unknown parameters.

  .. code-block:: cmake

    qm_compiler_no_unknown_options()
#]==]
function(qm_compiler_no_unknown_options)
    if(MSVC)
        if(MSVC_VERSION GREATER_EQUAL 1930) # Visual Studio 2022 version 17.0
            add_compile_options(-options:strict)
        endif()
        add_link_options(-WX)
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_compiler_eliminate_dead_code

  Remove all unused code from the final binary.

  .. code-block:: cmake

    qm_compiler_eliminate_dead_code()
#]==]
function(qm_compiler_eliminate_dead_code)
    if(MSVC)
        add_compile_options(-Gw -Gy -Zc:inline)
        add_link_options(-OPT:REF -OPT:ICF -OPT:LBR)
        return()
    endif()

    add_compile_options(-ffunction-sections -fdata-sections)

    if(APPLE)
        add_link_options(-Wl,-dead_strip)
        return()
    endif()

    add_link_options(-Wl,--as-needed -Wl,--gc-sections)

    # Not in a configuration that was asked for with debugging in it. Taking
    # every symbol out is not eliminating dead code, and a build made to be
    # debugged has nothing left to debug with once it has been done.
    add_link_options("$<$<NOT:$<CONFIG:Debug,RelWithDebInfo>>:-Wl,--strip-all>")

    # Asked of the linker rather than guessed from the compiler. Folding
    # identical code is a feature of gold and of lld, and a compiler drives
    # whichever linker it was pointed at, so which compiler it is says nothing.
    get_property(_languages GLOBAL PROPERTY ENABLED_LANGUAGES)

    if("CXX" IN_LIST _languages)
        include(CheckLinkerFlag)
        check_linker_flag(CXX "-Wl,--icf=all" QMSETUP_HAVE_LINKER_ICF)

        if(QMSETUP_HAVE_LINKER_ICF)
            add_link_options(-Wl,--icf=all)
        endif()
    endif()
endfunction()

#[==[.rst:
.. cmake:command:: qm_compiler_dont_export_by_default

  Only export symbols which are marked to be exported, just like MSVC.

  .. code-block:: cmake

    qm_compiler_dont_export_by_default()
#]==]
macro(qm_compiler_dont_export_by_default)
    set(CMAKE_C_VISIBILITY_PRESET "hidden")
    set(CMAKE_CXX_VISIBILITY_PRESET "hidden")
    set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)
endmacro()

#[==[.rst:
.. cmake:command:: qm_compiler_enable_secure_code

  Enable all possible security issue mitigations from your compiler.

  .. code-block:: cmake

    qm_compiler_enable_secure_code()
#]==]
macro(qm_compiler_enable_secure_code)
    if(MSVC)
        add_compile_options(-GS -sdl -guard:cf)
        add_link_options(-DYNAMICBASE -FIXED:NO -NXCOMPAT -GUARD:CF)
        if(CMAKE_SIZEOF_VOID_P EQUAL 4)
            add_link_options(-SAFESEH)
        endif()
        if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            add_link_options(-HIGHENTROPYVA)
        endif()
        if(MSVC_VERSION GREATER_EQUAL 1920) # Visual Studio 2019 version 16.0
            add_link_options(-CETCOMPAT)
        endif()
        if(MSVC_VERSION GREATER_EQUAL 1925) # Visual Studio 2019 version 16.5
            add_compile_options(-Qspectre-load)
        elseif(MSVC_VERSION GREATER_EQUAL 1912) # Visual Studio 2017 version 15.5
            add_compile_options(-Qspectre)
        endif()
        if(MSVC_VERSION GREATER_EQUAL 1927) # Visual Studio 2019 version 16.7
            if(CMAKE_SIZEOF_VOID_P EQUAL 8)
                add_compile_options(-guard:ehcont)
                add_link_options(-guard:ehcont)
            endif()
        endif()
        if(MSVC_VERSION GREATER_EQUAL 1930) # Visual Studio 2022 version 17.0
            add_compile_options(-Qspectre-jmp)
        endif()
    elseif(MINGW)
        if("x${CMAKE_CXX_COMPILER_ID}" STREQUAL "xClang")
            add_compile_options(-mguard=cf)
            add_link_options(-mguard=cf)
        else()
        endif()
    else()
        add_compile_options(-mshstk -ftrivial-auto-var-init=pattern
            -fstack-protector-strong -fstack-clash-protection
            -fcf-protection=full)
        add_link_options(-Wl,-z,relro,-z,now)
        if("x${CMAKE_CXX_COMPILER_ID}" STREQUAL "xClang")
            add_compile_options(-mretpoline -mspeculative-load-hardening)
            if(NOT APPLE)
                add_compile_options(-fsanitize=cfi -fsanitize-cfi-cross-dso)
            endif()
        endif()
    endif()
endmacro()

#[==[.rst:
.. cmake:command:: qm_compiler_enable_strict_qt

  Enable all possible Qt coding style policies.

  .. code-block:: cmake

    qm_compiler_enable_strict_qt(
        TARGETS <target1> <target2> ... <targetN>
        [NO_DEPRECATED_API]
        [ALLOW_KEYWORD]
        [ALLOW_UNSAFE_FLAGS]
    )

  ``NO_DEPRECATED_API``
    Disable the use of any deprecated Qt APIs. Only has effect since Qt6.
  ``ALLOW_KEYWORD``
    Allow the use of the traditional Qt keywords such as "signal" "slot" "emit".
  ``ALLOW_UNSAFE_FLAGS``
    Allow the use of the unsafe QFlags (unsafe: can be implicitly cast to and from "int").
#]==]
function(qm_compiler_enable_strict_qt)
    cmake_parse_arguments(arg "NO_DEPRECATED_API;ALLOW_KEYWORD;ALLOW_UNSAFE_FLAGS" "" "TARGETS" ${ARGN})
    if(NOT arg_TARGETS)
        message(AUTHOR_WARNING "qm_compiler_enable_strict_qt: you need to specify at least one target!")
        return()
    endif()
    if(arg_UNPARSED_ARGUMENTS)
        message(AUTHOR_WARNING "qm_compiler_enable_strict_qt: Unrecognized arguments: ${arg_UNPARSED_ARGUMENTS}")
    endif()
    foreach(_target IN LISTS arg_TARGETS)
        if(NOT TARGET ${_target})
            message(AUTHOR_WARNING "qm_compiler_enable_strict_qt: ${_target} is not a valid CMake target!")
            continue()
        endif()
        target_compile_definitions(${_target} PRIVATE
            QT_NO_CAST_TO_ASCII
            QT_NO_CAST_FROM_ASCII
            QT_NO_CAST_FROM_BYTEARRAY
            QT_NO_URL_CAST_FROM_STRING
            QT_NO_NARROWING_CONVERSIONS_IN_CONNECT
            QT_NO_JAVA_STYLE_ITERATORS
            QT_NO_FOREACH QT_NO_QFOREACH
            QT_NO_AS_CONST QT_NO_QASCONST
            QT_NO_EXCHANGE QT_NO_QEXCHANGE
            QT_NO_QPAIR
            QT_NO_INTEGRAL_STRINGS
            QT_NO_USING_NAMESPACE
            QT_NO_CONTEXTLESS_CONNECT
            QT_EXPLICIT_QFILE_CONSTRUCTION_FROM_PATH
            QT_USE_NODISCARD_FILE_OPEN
            QT_USE_QSTRINGBUILDER
            QT_USE_FAST_OPERATOR_PLUS
            QT_DEPRECATED_WARNINGS # Have no effect since 5.13
            QT_DEPRECATED_WARNINGS_SINCE=0x0A0000 # Deprecated since 6.5
            QT_WARN_DEPRECATED_UP_TO=0x0A0000 # Available since 6.5
        )
        if(arg_NO_DEPRECATED_API)
            target_compile_definitions(${_target} PRIVATE
                QT_DISABLE_DEPRECATED_BEFORE=0x0A0000 # Deprecated since 6.5
                QT_DISABLE_DEPRECATED_UP_TO=0x0A0000 # Available since 6.5
            )
        endif()
        # On Windows enabling this flag requires us re-compile Qt with this flag enabled,
        # so only enable it on non-Windows platforms.
        if(NOT WIN32)
            target_compile_definitions(${_target} PRIVATE
                QT_STRICT_ITERATORS
            )
        endif()
        # We handle this flag specially because some Qt headers may still use the
        # traditional keywords (especially some private headers).
        if(NOT arg_ALLOW_KEYWORD)
            target_compile_definitions(${_target} PRIVATE
                QT_NO_KEYWORDS
            )
        endif()
        # We handle this flag specially because some Qt headers may still use the
        # unsafe flags (especially some QtQuick headers).
        if(NOT arg_ALLOW_UNSAFE_FLAGS)
            target_compile_definitions(${_target} PRIVATE
                QT_TYPESAFE_FLAGS
            )
        endif()
    endforeach()
endfunction()

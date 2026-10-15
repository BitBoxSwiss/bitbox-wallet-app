// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_STDC_GLOBAL_H
#define STDCORELIB_STDC_GLOBAL_H

#ifndef __has_attribute
#  define __has_attribute(x) 0
#endif

#ifndef __has_builtin
#  define __has_builtin(x) 0
#endif

#ifdef _WIN32
#  define STDC_DECL_EXPORT __declspec(dllexport)
#  define STDC_DECL_IMPORT __declspec(dllimport)
#  define STDC_DECL_HIDDEN
#else
#  define STDC_DECL_EXPORT __attribute__((visibility("default")))
#  define STDC_DECL_IMPORT __attribute__((visibility("default")))
#  define STDC_DECL_HIDDEN __attribute__((visibility("hidden")))
#endif

#ifndef STDC_EXPORT
#  ifdef STDC_STATIC
#    define STDC_EXPORT
#  else
#    ifdef STDC_LIBRARY
#      define STDC_EXPORT STDC_DECL_EXPORT
#    else
#      define STDC_EXPORT STDC_DECL_IMPORT
#    endif
#  endif
#endif

#define STDC_DISABLE_COPY(Class)                                                                   \
    Class(const Class &) = delete;                                                                 \
    Class &operator=(const Class &) = delete;

#define STDC_DISABLE_MOVE(Class)                                                                   \
    Class(Class &&) = delete;                                                                      \
    Class &operator=(Class &&) = delete;

#define STDC_DISABLE_COPY_MOVE(Class)                                                              \
    STDC_DISABLE_COPY(Class)                                                                       \
    STDC_DISABLE_MOVE(Class)

#if defined(__GNUC__) || defined(__clang__)
#  define STDC_PRINTF_FORMAT(fmtpos, attrpos)                                                      \
      __attribute__((__format__(__printf__, fmtpos, attrpos)))
#  define STDC_SCANF_FORMAT(fmtpos, attrpos) __attribute__((__format__(__scanf__, fmtpos, attrpos)))
#else
#  define STDC_PRINTF_FORMAT(fmtpos, attrpos)
#  define STDC_SCANF_FORMAT
#endif

#if defined(_MSC_VER)
#  define STDC_NOINLINE __declspec(noinline)
#  define STDC_INLINE   __forceinline
#  define STDC_USED
#  define STDC_DEPRECATED __declspec(deprecated)
#else
#  define STDC_NOINLINE   __attribute__((noinline))
#  define STDC_INLINE     __attribute__((always_inline))
#  define STDC_USED       __attribute__((used))
#  define STDC_DEPRECATED __attribute__((__deprecated__))
#endif

#if __has_builtin(__builtin_expect) || defined(__GNUC__)
#  define STDC_LIKELY(EXPR)   __builtin_expect((bool) (EXPR), true)
#  define STDC_UNLIKELY(EXPR) __builtin_expect((bool) (EXPR), false)
#else
#  define STDC_LIKELY(EXPR)   (EXPR)
#  define STDC_UNLIKELY(EXPR) (EXPR)
#endif

#ifndef __has_cpp_attribute
#  define __has_cpp_attribute(x) 0
#endif

#if __has_cpp_attribute(no_unique_address) >= 201803L
#  define STDC_NO_UNIQUE_ADDRESS [[no_unique_address]]
#elif defined(_MSC_VER) && _MSC_VER >= 1929
#  define STDC_NO_UNIQUE_ADDRESS [[msvc::no_unique_address]]
#else
#  define STDC_NO_UNIQUE_ADDRESS
#endif

// STDC_HAS_EXCEPTIONS is about the translation unit being compiled right now, whoever is
// compiling it. It is what header code has to ask, since a header is compiled by its caller: an
// inline function that throws may only exist where the caller can throw.
#if defined(__cpp_exceptions) || defined(__EXCEPTIONS) || defined(_CPPUNWIND)
#  define STDC_HAS_EXCEPTIONS 1
#endif

#ifndef STDC_TSTR
#  ifdef _WIN32
#    define STDC_TSTR(T) L##T
#  else
#    define STDC_TSTR(T) T
#  endif
#endif

#endif // STDCORELIB_STDC_GLOBAL_H

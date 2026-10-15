#ifndef QMSETUP_GLOBAL_H
#define QMSETUP_GLOBAL_H

#ifdef _WIN32
#  define QMSETUP_DECL_EXPORT __declspec(dllexport)
#  define QMSETUP_DECL_IMPORT __declspec(dllimport)
#else
#  define QMSETUP_DECL_EXPORT __attribute__((visibility("default")))
#  define QMSETUP_DECL_IMPORT
#endif

#endif // QMSETUP_GLOBAL_H

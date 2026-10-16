#ifndef QMTEST_INSTALL_LIB_H
#define QMTEST_INSTALL_LIB_H

#ifdef _WIN32
#  define QMTEST_EXPORT __declspec(dllexport)
#else
#  define QMTEST_EXPORT __attribute__((visibility("default")))
#endif

#endif

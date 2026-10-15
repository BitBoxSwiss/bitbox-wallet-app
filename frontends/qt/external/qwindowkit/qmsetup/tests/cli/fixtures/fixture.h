/* Explicitly exported, so that nothing here is dropped for being unreferenced.
   A plugin's entry point has no caller, and with it goes the import that makes
   the plugin worth deploying. */

#ifndef QMTEST_FIXTURE_H
#define QMTEST_FIXTURE_H

#if defined(_WIN32)
#  define QMTEST_EXPORT __declspec(dllexport)
#else
#  define QMTEST_EXPORT __attribute__((visibility("default")))
#endif

#endif /* QMTEST_FIXTURE_H */

// SPDX-License-Identifier: MIT

// A module with a dependency of its own, sitting in a directory that is on no search path the
// loader consults by default. Loading it is what SearchLibraryLoadDirectoryHint is for.

#include <stdcorelib/stdc_global.h>

extern "C" STDC_DECL_IMPORT int test_sharedlibrary_dependency_answer();

extern "C" STDC_DECL_EXPORT int test_sharedlibrary_needs_dependency_answer() {
    return test_sharedlibrary_dependency_answer();
}

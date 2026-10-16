// SPDX-License-Identifier: MIT

// The private dependency of test_sharedlibrary_needs_dependency, put beside it in a directory of
// its own so that a loader which does not look there cannot find it.

#include <stdcorelib/stdc_global.h>

extern "C" STDC_DECL_EXPORT int test_sharedlibrary_dependency_answer() {
    return 7;
}

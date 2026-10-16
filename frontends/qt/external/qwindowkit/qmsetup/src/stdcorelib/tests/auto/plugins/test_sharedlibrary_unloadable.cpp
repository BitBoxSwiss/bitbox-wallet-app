// SPDX-License-Identifier: MIT

// A module for the SharedLibrary tests and nothing else, so that "is it still loaded" is a
// question about the case asking rather than about what another suite left behind. It links
// nothing, the one header it reads being preprocessor and no symbols, so loading it pulls in no
// dependency that could keep it alive.

#include <stdcorelib/stdc_global.h>

extern "C" STDC_DECL_EXPORT int test_sharedlibrary_unloadable_answer() {
    return 42;
}

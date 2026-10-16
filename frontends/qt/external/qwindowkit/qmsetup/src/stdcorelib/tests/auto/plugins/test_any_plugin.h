// SPDX-License-Identifier: MIT

#ifndef STDC_TEST_ANY_PLUGIN_H
#define STDC_TEST_ANY_PLUGIN_H

#include <stdcorelib/adt/any.h>

#define TEST_ANY_PLUGIN_API extern "C" STDC_DECL_EXPORT

/// Spelled out of this one header on both sides of the boundary, which is the case that decides
/// whether identity survives.
struct AnyPluginPayload {
    int value;
};

/// Puts a payload the plugin made into an any the caller owns.
TEST_ANY_PLUGIN_API void any_plugin_fill(stdc::any *out, int value);

/// Reads a payload the caller made, from inside the plugin.
TEST_ANY_PLUGIN_API bool any_plugin_read(const stdc::any *value, int *out);

/// The address of the plugin's own record for the payload type, so a test can tell whether the
/// two modules really do have separate ones.
TEST_ANY_PLUGIN_API const void *any_plugin_entry();

#endif // STDC_TEST_ANY_PLUGIN_H

// SPDX-License-Identifier: MIT

#ifndef STDC_TEST_DYNAMICREGISTRY_PLUGIN_H
#define STDC_TEST_DYNAMICREGISTRY_PLUGIN_H

#include <stdcorelib/support/dynamicregistry.h>

#define TEST_DYNAMICREGISTRY_PLUGIN_API extern "C" STDC_DECL_EXPORT

/// The kind of thing a plugin registers. Declared here so that the host names the same type, and
/// therefore asks for the same registry.
struct PluginWidget {
    virtual ~PluginWidget() = default;
    virtual int tag() const = 0;
};

/// Registers an entry, from inside the plugin.
TEST_DYNAMICREGISTRY_PLUGIN_API bool registry_plugin_add(const char *name, int tag);

/// How many entries the plugin can see, which is the question that matters.
TEST_DYNAMICREGISTRY_PLUGIN_API size_t registry_plugin_size();

/// The address of the registry the plugin reached, to show whose it is.
TEST_DYNAMICREGISTRY_PLUGIN_API const void *registry_plugin_address();

#endif // STDC_TEST_DYNAMICREGISTRY_PLUGIN_H

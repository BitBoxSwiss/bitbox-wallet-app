// SPDX-License-Identifier: MIT

#include "test_dynamicregistry_plugin.h"

namespace {

    struct PluginWidgetImpl : PluginWidget {
        explicit PluginWidgetImpl(int t) : _tag(t) {
        }
        int tag() const override {
            return _tag;
        }
        int _tag;
    };

}

TEST_DYNAMICREGISTRY_PLUGIN_API bool registry_plugin_add(const char *name, int tag) {
    return stdc::DynamicRegistry<PluginWidget>::instance().add(
        name, "registered by the plugin",
        [tag] { return std::unique_ptr<PluginWidget>(new PluginWidgetImpl(tag)); });
}

TEST_DYNAMICREGISTRY_PLUGIN_API size_t registry_plugin_size() {
    return stdc::DynamicRegistry<PluginWidget>::instance().size();
}

TEST_DYNAMICREGISTRY_PLUGIN_API const void *registry_plugin_address() {
    return &stdc::DynamicRegistry<PluginWidget>::instance();
}

// SPDX-License-Identifier: MIT

#include <cstddef>

#include "test_staticregistry_hub.h"

namespace {

    class ModuleWidget : public HubWidget {
    public:
        int tag() const override {
            return 7;
        }
    };

    HubRegistry::Add<ModuleWidget> entry(TEST_STATICREGISTRY_PLUGIN_ENTRY,
                                         "registered by a module");

}

extern "C" STDC_DECL_EXPORT size_t staticregistry_plugin_size() {
    size_t n = 0;
    for (const auto &entry : HubRegistry::entries()) {
        (void) entry;
        ++n;
    }
    return n;
}

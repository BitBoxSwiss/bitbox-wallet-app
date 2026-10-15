// SPDX-License-Identifier: MIT

#ifndef STDC_TEST_STATICREGISTRY_HUB_H
#define STDC_TEST_STATICREGISTRY_HUB_H

#include <stdcorelib/support/staticregistry.h>

#ifdef TEST_STATICREGISTRY_HUB_LIBRARY
#  define TEST_STATICREGISTRY_HUB_API STDC_DECL_EXPORT
#else
#  define TEST_STATICREGISTRY_HUB_API STDC_DECL_IMPORT
#endif

/// The type both sides name, so that both mean the same registry.
struct HubWidget {
    virtual ~HubWidget() = default;
    virtual int tag() const = 0;
};

STDC_DECLARE_EXPORTED_STATIC_REGISTRY(HubWidget, TEST_STATICREGISTRY_HUB_API)

using HubRegistry = stdc::StaticRegistry<HubWidget>;

/// The name a loaded module registers under, spelled once for both sides.
#define TEST_STATICREGISTRY_PLUGIN_ENTRY "module-widget"

/// The symbol the module exports, answering how many entries it can see.
#define TEST_STATICREGISTRY_PLUGIN_SIZE_SYMBOL "staticregistry_plugin_size"

#endif // STDC_TEST_STATICREGISTRY_HUB_H

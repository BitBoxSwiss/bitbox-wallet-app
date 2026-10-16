// SPDX-License-Identifier: MIT

#include <stdcorelib/support/staticregistry.h>

#include <boost/test/unit_test.hpp>

namespace {

    struct Descriptor {
        int value;
    };

}

namespace stdc {

    template <>
    struct static_registry_traits<Descriptor> {
        using result_type = Descriptor;

        template <class V>
        static result_type construct() {
            return V();
        }
    };

}

STDC_STATIC_REGISTRY(Descriptor)

namespace {

    using DescriptorRegistry = stdc::StaticRegistry<Descriptor>;
    DescriptorRegistry::AddFactory descriptor_entry("answer", "",
                                                     []() -> Descriptor { return {42}; });

}

BOOST_AUTO_TEST_SUITE(test_staticregistry_traits)

BOOST_AUTO_TEST_CASE(test_value_result) {
    const auto descriptor = DescriptorRegistry::begin()->instantiate();
    BOOST_CHECK_EQUAL(descriptor.value, 42);
}

BOOST_AUTO_TEST_SUITE_END()

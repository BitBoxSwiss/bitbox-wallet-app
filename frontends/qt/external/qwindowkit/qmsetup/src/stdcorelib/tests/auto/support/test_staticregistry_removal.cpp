// SPDX-License-Identifier: MIT

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <stdcorelib/support/staticregistry.h>

#include <boost/test/unit_test.hpp>

namespace {

    class Widget {
    public:
        virtual ~Widget() = default;
    };

    class Button : public Widget {};

}

STDC_STATIC_REGISTRY(Widget)

namespace {

    // Nothing is registered at namespace scope here, unlike test_staticregistry.cpp, so every
    // position in the list belongs to the case under test.
    using WidgetRegistry = stdc::StaticRegistry<Widget>;

    using Registration = std::optional<WidgetRegistry::Add<Button>>;

    std::vector<std::string> names() {
        std::vector<std::string> v;
        for (const auto &entry : WidgetRegistry::entries()) {
            v.push_back(std::string(entry.name()));
        }
        return v;
    }

}

BOOST_AUTO_TEST_SUITE(test_staticregistry_removal)

BOOST_AUTO_TEST_CASE(test_starts_empty) {
    BOOST_CHECK(WidgetRegistry::begin() == WidgetRegistry::end());
    BOOST_CHECK(names().empty());
}

// A registration that is not a static object takes itself out again when it goes out of scope,
// which is what makes a plugin's entries leave with the plugin.
BOOST_AUTO_TEST_CASE(test_scope_takes_it_back_out) {
    {
        WidgetRegistry::Add<Button> one("one", "");
        BOOST_CHECK_EQUAL(names().size(), 1u);
    }
    BOOST_CHECK(names().empty());

    {
        WidgetRegistry::AddFactory two(
            "two", "", []() -> std::unique_ptr<Widget> { return std::make_unique<Button>(); });
        BOOST_CHECK_EQUAL(names().size(), 1u);
    }
    BOOST_CHECK(names().empty());
}

// Emptying the list has to put the tail back to null as well. A stale tail is not visible by
// iterating, it shows up on the next registration, which appends through a pointer to an object
// that is already gone.
BOOST_AUTO_TEST_CASE(test_registering_again_after_emptying) {
    {
        WidgetRegistry::Add<Button> first("first", "");
    }
    WidgetRegistry::Add<Button> second("second", "");

    const auto v = names();
    BOOST_REQUIRE_EQUAL(v.size(), 1u);
    BOOST_CHECK_EQUAL(v[0], "second");
}

BOOST_AUTO_TEST_CASE(test_removing_the_head) {
    Registration a, b, c;
    a.emplace("a", "");
    b.emplace("b", "");
    c.emplace("c", "");

    a.reset();

    const auto v = names();
    BOOST_REQUIRE_EQUAL(v.size(), 2u);
    BOOST_CHECK_EQUAL(v[0], "b");
    BOOST_CHECK_EQUAL(v[1], "c");
}

BOOST_AUTO_TEST_CASE(test_removing_the_middle) {
    Registration a, b, c;
    a.emplace("a", "");
    b.emplace("b", "");
    c.emplace("c", "");

    b.reset();

    const auto v = names();
    BOOST_REQUIRE_EQUAL(v.size(), 2u);
    BOOST_CHECK_EQUAL(v[0], "a");
    BOOST_CHECK_EQUAL(v[1], "c");
}

BOOST_AUTO_TEST_CASE(test_removing_the_tail) {
    Registration a, b, c;
    a.emplace("a", "");
    b.emplace("b", "");
    c.emplace("c", "");

    c.reset();
    // The tail moved back to b, so what comes next goes after b rather than after a freed node.
    Registration d;
    d.emplace("d", "");

    const auto v = names();
    BOOST_REQUIRE_EQUAL(v.size(), 3u);
    BOOST_CHECK_EQUAL(v[0], "a");
    BOOST_CHECK_EQUAL(v[1], "b");
    BOOST_CHECK_EQUAL(v[2], "d");
}

// Destruction order is not registration order. A plugin unloading takes out entries that were
// registered before entries the host still holds.
BOOST_AUTO_TEST_CASE(test_removing_out_of_order) {
    Registration a, b, c, d;
    a.emplace("a", "");
    b.emplace("b", "");
    c.emplace("c", "");
    d.emplace("d", "");

    b.reset();
    d.reset();
    a.reset();

    const auto v = names();
    BOOST_REQUIRE_EQUAL(v.size(), 1u);
    BOOST_CHECK_EQUAL(v[0], "c");

    c.reset();
    BOOST_CHECK(names().empty());
}

BOOST_AUTO_TEST_SUITE_END()

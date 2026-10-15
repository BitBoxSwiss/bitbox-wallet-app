// SPDX-License-Identifier: MIT

#include <string>
#include <unordered_map>
#include <vector>

#include <stdcorelib/adt/type_id.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_type_id)

namespace {

    struct Base {
        int b;
    };
    struct Derived : Base {
        int d;
    };

    // Two types that are laid out the same, to make sure identity is not accidentally about size
    // or shape.
    struct Twin1 {
        int x;
    };
    struct Twin2 {
        int x;
    };

}

BOOST_AUTO_TEST_CASE(test_a_type_equals_itself) {
    BOOST_CHECK(type_id::of<int>() == type_id::of<int>());
    BOOST_CHECK(type_id::of<std::string>() == type_id::of<std::string>());
    BOOST_CHECK(type_id::of<std::vector<int>>() == type_id::of<std::vector<int>>());
}

BOOST_AUTO_TEST_CASE(test_different_types_differ) {
    BOOST_CHECK(type_id::of<int>() != type_id::of<unsigned>());
    BOOST_CHECK(type_id::of<int>() != type_id::of<long>()); // same width on Windows
    BOOST_CHECK(type_id::of<Twin1>() != type_id::of<Twin2>());
    BOOST_CHECK(type_id::of<std::vector<int>>() != type_id::of<std::vector<unsigned>>());

    // a base and a derived are simply two types here, with no relation between them
    BOOST_CHECK(type_id::of<Base>() != type_id::of<Derived>());
}

BOOST_AUTO_TEST_CASE(test_qualifiers_are_stripped) {
    BOOST_CHECK(type_id::of<int>() == type_id::of<const int>());
    BOOST_CHECK(type_id::of<int>() == type_id::of<int &>());
    BOOST_CHECK(type_id::of<int>() == type_id::of<const int &>());
    BOOST_CHECK(type_id::of<int>() == type_id::of<int &&>());

    // but a pointer to a type is a different type
    BOOST_CHECK(type_id::of<int>() != type_id::of<int *>());
    BOOST_CHECK(type_id::of<int *>() != type_id::of<const int *>());
}

BOOST_AUTO_TEST_CASE(test_empty_ids_compare_equal) {
    type_id none;
    BOOST_CHECK(!none);
    BOOST_CHECK(none.name().empty());
    BOOST_CHECK(none != type_id::of<int>());
    BOOST_CHECK(none == none);
    BOOST_CHECK(none == type_id());
    BOOST_CHECK(!(none != type_id()));
    BOOST_CHECK_EQUAL(std::hash<type_id>()(none), std::hash<type_id>()(type_id()));

    BOOST_CHECK(static_cast<bool>(type_id::of<int>()));
}

BOOST_AUTO_TEST_CASE(test_name_is_readable) {
    // the exact spelling belongs to the compiler, so only check the part they all agree on
    BOOST_CHECK(type_id::of<int>().name().find("int") != std::string_view::npos);
    BOOST_CHECK(type_id::of<Derived>().name().find("Derived") != std::string_view::npos);
    BOOST_CHECK(type_id::of<std::string>().name().find("string") != std::string_view::npos);

    // and it is the same view every time, not rebuilt per call
    BOOST_CHECK(type_id::of<int>().name().data() == type_id::of<int>().name().data());
}

// Ids compare by a canonical address once two modules are involved, so a hash has to be taken
// over that same address or two equal ids could land in different buckets.
BOOST_AUTO_TEST_CASE(test_usable_as_a_key) {
    std::unordered_map<type_id, std::string> names;
    names[type_id::of<int>()] = "int";
    names[type_id::of<double>()] = "double";
    names[type_id::of<Twin1>()] = "twin one";

    BOOST_CHECK_EQUAL(names.size(), 3u);
    BOOST_CHECK_EQUAL(names[type_id::of<int>()], "int");
    BOOST_CHECK_EQUAL(names[type_id::of<Twin1>()], "twin one");
    BOOST_CHECK(names.find(type_id::of<Twin2>()) == names.end());

    BOOST_CHECK_EQUAL(std::hash<type_id>()(type_id::of<int>()),
                      std::hash<type_id>()(type_id::of<const int &>()));
}

BOOST_AUTO_TEST_CASE(test_copyable_and_small) {
    auto id = type_id::of<Derived>();
    auto copy = id;
    BOOST_CHECK(copy == id);

    // it is meant to be passed around by value
    BOOST_CHECK_EQUAL(sizeof(type_id), sizeof(void *));
}

BOOST_AUTO_TEST_SUITE_END()

// SPDX-License-Identifier: MIT

#include <set>
#include <sstream>
#include <unordered_map>
#include <unordered_set>

#include <stdcorelib/support/versionnumber.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_versionnumber)

BOOST_AUTO_TEST_CASE(test_construct) {
    // default is all zeros
    {
        VersionNumber v;
        BOOST_CHECK_EQUAL(v.major(), 0);
        BOOST_CHECK_EQUAL(v.minor(), 0);
        BOOST_CHECK_EQUAL(v.patch(), 0);
        BOOST_CHECK_EQUAL(v.tweak(), 0);
        BOOST_CHECK(v.isEmpty());
    }

    // the trailing components default to zero
    {
        VersionNumber v(1);
        BOOST_CHECK_EQUAL(v.major(), 1);
        BOOST_CHECK_EQUAL(v.minor(), 0);
        BOOST_CHECK_EQUAL(v.patch(), 0);
        BOOST_CHECK_EQUAL(v.tweak(), 0);
        BOOST_CHECK(!v.isEmpty());
    }

    {
        VersionNumber v(1, 2, 3, 4);
        BOOST_CHECK_EQUAL(v.major(), 1);
        BOOST_CHECK_EQUAL(v.minor(), 2);
        BOOST_CHECK_EQUAL(v.patch(), 3);
        BOOST_CHECK_EQUAL(v.tweak(), 4);
    }

    // any non-zero component makes it non-empty
    BOOST_CHECK(!VersionNumber(0, 0, 0, 1).isEmpty());
    BOOST_CHECK(!VersionNumber(0, 1).isEmpty());
    BOOST_CHECK(VersionNumber(0, 0, 0, 0).isEmpty());
}

BOOST_AUTO_TEST_CASE(test_fromString) {
    BOOST_CHECK(VersionNumber::fromString("1") == VersionNumber(1));
    BOOST_CHECK(VersionNumber::fromString("1.2") == VersionNumber(1, 2));
    BOOST_CHECK(VersionNumber::fromString("1.2.3") == VersionNumber(1, 2, 3));
    BOOST_CHECK(VersionNumber::fromString("1.2.3.4") == VersionNumber(1, 2, 3, 4));

    // Leading zeros are read as the number they are.
    BOOST_CHECK(VersionNumber::fromString("01.02.03") == VersionNumber(1, 2, 3));
    BOOST_CHECK(VersionNumber::fromString("2024.11.30") == VersionNumber(2024, 11, 30));
    BOOST_CHECK(VersionNumber::fromString("0") == VersionNumber());
}

// Anything that is not a version is nothing rather than the part of one it could get to. All of
// these used to come back as a VersionNumber, and "abc" and "0" were the same answer.
BOOST_AUTO_TEST_CASE(test_fromString_refuses_what_is_not_a_version) {
    for (const auto *given : {
             "",          // nothing at all
             "abc",       // a word
             "x.2",       // a word where the first component goes
             "1.x",       // and where a later one goes
             "1.2.x",     //
             "1.2.3abc",  // digits and then something else, which used to read as 1.2.3
             "1.2.3.4.5", // more components than there are places for
             "1.",        // a trailing dot, so an empty component
             ".1",        // and a leading one
             "1..2",      // and one in the middle
             "1.-2",      // a minus, which from_chars reads into an int quite happily
             "-1",        //
             "1.2.3.4.",  // full up and then a dot
             " 1.2",      // blanks are not part of a version
             "1.2 ",      //
             "+1",        // from_chars refuses this one, but say so here rather than rely on it
             "1.2.3999999999999", // digits throughout and past what an int holds
         }) {
        BOOST_CHECK_MESSAGE(!VersionNumber::fromString(given).has_value(),
                            "\"" + std::string(given) + "\" was read as a version");
    }

    // A view over nothing at all, whose data() is null rather than pointing at a terminator.
    // The answer is the same as for the empty string, and the reason for asking separately is
    // that the range handed to from_chars is not the same one.
    BOOST_CHECK(!VersionNumber::fromString(std::string_view()).has_value());

    // One component too many is refused rather than written past the end of the four there are.
    BOOST_CHECK(!VersionNumber::fromString("1.2.3.4.5").has_value());
    BOOST_CHECK(!VersionNumber::fromString("1.2.3.4.5.6.7.8.9").has_value());
}

BOOST_AUTO_TEST_CASE(test_toString) {
    // trailing zero components are dropped, but never below "major.minor"
    BOOST_CHECK_EQUAL(VersionNumber(1, 2, 3, 4).toString(), "1.2.3.4");
    BOOST_CHECK_EQUAL(VersionNumber(1, 2, 3).toString(), "1.2.3");
    BOOST_CHECK_EQUAL(VersionNumber(1, 2).toString(), "1.2");
    BOOST_CHECK_EQUAL(VersionNumber(1).toString(), "1.0");
    BOOST_CHECK_EQUAL(VersionNumber().toString(), "0.0");

    // a non-zero tweak keeps the zero components before it
    BOOST_CHECK_EQUAL(VersionNumber(1, 0, 0, 4).toString(), "1.0.0.4");
    BOOST_CHECK_EQUAL(VersionNumber(1, 0, 3).toString(), "1.0.3");

    // round trip through fromString for the forms toString can produce
    for (const auto &v : {VersionNumber(1, 2, 3, 4), VersionNumber(1, 2, 3), VersionNumber(1, 2),
                          VersionNumber(1), VersionNumber()}) {
        BOOST_CHECK(VersionNumber::fromString(v.toString()) == v);
    }
}

BOOST_AUTO_TEST_CASE(test_compare) {
    stdc::VersionNumber v1(1, 2, 3);
    stdc::VersionNumber v2(1, 2, 3);
    stdc::VersionNumber v3(1, 2, 4);
    stdc::VersionNumber v4(1, 3, 3);
    stdc::VersionNumber v5(2, 2, 3);

    BOOST_CHECK(v1 == v2);
    BOOST_CHECK(v1 < v3);
    BOOST_CHECK(v1 < v4);
    BOOST_CHECK(v1 < v5);
    BOOST_CHECK(v3 > v1);
    BOOST_CHECK(v4 > v1);
    BOOST_CHECK(v5 > v1);

    // inequality
    BOOST_CHECK(!(v1 != v2));
    BOOST_CHECK(v1 != v3);

    // the tweak component takes part in ordering
    BOOST_CHECK(VersionNumber(1, 2, 3, 1) > VersionNumber(1, 2, 3));
    BOOST_CHECK(VersionNumber(1, 2, 3) < VersionNumber(1, 2, 3, 1));
    BOOST_CHECK(VersionNumber(1, 2, 3, 4) != VersionNumber(1, 2, 3, 5));

    // <= and >= are the non-strict forms
    BOOST_CHECK(v1 <= v2);
    BOOST_CHECK(v1 >= v2);
    BOOST_CHECK(v1 <= v3);
    BOOST_CHECK(v3 >= v1);
    BOOST_CHECK(!(v3 <= v1));
    BOOST_CHECK(!(v1 >= v3));

    // a strict ordering: nothing is less than itself
    BOOST_CHECK(!(v1 < v1));
    BOOST_CHECK(!(v1 > v1));

    // an earlier component dominates the later ones
    BOOST_CHECK(VersionNumber(2, 0, 0, 0) > VersionNumber(1, 99, 99, 99));
    BOOST_CHECK(VersionNumber(1, 2, 0, 0) > VersionNumber(1, 1, 99, 99));
}

BOOST_AUTO_TEST_CASE(test_hash) {
    std::hash<VersionNumber> hasher;

    // equal versions hash equally
    BOOST_CHECK_EQUAL(hasher(VersionNumber(1, 2, 3)), hasher(VersionNumber(1, 2, 3)));
    BOOST_CHECK_EQUAL(hasher(VersionNumber()), hasher(VersionNumber()));

    // different versions hash differently
    BOOST_CHECK(hasher(VersionNumber(1, 2, 3)) != hasher(VersionNumber(1, 2, 4)));
    BOOST_CHECK(hasher(VersionNumber(1, 0)) != hasher(VersionNumber(2, 0)));

    // The components are folded in order, so a permutation of them does not collide. They used
    // to be xored together, which is commutative, and 1.2.3 hashed the same as 3.2.1.
    BOOST_CHECK(hasher(VersionNumber(1, 2, 3)) != hasher(VersionNumber(3, 2, 1)));
    BOOST_CHECK(hasher(VersionNumber(1, 2)) != hasher(VersionNumber(2, 1)));
    BOOST_CHECK(hasher(VersionNumber(1, 2, 3, 4)) != hasher(VersionNumber(4, 3, 2, 1)));

    // a component moving between positions is a different version and hashes differently
    BOOST_CHECK(hasher(VersionNumber(1, 0, 0)) != hasher(VersionNumber(0, 1, 0)));
    BOOST_CHECK(hasher(VersionNumber(0, 0, 1)) != hasher(VersionNumber(0, 1, 0)));

    // no wide spread of collisions across a realistic range of versions
    {
        std::set<size_t> hashes;
        int count = 0;
        for (int major = 0; major < 12; ++major) {
            for (int minor = 0; minor < 12; ++minor) {
                for (int patch = 0; patch < 12; ++patch) {
                    hashes.insert(hasher(VersionNumber(major, minor, patch)));
                    ++count;
                }
            }
        }
        BOOST_CHECK_EQUAL(hashes.size(), size_t(count));
    }

    // usable as a key in the unordered containers
    std::unordered_set<VersionNumber> set;
    set.insert(VersionNumber(1, 0));
    set.insert(VersionNumber(1, 0)); // duplicate
    set.insert(VersionNumber(2, 0));
    BOOST_CHECK_EQUAL(set.size(), 2u);
    BOOST_CHECK(set.count(VersionNumber(1, 0)) == 1);
    BOOST_CHECK(set.count(VersionNumber(3, 0)) == 0);

    std::unordered_map<VersionNumber, std::string> map;
    map[VersionNumber(1, 2, 3)] = "a";
    map[VersionNumber(1, 2, 3)] = "b"; // overwrites
    BOOST_CHECK_EQUAL(map.size(), 1u);
    BOOST_CHECK_EQUAL(map[VersionNumber(1, 2, 3)], "b");
}

BOOST_AUTO_TEST_CASE(test_ostream) {
    std::ostringstream oss;
    oss << VersionNumber(1, 2, 3);
    BOOST_CHECK_EQUAL(oss.str(), "VersionNumber(1.2.3)");

    std::ostringstream oss2;
    oss2 << VersionNumber();
    BOOST_CHECK_EQUAL(oss2.str(), "VersionNumber(0.0)");
}

BOOST_AUTO_TEST_SUITE_END()

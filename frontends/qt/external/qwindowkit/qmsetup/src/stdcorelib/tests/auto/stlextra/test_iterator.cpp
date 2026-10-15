// SPDX-License-Identifier: MIT

#include <stdcorelib/stlextra/iterator.h>

#include <iterator>
#include <type_traits>
#include <vector>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_iterator)

namespace {

    struct Point {
        int x;
        int y;
    };

    // The iterator stores `base - 1`, so a range must never start at the very first element of
    // the array: every test below views arr[1..] and keeps arr[0] as a landing slot for rend().
    int arr[] = {-1, 10, 20, 30, 40};
    constexpr int *range_begin = arr + 1;
    constexpr int *range_end = arr + 5;

    using RIter = reverse_iterator<int *>;

}

BOOST_AUTO_TEST_CASE(test_traits) {
    static_assert(std::is_same_v<RIter::value_type, int>);
    static_assert(std::is_same_v<RIter::pointer, int *>);
    static_assert(std::is_same_v<RIter::reference, int &>);
    static_assert(std::is_same_v<RIter::iterator_type, int *>);
    static_assert(std::is_same_v<RIter::iterator_category, std::random_access_iterator_tag>);

    BOOST_CHECK(true); // the checks above are compile time
}

BOOST_AUTO_TEST_CASE(test_deref_and_base) {
    RIter it(range_end);
    BOOST_CHECK_EQUAL(*it, 40); // points at the last element
    BOOST_CHECK_EQUAL(it.base(), range_end);

    RIter last(range_begin + 1);
    BOOST_CHECK_EQUAL(*last, 10);
    BOOST_CHECK_EQUAL(last.base(), range_begin + 1);

    // operator-> forwards to the underlying iterator
    Point points[] = {
        {0, 0},
        {1, 2},
        {3, 4}
    };
    reverse_iterator<Point *> pit(points + 3);
    BOOST_CHECK_EQUAL(pit->x, 3);
    BOOST_CHECK_EQUAL(pit->y, 4);
}

BOOST_AUTO_TEST_CASE(test_traverse) {
    // a full reverse walk yields the elements back to front
    std::vector<int> seen;
    for (RIter it(range_end); it != RIter(range_begin); ++it) {
        seen.push_back(*it);
    }
    BOOST_REQUIRE_EQUAL(seen.size(), 4u);
    BOOST_CHECK_EQUAL(seen[0], 40);
    BOOST_CHECK_EQUAL(seen[1], 30);
    BOOST_CHECK_EQUAL(seen[2], 20);
    BOOST_CHECK_EQUAL(seen[3], 10);

    // pre/post increment
    RIter it(range_end);
    BOOST_CHECK_EQUAL(*(++it), 30);
    BOOST_CHECK_EQUAL(*(it++), 30); // post returns the old position
    BOOST_CHECK_EQUAL(*it, 20);

    // pre/post decrement walks back towards the end of the array
    BOOST_CHECK_EQUAL(*(--it), 30);
    BOOST_CHECK_EQUAL(*(it--), 30);
    BOOST_CHECK_EQUAL(*it, 40);
}

BOOST_AUTO_TEST_CASE(test_random_access) {
    RIter it(range_end); // 40

    BOOST_CHECK_EQUAL(*(it + 1), 30);
    BOOST_CHECK_EQUAL(*(it + 3), 10);

    RIter far = it + 3; // 10
    BOOST_CHECK_EQUAL(*(far - 1), 20);
    BOOST_CHECK_EQUAL(*(far - 3), 40);

    // subscript is relative to the current position, in reverse order
    BOOST_CHECK_EQUAL(it[0], 40);
    BOOST_CHECK_EQUAL(it[1], 30);
    BOOST_CHECK_EQUAL(it[3], 10);

    // compound assignment
    RIter moved(range_end);
    moved += 2;
    BOOST_CHECK_EQUAL(*moved, 20);
    auto &ref = (moved -= 1);
    BOOST_CHECK_EQUAL(*moved, 30);
    BOOST_CHECK_EQUAL(&ref, &moved); // returns *this
}

BOOST_AUTO_TEST_CASE(test_compare) {
    RIter first(range_end);   // 40, the reverse-begin
    RIter same(range_end);    // 40
    RIter middle = first + 2; // 20
    RIter last(range_begin);  // the reverse-end

    BOOST_CHECK(first == same);
    BOOST_CHECK(!(first != same));
    BOOST_CHECK(first != middle);

    // ordering follows the reverse traversal, not the underlying addresses
    BOOST_CHECK(first < middle);
    BOOST_CHECK(middle < last);
    BOOST_CHECK(first < last);
    BOOST_CHECK(middle > first);

    BOOST_CHECK(first <= same);
    BOOST_CHECK(first >= same);
    BOOST_CHECK(first <= middle);
    BOOST_CHECK(middle >= first);
}

BOOST_AUTO_TEST_CASE(test_conversion) {
    RIter it(range_end);

    // a mutable iterator converts to its const counterpart
    reverse_iterator<const int *> cit = it;
    BOOST_CHECK_EQUAL(*cit, 40);

    reverse_iterator<const int *> assigned;
    assigned = it;
    BOOST_CHECK_EQUAL(*assigned, 40);

    // writing through a mutable one is visible
    *it = 41;
    BOOST_CHECK_EQUAL(*cit, 41);
    *it = 40; // restore for the other cases
}

BOOST_AUTO_TEST_SUITE_END()

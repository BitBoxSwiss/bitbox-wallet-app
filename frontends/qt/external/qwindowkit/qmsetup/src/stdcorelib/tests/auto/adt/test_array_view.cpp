// SPDX-License-Identifier: MIT

#include <stdcorelib/adt/array_view.h>

#include <array>
#include <string>
#include <vector>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_array_view)

BOOST_AUTO_TEST_CASE(test_construct) {
    // default and nullopt: an empty view
    {
        array_view<int> v;
        BOOST_CHECK(v.empty());
        BOOST_CHECK_EQUAL(v.size(), 0u);
        BOOST_CHECK(v.data() == nullptr);

        array_view<int> v2{std::nullopt};
        BOOST_CHECK(v2.empty());
    }

    // single element
    {
        int item = 42;
        array_view<int> v(item);
        BOOST_CHECK_EQUAL(v.size(), 1u);
        BOOST_CHECK_EQUAL(v[0], 42);
        BOOST_CHECK_EQUAL(v.data(), &item);
    }

    // pointer and length
    {
        int arr[] = {1, 2, 3, 4};
        array_view<int> v(arr, 3);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v.back(), 3);
    }

    // begin and end pointers
    {
        int arr[] = {1, 2, 3, 4};
        array_view<int> v(arr + 1, arr + 4);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v.front(), 2);
    }

    // C array
    {
        int arr[] = {1, 2, 3};
        array_view<int> v(arr);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v.data(), arr);
    }

    // std::array
    {
        std::array<int, 3> arr = {1, 2, 3};
        array_view<int> v(arr);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v[2], 3);
    }

    // any container exposing data()/size()
    {
        std::vector<std::string> vec = {"a", "b"};
        array_view<std::string> v(vec);
        BOOST_CHECK_EQUAL(v.size(), 2u);
        BOOST_CHECK_EQUAL(v[1], "b");
        BOOST_CHECK_EQUAL(v.data(), vec.data()); // a view, not a copy
    }

    // initializer list (the view is only valid while the list lives)
    {
        std::initializer_list<int> init = {1, 2, 3};
        array_view<int> v(init);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v[1], 2);

        std::initializer_list<int> empty_init = {};
        array_view<int> ev(empty_init);
        BOOST_CHECK(ev.empty());
        BOOST_CHECK(ev.data() == nullptr);
    }
}

BOOST_AUTO_TEST_CASE(test_access_and_iterate) {
    std::vector<int> vec = {10, 20, 30, 40};
    array_view<int> v(vec);

    BOOST_CHECK_EQUAL(v.front(), 10);
    BOOST_CHECK_EQUAL(v.back(), 40);
    BOOST_CHECK_EQUAL(v[2], 30);

    // forward
    int sum = 0;
    for (int i : v) {
        sum += i;
    }
    BOOST_CHECK_EQUAL(sum, 100);
    BOOST_CHECK_EQUAL(std::distance(v.begin(), v.end()), 4);

    // reverse
    std::vector<int> reversed(v.rbegin(), v.rend());
    BOOST_CHECK_EQUAL(reversed.size(), 4u);
    BOOST_CHECK_EQUAL(reversed[0], 40);
    BOOST_CHECK_EQUAL(reversed[3], 10);

    // vec() copies out
    auto copy = v.vec();
    BOOST_CHECK(copy == vec);
    BOOST_CHECK(copy.data() != v.data());
}

BOOST_AUTO_TEST_CASE(test_slice) {
    std::vector<int> vec = {0, 1, 2, 3, 4};
    array_view<int> v(vec);

    // slice(offset, length)
    {
        auto s = v.slice(1, 3);
        BOOST_CHECK_EQUAL(s.size(), 3u);
        BOOST_CHECK_EQUAL(s.front(), 1);
        BOOST_CHECK_EQUAL(s.back(), 3);
    }

    // slice(offset) drops the front
    {
        auto s = v.slice(2);
        BOOST_CHECK_EQUAL(s.size(), 3u);
        BOOST_CHECK_EQUAL(s.front(), 2);
    }

    BOOST_CHECK_EQUAL(v.drop_front().size(), 4u);
    BOOST_CHECK_EQUAL(v.drop_front().front(), 1);
    BOOST_CHECK_EQUAL(v.drop_front(2).front(), 2);

    BOOST_CHECK_EQUAL(v.drop_back().size(), 4u);
    BOOST_CHECK_EQUAL(v.drop_back().back(), 3);
    BOOST_CHECK_EQUAL(v.drop_back(2).back(), 2);

    BOOST_CHECK_EQUAL(v.take_front(2).size(), 2u);
    BOOST_CHECK_EQUAL(v.take_front(2).back(), 1);

    BOOST_CHECK_EQUAL(v.take_back(2).size(), 2u);
    BOOST_CHECK_EQUAL(v.take_back(2).front(), 3);

    // taking more than there is clamps to the whole view
    BOOST_CHECK_EQUAL(v.take_front(100).size(), 5u);
    BOOST_CHECK_EQUAL(v.take_back(100).size(), 5u);

    // dropping everything is empty, not an error
    BOOST_CHECK(v.drop_front(5).empty());
    BOOST_CHECK(v.drop_back(5).empty());
}

BOOST_AUTO_TEST_CASE(test_compare) {
    std::vector<int> a = {1, 2, 3};
    std::vector<int> b = {1, 2, 3};
    std::vector<int> c = {1, 2, 4};
    std::vector<int> d = {1, 2};

    array_view<int> va(a);
    array_view<int> vb(b);
    array_view<int> vc(c);
    array_view<int> vd(d);

    BOOST_CHECK(va.equals(vb));
    BOOST_CHECK(va == vb);
    BOOST_CHECK(va != vc);
    BOOST_CHECK(va != vd); // different size
    BOOST_CHECK(!va.equals(vd));

    // container on the left compares against a view
    BOOST_CHECK(a == vb);
    BOOST_CHECK(c != vb);

    // and on the right, which had no overload at all until the ambiguity above was sorted out
    BOOST_CHECK(va == b);
    BOOST_CHECK(va != c);

    // two empty views are equal
    array_view<int> e1;
    array_view<int> e2;
    BOOST_CHECK(e1 == e2);
}

BOOST_AUTO_TEST_SUITE_END()

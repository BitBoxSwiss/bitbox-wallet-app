// SPDX-License-Identifier: MIT

#include <stdcorelib/vla.h>

#include <boost/test/unit_test.hpp>

BOOST_AUTO_TEST_SUITE(test_vla)

namespace {

    // Counts live instances so a missed construction or destruction shows up as a non-zero
    // g_count.
    class Counted {
    public:
        Counted() : i(0) {
            g_count++;
        }
        ~Counted() {
            g_count--;
        }

        int i;

        static inline int g_count = 0;
    };

}

BOOST_AUTO_TEST_CASE(test_vla_alloc) {
    STDC_VLA_ALLOC(int, buf, 8);
    for (int i = 0; i < 8; ++i) {
        buf[i] = i;
    }
    BOOST_CHECK_EQUAL(buf[0], 0);
    BOOST_CHECK_EQUAL(buf[7], 7);
}

BOOST_AUTO_TEST_CASE(test_vla_new) {
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
    {
        STDC_VLA_NEW(Counted, arr, 4);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
        BOOST_CHECK_EQUAL(arr[3].i, 0); // default constructed
        arr[3].i = 1;
        BOOST_CHECK_EQUAL(arr[3].i, 1);
    }
    // the guard destroyed every element on scope exit
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
}

BOOST_AUTO_TEST_SUITE_END()

// SPDX-License-Identifier: MIT

#include <stdcorelib/scope_guard.h>

#include <type_traits>
#include <utility>
#include <vector>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_scope_guard)

namespace {

    struct ThrowingCallable {
        ThrowingCallable() = default;
        ThrowingCallable(const ThrowingCallable &) noexcept(false) {
        }
        ThrowingCallable(ThrowingCallable &&) noexcept(false) {
        }
        void operator()() const noexcept {
        }
    };

    static_assert(
        !std::is_nothrow_constructible_v<scope_guard<ThrowingCallable>, ThrowingCallable &&>);
    static_assert(!std::is_nothrow_move_constructible_v<scope_guard<ThrowingCallable>>);

}

BOOST_AUTO_TEST_CASE(test_class_template_argument_deduction) {
    int calls = 0;
    {
        scope_guard guard([&] { ++calls; });
    }
    auto callable = [&] { ++calls; };
    {
        scope_guard guard(callable);
    }
    BOOST_CHECK_EQUAL(calls, 2);
}

BOOST_AUTO_TEST_CASE(test_runs_on_scope_exit) {
    int calls = 0;
    {
        auto guard = make_scope_guard([&] { calls++; });
        BOOST_CHECK_EQUAL(calls, 0); // not yet
    }
    BOOST_CHECK_EQUAL(calls, 1);
}

BOOST_AUTO_TEST_CASE(test_dismiss) {
    int calls = 0;
    {
        auto guard = make_scope_guard([&] { calls++; });
        guard.dismiss();
    }
    BOOST_CHECK_EQUAL(calls, 0);
}

// Moving transfers the responsibility: the callable must run exactly once.
BOOST_AUTO_TEST_CASE(test_move) {
    int calls = 0;
    {
        auto outer = make_scope_guard([&] { calls++; });
        {
            auto inner = std::move(outer);
            BOOST_CHECK_EQUAL(calls, 0);
        }
        // the moved-to guard fired, and the moved-from one is inactive
        BOOST_CHECK_EQUAL(calls, 1);
    }
    BOOST_CHECK_EQUAL(calls, 1);
}

// Guards unwind in reverse order of construction.
BOOST_AUTO_TEST_CASE(test_order) {
    std::vector<int> order;
    {
        auto g1 = make_scope_guard([&] { order.push_back(1); });
        auto g2 = make_scope_guard([&] { order.push_back(2); });
        auto g3 = make_scope_guard([&] { order.push_back(3); });
    }
    BOOST_REQUIRE_EQUAL(order.size(), 3u);
    BOOST_CHECK_EQUAL(order[0], 3);
    BOOST_CHECK_EQUAL(order[1], 2);
    BOOST_CHECK_EQUAL(order[2], 1);
}

// The typical use: undo work on an early return, dismiss it on success.
BOOST_AUTO_TEST_CASE(test_rollback_pattern) {
    const auto &transaction = [](bool fail, int &resource) {
        resource = 1;
        auto rollback = make_scope_guard([&] { resource = 0; });
        if (fail) {
            return false;
        }
        rollback.dismiss();
        return true;
    };

    int resource = -1;
    BOOST_CHECK(transaction(false, resource));
    BOOST_CHECK_EQUAL(resource, 1);

    BOOST_CHECK(!transaction(true, resource));
    BOOST_CHECK_EQUAL(resource, 0);
}

BOOST_AUTO_TEST_CASE(test_function_pointer) {
    static int calls = 0;
    calls = 0;
    {
        auto guard = make_scope_guard(+[] { calls++; });
    }
    BOOST_CHECK_EQUAL(calls, 1);
}

BOOST_AUTO_TEST_SUITE_END()

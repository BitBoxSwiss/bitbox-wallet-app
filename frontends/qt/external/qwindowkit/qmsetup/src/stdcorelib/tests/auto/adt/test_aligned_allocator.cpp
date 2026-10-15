// SPDX-License-Identifier: MIT

#include <cstddef>
#include <cstdint>
#include <memory>
#include <type_traits>
#include <vector>

#include <stdcorelib/adt/aligned_allocator.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

namespace {

    bool alignedTo(const void *pointer, std::size_t alignment) {
        return reinterpret_cast<std::uintptr_t>(pointer) % alignment == 0;
    }

}

BOOST_AUTO_TEST_SUITE(test_aligned_allocator)

BOOST_AUTO_TEST_CASE(test_requested_alignment) {
    aligned_allocator<float, 64> cacheLineAllocator;
    for (std::size_t count : {std::size_t(1), std::size_t(3), std::size_t(1000)}) {
        auto *pointer = cacheLineAllocator.allocate(count);
        BOOST_REQUIRE(alignedTo(pointer, 64));
        cacheLineAllocator.deallocate(pointer, count);
    }

    aligned_allocator<std::byte, 4096> pageAllocator;
    auto *pointer = pageAllocator.allocate(1);
    BOOST_REQUIRE(alignedTo(pointer, 4096));
    pageAllocator.deallocate(pointer, 1);
}

BOOST_AUTO_TEST_CASE(test_zero_size) {
    aligned_allocator<int, alignof(void *)> allocator;
    auto *pointer = allocator.allocate(0);
    allocator.deallocate(pointer, 0);
}

#ifdef STDC_HAS_EXCEPTIONS
BOOST_AUTO_TEST_CASE(test_size_overflow) {
    aligned_allocator<double, 32> allocator;
    BOOST_CHECK_THROW((void) allocator.allocate(allocator.max_size() + 1), std::bad_alloc);
}
#endif

BOOST_AUTO_TEST_CASE(test_rebind_and_equality) {
    using Allocator = aligned_allocator<float, 64>;
    using Rebound = std::allocator_traits<Allocator>::rebind_alloc<double>;

    static_assert(std::is_same_v<Rebound, aligned_allocator<double, 64>>);
    static_assert(Allocator::is_always_equal::value);

    BOOST_CHECK((Allocator{} == aligned_allocator<double, 64>{}));
    BOOST_CHECK((Allocator{} != aligned_allocator<float, 32>{}));

    Rebound rebound{Allocator{}};
    BOOST_CHECK((rebound == aligned_allocator<double, 64>{}));
}

BOOST_AUTO_TEST_CASE(test_vector_storage) {
    std::vector<float, aligned_allocator<float, 64>> values;
    for (int i = 0; i < 1000; ++i) {
        values.push_back(float(i));
        BOOST_REQUIRE(alignedTo(values.data(), 64));
    }

    auto copy = values;
    BOOST_CHECK(alignedTo(copy.data(), 64));
    BOOST_CHECK(copy == values);
}

BOOST_AUTO_TEST_SUITE_END()

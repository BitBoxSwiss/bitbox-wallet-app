// SPDX-License-Identifier: MIT

#include <stdcorelib/adt/vlarray.h>

#include <functional>
#include <new>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <vector>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_vlarray)

namespace {

    // Counts live instances so leaks and double-destructions show up as a non-zero g_count.
    class Counted {
    public:
        Counted(int i = 0) : i(i) {
            g_count++;
        }
        Counted(const Counted &other) : Counted(other.i) {
        }
        Counted(Counted &&other) noexcept : Counted(other.i) {
            other.i = -1;
        }
        Counted &operator=(const Counted &other) {
            i = other.i;
            return *this;
        }
        Counted &operator=(Counted &&other) noexcept {
            i = other.i;
            other.i = -1;
            return *this;
        }
        ~Counted() {
            g_count--;
        }

        bool operator==(const Counted &other) const {
            return i == other.i;
        }

        int i;

        static inline int g_count = 0;
    };

    struct ThrowingMove {
        ThrowingMove() = default;
        ThrowingMove(const ThrowingMove &) = default;
        ThrowingMove(ThrowingMove &&) noexcept(false) {
        }
        ThrowingMove &operator=(const ThrowingMove &) = default;
        ThrowingMove &operator=(ThrowingMove &&) noexcept(false) {
            return *this;
        }
    };

    // A throwing move and a working copy, which is the pair move_if_noexcept answers by copying,
    // so a reallocation copies these and the copy is where the throw is arranged.
    struct Fragile {
        static constexpr unsigned Alive = 0xA11FE;

        static inline int live = 0;
        static inline int copies = 0;
        static inline int throwAt = -1;
        static inline int doubleDestroys = 0;

        int v;
        unsigned magic = 0;

        explicit Fragile(int value = 0) : v(value), magic(Alive) {
            ++live;
        }
        Fragile(const Fragile &other) : v(other.v) {
            if (++copies == throwAt) {
                throw std::runtime_error("fragile");
            }
            magic = Alive;
            ++live;
        }
        Fragile(Fragile &&other) noexcept(false) : v(other.v), magic(Alive) {
            ++live;
        }
        ~Fragile() {
            if (magic != Alive) {
                ++doubleDestroys;
            }
            magic = 0;
            --live;
        }

        static void reset() {
            live = 0;
            copies = 0;
            throwAt = -1;
            doubleDestroys = 0;
        }
    };

    static_assert(std::is_nothrow_move_constructible_v<vlarray<Counted, 4>>);
    static_assert(std::is_nothrow_move_assignable_v<vlarray<Counted, 4>>);
    static_assert(!std::is_nothrow_move_constructible_v<vlarray<ThrowingMove, 4>>);
    static_assert(!std::is_nothrow_move_assignable_v<vlarray<ThrowingMove, 4>>);

    template <bool Propagate>
    struct AllocAudit {
        static inline std::unordered_map<void *, int> owners;
        static inline std::unordered_map<void *, int> objects;
        static inline bool wrongOwner = false;
    };

    template <class T, bool Propagate>
    class TrackingAllocator {
    public:
        using value_type = T;
        using propagate_on_container_move_assignment = std::bool_constant<Propagate>;
        using is_always_equal = std::false_type;

        template <class U>
        struct rebind {
            using other = TrackingAllocator<U, Propagate>;
        };

        explicit TrackingAllocator(int id = 0) : id(id) {
        }
        template <class U>
        TrackingAllocator(const TrackingAllocator<U, Propagate> &other) : id(other.id) {
        }

        T *allocate(std::size_t n) {
            T *p = std::allocator<T>{}.allocate(n);
            AllocAudit<Propagate>::owners[p] = id;
            return p;
        }
        void deallocate(T *p, std::size_t n) {
            auto it = AllocAudit<Propagate>::owners.find(p);
            if (it == AllocAudit<Propagate>::owners.end() || it->second != id) {
                AllocAudit<Propagate>::wrongOwner = true;
            } else {
                AllocAudit<Propagate>::owners.erase(it);
            }
            std::allocator<T>{}.deallocate(p, n);
        }
        template <class U, class... Args>
        void construct(U *p, Args &&...args) {
            ::new (static_cast<void *>(p)) U(std::forward<Args>(args)...);
            AllocAudit<Propagate>::objects[p] = id;
        }
        template <class U>
        void destroy(U *p) {
            auto it = AllocAudit<Propagate>::objects.find(p);
            if (it == AllocAudit<Propagate>::objects.end() || it->second != id) {
                AllocAudit<Propagate>::wrongOwner = true;
            } else {
                AllocAudit<Propagate>::objects.erase(it);
            }
            p->~U();
        }

        template <class U>
        bool operator==(const TrackingAllocator<U, Propagate> &other) const {
            return id == other.id;
        }
        template <class U>
        bool operator!=(const TrackingAllocator<U, Propagate> &other) const {
            return !(*this == other);
        }

        int id;
    };

}

BOOST_AUTO_TEST_CASE(test_construct) {
    // default
    {
        vlarray<Counted, 4> v;
        BOOST_CHECK(v.empty());
        BOOST_CHECK_EQUAL(v.size(), 0u);
        BOOST_CHECK_EQUAL(v.capacity(), 4u);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // size
    {
        vlarray<Counted, 4> v(3);
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v[2].i, 0);
        BOOST_CHECK_EQUAL(Counted::g_count, 3);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // size and value
    {
        vlarray<Counted, 2> v(5, Counted(7));
        BOOST_CHECK_EQUAL(v.size(), 5u);
        BOOST_CHECK_EQUAL(v[4].i, 7);
        BOOST_CHECK_EQUAL(Counted::g_count, 5);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // initializer list
    {
        vlarray<Counted, 4> v = {0, 1, 2, 3};
        BOOST_CHECK_EQUAL(v.size(), 4u);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // iterator range
    {
        std::vector<int> src = {1, 2, 3};
        vlarray<int, 2> v(src.begin(), src.end());
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v[1], 2);
    }
}

BOOST_AUTO_TEST_CASE(test_copy_move) {
    // copy construct
    {
        vlarray<Counted, 4> v0 = {0, 1, 2, 3};
        vlarray<Counted, 4> v(v0);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(v0[2].i, 2); // source untouched
        BOOST_CHECK_EQUAL(Counted::g_count, 8);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // move construct, inline (elements are moved one by one)
    {
        vlarray<Counted, 4> v0 = {0, 1, 2, 3};
        vlarray<Counted, 4> v(std::move(v0));
        BOOST_CHECK_EQUAL(v.size(), 4u);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(v0.size(), 0u);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // move construct, heap (the buffer is stolen outright)
    {
        vlarray<Counted, 2> v0 = {0, 1, 2, 3};
        auto *data = v0.data();
        vlarray<Counted, 2> v(std::move(v0));
        BOOST_CHECK_EQUAL(v.data(), data);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(v0.size(), 0u);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // copy assign
    {
        vlarray<Counted, 4> v0 = {0, 1, 2, 3};
        vlarray<Counted, 4> v = {9};
        v = v0;
        BOOST_CHECK_EQUAL(v.size(), 4u);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(Counted::g_count, 8);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // move assign
    {
        vlarray<Counted, 4> v0 = {0, 1, 2, 3};
        vlarray<Counted, 4> v = {9};
        v = std::move(v0);
        BOOST_CHECK_EQUAL(v.size(), 4u);
        BOOST_CHECK_EQUAL(v[2].i, 2);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // self assign
    {
        vlarray<Counted, 4> v = {0, 1, 2};
        v = v;
        BOOST_CHECK_EQUAL(v.size(), 3u);
        BOOST_CHECK_EQUAL(v[1].i, 1);
        BOOST_CHECK_EQUAL(Counted::g_count, 3);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
}

// A vlarray of any inline size binds to the same base reference.
BOOST_AUTO_TEST_CASE(test_cross_size) {
    const auto &sum = [](const vlarray_base<int> &v) {
        int n = 0;
        for (int i : v) {
            n += i;
        }
        return n;
    };

    vlarray<int, 2> v2 = {1, 2, 3, 4};
    vlarray<int, 64> v64 = {1, 2, 3, 4};
    BOOST_CHECK_EQUAL(sum(v2), 10);
    BOOST_CHECK_EQUAL(sum(v64), 10);

    // construct and assign across inline sizes
    vlarray<int, 8> v8(v2);
    BOOST_CHECK(v8 == v64);

    v8 = v64;
    BOOST_CHECK_EQUAL(sum(v8), 10);

    vlarray<int, 1> v1 = {5};
    BOOST_CHECK(v1 != v8);
}

BOOST_AUTO_TEST_CASE(test_grow) {
    vlarray<Counted, 4> v;
    const auto *inline_data = v.data();

    // stays inline up to N
    for (int i = 0; i < 4; ++i) {
        v.push_back(i);
    }
    BOOST_CHECK_EQUAL(v.data(), inline_data);
    BOOST_CHECK_EQUAL(v.capacity(), 4u);

    // the next push moves to the heap
    v.push_back(4);
    BOOST_CHECK(v.data() != inline_data);
    BOOST_CHECK(v.capacity() >= 5u);
    BOOST_CHECK_EQUAL(Counted::g_count, 5);
    for (int i = 0; i < 5; ++i) {
        BOOST_CHECK_EQUAL(v[i].i, i);
    }

    // emplace_back with an argument that aliases an existing element
    v.reserve(v.size());
    v.emplace_back(v[0]);
    BOOST_CHECK_EQUAL(v.back().i, 0);

    v.clear();
    BOOST_CHECK(v.empty());
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
}

BOOST_AUTO_TEST_CASE(test_resize) {
    vlarray<Counted, 4> v = {0, 1, 2, 3};
    BOOST_CHECK_EQUAL(Counted::g_count, 4);

    // inline shrink
    v.resize(2);
    BOOST_CHECK_EQUAL(v.size(), 2u);
    BOOST_CHECK_EQUAL(Counted::g_count, 2);

    // inline expand
    v.resize(4);
    BOOST_CHECK_EQUAL(v[3].i, 0);
    BOOST_CHECK_EQUAL(Counted::g_count, 4);

    // expand onto the heap
    v.resize(20);
    BOOST_CHECK_EQUAL(v[1].i, 1); // original elements survive the relocation
    BOOST_CHECK_EQUAL(v[15].i, 0);
    BOOST_CHECK_EQUAL(Counted::g_count, 20);

    // expand with a value
    v.resize(25, Counted(8));
    BOOST_CHECK_EQUAL(v[24].i, 8);
    BOOST_CHECK_EQUAL(Counted::g_count, 25);

    // shrink back below N: the capacity stays, the elements are destroyed
    v.resize(2);
    BOOST_CHECK_EQUAL(v.size(), 2u);
    BOOST_CHECK_EQUAL(Counted::g_count, 2);
}

BOOST_AUTO_TEST_CASE(test_insert_erase) {
    vlarray<int, 4> v = {0, 1, 2, 3};

    // single value
    v.insert(v.begin(), -1);
    BOOST_CHECK_EQUAL(v[0], -1);
    BOOST_CHECK_EQUAL(v[1], 0);
    BOOST_CHECK_EQUAL(v.size(), 5u);

    // a value that lives inside the array
    v.insert(v.begin(), v[4]);
    BOOST_CHECK_EQUAL(v[0], 3);
    BOOST_CHECK_EQUAL(v.size(), 6u);

    // count and value
    v.insert(v.end(), 3, 7);
    BOOST_CHECK_EQUAL(v.size(), 9u);
    BOOST_CHECK_EQUAL(v.back(), 7);

    // range
    std::vector<int> src = {8, 9};
    v.insert(v.begin(), src.begin(), src.end());
    BOOST_CHECK_EQUAL(v[0], 8);
    BOOST_CHECK_EQUAL(v[1], 9);
    BOOST_CHECK_EQUAL(v.size(), 11u);

    // erase one
    v.erase(v.begin());
    BOOST_CHECK_EQUAL(v[0], 9);
    BOOST_CHECK_EQUAL(v.size(), 10u);

    // erase a range
    v.erase(v.begin(), v.begin() + 3);
    BOOST_CHECK_EQUAL(v.size(), 7u);

    v.pop_back();
    BOOST_CHECK_EQUAL(v.size(), 6u);

    // element lifetime through insert/erase
    {
        vlarray<Counted, 2> c = {0, 1};
        c.insert(c.begin() + 1, 5);
        BOOST_CHECK_EQUAL(c[1].i, 5);
        BOOST_CHECK_EQUAL(Counted::g_count, 3);
        c.erase(c.begin());
        BOOST_CHECK_EQUAL(Counted::g_count, 2);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
}

BOOST_AUTO_TEST_CASE(test_swap) {
    // both inline
    {
        vlarray<Counted, 8> a = {0, 1, 2};
        vlarray<Counted, 8> b = {9};
        a.swap(b);
        BOOST_CHECK_EQUAL(a.size(), 1u);
        BOOST_CHECK_EQUAL(a[0].i, 9);
        BOOST_CHECK_EQUAL(b.size(), 3u);
        BOOST_CHECK_EQUAL(b[2].i, 2);
        BOOST_CHECK_EQUAL(Counted::g_count, 4);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // both on the heap: the buffers are traded
    {
        vlarray<Counted, 1> a = {0, 1, 2};
        vlarray<Counted, 1> b = {7, 8};
        auto *adata = a.data();
        auto *bdata = b.data();
        swap(a, b);
        BOOST_CHECK_EQUAL(a.data(), bdata);
        BOOST_CHECK_EQUAL(b.data(), adata);
        BOOST_CHECK_EQUAL(a.size(), 2u);
        BOOST_CHECK_EQUAL(b.size(), 3u);
        BOOST_CHECK_EQUAL(Counted::g_count, 5);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);

    // one inline, one on the heap
    {
        vlarray<Counted, 8> a = {0, 1, 2};
        vlarray<Counted, 1> b = {7, 8};
        a.swap(b);
        BOOST_CHECK_EQUAL(a.size(), 2u);
        BOOST_CHECK_EQUAL(a[1].i, 8);
        BOOST_CHECK_EQUAL(b.size(), 3u);
        BOOST_CHECK_EQUAL(b[2].i, 2);
        BOOST_CHECK_EQUAL(Counted::g_count, 5);
    }
    BOOST_CHECK_EQUAL(Counted::g_count, 0);
}

BOOST_AUTO_TEST_CASE(test_nontrivial_element) {
    vlarray<std::string, 2> v;
    v.push_back("hello");
    v.emplace_back("world");
    v.push_back("!"); // grows onto the heap
    BOOST_CHECK_EQUAL(v.size(), 3u);
    BOOST_CHECK_EQUAL(v[0], "hello");
    BOOST_CHECK_EQUAL(v[1], "world");
    BOOST_CHECK_EQUAL(v.back(), "!");

    vlarray<std::string, 2> v2 = std::move(v);
    BOOST_CHECK_EQUAL(v2[0], "hello");
}

// The copy and move constructors build the new array from other.get_allocator(), so this had
// been running the whole time with nothing asserting what it hands back.
BOOST_AUTO_TEST_CASE(test_the_allocator_can_be_read_back) {
    vlarray<int, 4> array;
    array.push_back(1);
    array.push_back(2);

    // The reference is to the array's own allocator rather than a copy, so it stays the same one
    // across a call that grows past the inline buffer.
    const auto *before = &array.get_allocator();
    for (int i = 0; i < 32; ++i) {
        array.push_back(i);
    }
    BOOST_CHECK_EQUAL(before, &array.get_allocator());

    // A copy is built through it and answers with one of its own.
    vlarray<int, 4> copy = array;
    BOOST_CHECK(&copy.get_allocator() != &array.get_allocator());
    BOOST_CHECK_EQUAL(copy.size(), array.size());
}

BOOST_AUTO_TEST_CASE(test_move_assignment_respects_the_allocator) {
    using FixedAlloc = TrackingAllocator<int, false>;
    using MovingAlloc = TrackingAllocator<int, true>;

    AllocAudit<false>::owners.clear();
    AllocAudit<false>::objects.clear();
    AllocAudit<false>::wrongOwner = false;
    {
        vlarray<int, 1, FixedAlloc> source({0, 1, 2}, FixedAlloc(1));
        vlarray<int, 1, FixedAlloc> target({9, 8}, FixedAlloc(2));
        int *sourceData = source.data();
        target = std::move(source);

        BOOST_CHECK(target.data() != sourceData);
        BOOST_CHECK_EQUAL(target.get_allocator().id, 2);
        BOOST_CHECK_EQUAL(target.size(), 3u);
        BOOST_CHECK_EQUAL(target[2], 2);
        BOOST_CHECK(source.empty());
    }
    BOOST_CHECK(!AllocAudit<false>::wrongOwner);
    BOOST_CHECK(AllocAudit<false>::owners.empty());
    BOOST_CHECK(AllocAudit<false>::objects.empty());

    AllocAudit<true>::owners.clear();
    AllocAudit<true>::objects.clear();
    AllocAudit<true>::wrongOwner = false;
    {
        vlarray<int, 1, MovingAlloc> source({0, 1, 2}, MovingAlloc(1));
        vlarray<int, 1, MovingAlloc> target({9, 8}, MovingAlloc(2));
        int *sourceData = source.data();
        target = std::move(source);

        BOOST_CHECK_EQUAL(target.data(), sourceData);
        BOOST_CHECK_EQUAL(target.get_allocator().id, 1);
        BOOST_CHECK_EQUAL(target[2], 2);
        BOOST_CHECK(source.empty());
    }
    BOOST_CHECK(!AllocAudit<true>::wrongOwner);
    BOOST_CHECK(AllocAudit<true>::owners.empty());
    BOOST_CHECK(AllocAudit<true>::objects.empty());

    AllocAudit<true>::wrongOwner = false;
    {
        vlarray<int, 4, MovingAlloc> source({0, 1, 2}, MovingAlloc(1));
        vlarray<int, 4, MovingAlloc> target({9}, MovingAlloc(2));
        target = std::move(source);
        BOOST_CHECK_EQUAL(target.get_allocator().id, 1);
        BOOST_CHECK_EQUAL(target[2], 2);
        BOOST_CHECK(source.empty());
    }
    BOOST_CHECK(!AllocAudit<true>::wrongOwner);
    BOOST_CHECK(AllocAudit<true>::objects.empty());
}

BOOST_AUTO_TEST_CASE(test_swap_does_not_trade_buffers_between_unequal_allocators) {
    using Alloc = TrackingAllocator<int, false>;
    AllocAudit<false>::owners.clear();
    AllocAudit<false>::objects.clear();
    AllocAudit<false>::wrongOwner = false;
    {
        vlarray<int, 1, Alloc> a({0, 1, 2}, Alloc(1));
        vlarray<int, 1, Alloc> b({7, 8}, Alloc(2));
        int *aData = a.data();
        int *bData = b.data();
        a.swap(b);

        BOOST_CHECK_EQUAL(a.data(), aData);
        BOOST_CHECK_EQUAL(b.data(), bData);
        BOOST_CHECK_EQUAL(a.size(), 2u);
        BOOST_CHECK_EQUAL(a[1], 8);
        BOOST_CHECK_EQUAL(b.size(), 3u);
        BOOST_CHECK_EQUAL(b[2], 2);
    }
    BOOST_CHECK(!AllocAudit<false>::wrongOwner);
    BOOST_CHECK(AllocAudit<false>::owners.empty());
    BOOST_CHECK(AllocAudit<false>::objects.empty());
}

#ifdef STDC_HAS_EXCEPTIONS

BOOST_AUTO_TEST_CASE(test_a_throw_while_growing_leaves_the_array_as_it_was) {
    using FragileAlloc = TrackingAllocator<Fragile, false>;
    using FragileArray = vlarray<Fragile, 2, FragileAlloc>;

    const auto &grownBy = [](const char *what, const std::function<void(FragileArray &)> &grow) {
        AllocAudit<false>::owners.clear();
        AllocAudit<false>::objects.clear();
        AllocAudit<false>::wrongOwner = false;
        Fragile::reset();

        {
            FragileArray a{FragileAlloc(1)};
            a.emplace_back(10);
            a.emplace_back(20);
            a.reserve(4); // onto the heap, so what leaks below would be a heap block
            while (a.size() < a.capacity()) {
                a.emplace_back(int(a.size()) * 10 + 10); // and full, so push_back has to grow
            }

            const size_t blocks = AllocAudit<false>::owners.size();
            const size_t capacity = a.capacity();
            const size_t size = a.size();
            Fragile::copies = 0;
            Fragile::throwAt = 2; // partway through, with one already built in the new buffer

            bool threw = false;
            try {
                grow(a);
            } catch (const std::runtime_error &) {
                threw = true;
            }
            Fragile::throwAt = -1;

            BOOST_CHECK_MESSAGE(threw, std::string(what) + " did not throw");
            BOOST_CHECK_MESSAGE(AllocAudit<false>::owners.size() == blocks,
                                std::string(what) + " leaked a buffer");
            BOOST_CHECK_EQUAL(a.size(), size);
            BOOST_CHECK_EQUAL(a.capacity(), capacity);
            BOOST_CHECK_EQUAL(a[0].v, 10);
            BOOST_CHECK_EQUAL(a[1].v, 20);
        }

        BOOST_CHECK_MESSAGE(Fragile::doubleDestroys == 0,
                            std::string(what) + " destroyed an object twice");
        BOOST_CHECK(!AllocAudit<false>::wrongOwner);
        BOOST_CHECK_EQUAL(Fragile::live, 0);
        BOOST_CHECK(AllocAudit<false>::owners.empty());
        BOOST_CHECK(AllocAudit<false>::objects.empty());
    };

    grownBy("reserve", [](FragileArray &a) { a.reserve(64); });
    grownBy("push_back", [](FragileArray &a) { a.emplace_back(30); });
}

#endif

BOOST_AUTO_TEST_SUITE_END()

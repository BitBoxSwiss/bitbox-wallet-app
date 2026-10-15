// SPDX-License-Identifier: MIT

#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

#include <stdcorelib/adt/linked_map.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_linked_map)

namespace {

    using Map = linked_map<std::string, int>;
    using OrderedMap = linked_map<std::string, int, linked_map_ordered_traits<>>;
    using StringViewKey = linked_map_view_traits<std::string>;
    using StringViewMap =
        linked_map<std::string, int, linked_map_unordered_traits<>, StringViewKey>;

    static_assert(std::is_same_v<Map::map_type::key_type, std::string_view>);
    static_assert(std::is_same_v<OrderedMap::map_type::key_type, std::string_view>);
    static_assert(
        std::is_same_v<linked_map<std::wstring, int>::map_type::key_type, std::wstring_view>);
    static_assert(detail::has_reserve<Map::map_type>::value);
    static_assert(!detail::has_capacity<Map::map_type>::value);
    static_assert(!detail::has_reserve<OrderedMap::map_type>::value);
    static_assert(!detail::has_capacity<OrderedMap::map_type>::value);

    // Reads the map front to back, which is the insertion order it is supposed to preserve.
    std::vector<std::pair<std::string, int>> to_vector(const Map &map) {
        std::vector<std::pair<std::string, int>> res;
        for (const auto &item : map) {
            res.emplace_back(item.first, item.second);
        }
        return res;
    }

    // ...and back to front, which must be the exact mirror.
    std::vector<std::pair<std::string, int>> to_vector_reversed(const Map &map) {
        std::vector<std::pair<std::string, int>> res;
        for (auto it = map.rbegin(); it != map.rend(); ++it) {
            res.emplace_back(it->first, it->second);
        }
        return res;
    }

    Map make_map() {
        Map map;
        map.append("1", 1);
        map.append("2", 2);
        map.append("3", 3);
        return map;
    }

    void check_order(const Map &map, const std::vector<std::pair<std::string, int>> &expect) {
        BOOST_CHECK_EQUAL(map.size(), expect.size());
        BOOST_CHECK(to_vector(map) == expect);

        auto reversed = expect;
        std::reverse(reversed.begin(), reversed.end());
        BOOST_CHECK(to_vector_reversed(map) == reversed);
    }

    struct CountedValue {
        static int defaultConstructions;

        CountedValue() {
            ++defaultConstructions;
        }

        explicit CountedValue(int value) : value(value) {
        }

        int value = 0;
    };

    int CountedValue::defaultConstructions = 0;

    struct AllocatorState {
        size_t allocations = 0;
    };

    template <class T>
    class TrackingAllocator {
    public:
        using value_type = T;

        TrackingAllocator() : state(std::make_shared<AllocatorState>()) {
        }

        explicit TrackingAllocator(std::shared_ptr<AllocatorState> state)
            : state(std::move(state)) {
        }

        template <class U>
        TrackingAllocator(const TrackingAllocator<U> &other) noexcept : state(other.state) {
        }

        T *allocate(size_t count) {
            state->allocations += count;
            return std::allocator<T>().allocate(count);
        }

        void deallocate(T *data, size_t count) noexcept {
            std::allocator<T>().deallocate(data, count);
        }

        template <class U>
        bool operator==(const TrackingAllocator<U> &other) const noexcept {
            return state == other.state;
        }

        template <class U>
        bool operator!=(const TrackingAllocator<U> &other) const noexcept {
            return !(*this == other);
        }

        std::shared_ptr<AllocatorState> state;

        template <class>
        friend class TrackingAllocator;
    };

#ifdef STDC_HAS_EXCEPTIONS
    struct ThrowingValue {
        ThrowingValue() = default;
        ThrowingValue(const ThrowingValue &) {
            throw std::runtime_error("copy failed");
        }
        ThrowingValue(ThrowingValue &&) noexcept = default;
    };
#endif

}

BOOST_AUTO_TEST_CASE(test_insert_erase) {
    std::vector<std::pair<std::string, int>> kvs{
        {"1", 1},
        {"2", 2},
        {"3", 3},
    };

    Map map;
    for (const auto &item : std::as_const(kvs)) {
        map[item.first] = item.second;
    }

    check_order(map, kvs);

    // Erase
    {
        map.erase("2");
        BOOST_CHECK(map.size() == 2);
        BOOST_CHECK(map.find("2") == map.end());

        kvs.erase(kvs.begin() + 1);
    }

    check_order(map, kvs);

    // Duplicated insert (should fail)
    {
        auto it = map.append("1", 3);
        BOOST_CHECK(it.second == false);
        BOOST_CHECK(it.first == map.find("1"));
        BOOST_CHECK(map.size() == 2);
        BOOST_CHECK(map.find("1")->second == 1);
    }

    check_order(map, kvs);

    // Operator[]
    {
        map["1"] = 3;
        BOOST_CHECK(map.size() == 2);
        BOOST_CHECK(map.find("1")->second == 3);
    }
}

BOOST_AUTO_TEST_CASE(test_empty) {
    Map map;
    BOOST_CHECK(map.empty());
    BOOST_CHECK_EQUAL(map.size(), 0u);
    BOOST_CHECK(map.begin() == map.end());
    BOOST_CHECK(map.find("nope") == map.end());
    BOOST_CHECK(!map.contains("nope"));
    BOOST_CHECK(map.keys().empty());
    BOOST_CHECK(map.values().empty());

    map.append("a", 1);
    BOOST_CHECK(!map.empty());

    map.clear();
    BOOST_CHECK(map.empty());
    BOOST_CHECK_EQUAL(map.size(), 0u);
    BOOST_CHECK(map.begin() == map.end());
    BOOST_CHECK(!map.contains("a"));

    // usable again after clear()
    map.append("b", 2);
    BOOST_CHECK_EQUAL(map.size(), 1u);
    BOOST_CHECK(map.contains("b"));
}

// append/prepend/insert differ only in where the new entry lands.
BOOST_AUTO_TEST_CASE(test_ordering) {
    Map map;

    BOOST_CHECK(map.append("b", 2).second);
    BOOST_CHECK(map.append("c", 3).second);
    BOOST_CHECK(map.prepend("a", 1).second);
    check_order(map, {
                         {"a", 1},
                         {"b", 2},
                         {"c", 3},
    });

    // insert lands the entry before the given position
    BOOST_CHECK(map.insert(map.find("c"), "b2", 22).second);
    check_order(map, {
                         {"a",  1 },
                         {"b",  2 },
                         {"b2", 22},
                         {"c",  3 },
    });

    // inserting at begin() is a prepend, at end() an append
    BOOST_CHECK(map.insert(map.begin(), "start", 0).second);
    BOOST_CHECK(map.insert(map.end(), "stop", 9).second);
    BOOST_CHECK_EQUAL(to_vector(map).front().first, "start");
    BOOST_CHECK_EQUAL(to_vector(map).back().first, "stop");

    // a duplicate key is rejected wherever it is offered, and does not move or update the
    // existing entry
    BOOST_CHECK(!map.prepend("c", 99).second);
    BOOST_CHECK(!map.append("a", 99).second);
    BOOST_CHECK(!map.insert(map.begin(), "a", 99).second);
    check_order(map, {
                         {"start", 0 },
                         {"a",     1 },
                         {"b",     2 },
                         {"b2",    22},
                         {"c",     3 },
                         {"stop",  9 },
    });

    // operator[] appends when the key is new, and updates in place when it is not
    map["z"] = 26;
    BOOST_CHECK_EQUAL(map.size(), 7u);
    BOOST_CHECK(to_vector(map).back().first == "z");

    map["a"] = 100;
    BOOST_CHECK_EQUAL(map.size(), 7u);
    BOOST_CHECK(to_vector(map)[1] == std::make_pair(std::string("a"), 100));
}

BOOST_AUTO_TEST_CASE(test_construct) {
    const auto expect = std::vector<std::pair<std::string, int>>{
        {"1", 1},
        {"2", 2},
        {"3", 3},
    };

    // initializer list, in order
    {
        Map map = {
            {"1", 1},
            {"2", 2},
            {"3", 3},
        };
        check_order(map, expect);
    }

    // a duplicate key in the list keeps the first occurrence
    {
        Map map = {
            {"a", 1},
            {"a", 2},
            {"b", 3},
        };
        BOOST_CHECK_EQUAL(map.size(), 2u);
        BOOST_CHECK_EQUAL(map.value("a"), 1);
    }

    // an empty list
    {
        Map map = {};
        BOOST_CHECK(map.empty());
    }

    // from any iterator range over pairs, not just this map's own iterators
    {
        std::vector<std::pair<std::string, int>> src = expect;
        Map map(src.begin(), src.end());
        check_order(map, expect);
    }
    {
        auto source = make_map();
        Map map(source.begin(), source.end());
        check_order(map, expect);
    }
}

BOOST_AUTO_TEST_CASE(test_swap) {
    auto a = make_map();
    Map b;
    b.append("x", 24);

    a.swap(b);

    BOOST_CHECK_EQUAL(a.size(), 1u);
    BOOST_CHECK_EQUAL(a.value("x"), 24);
    BOOST_CHECK(!a.contains("1"));

    check_order(b, {
                       {"1", 1},
                       {"2", 2},
                       {"3", 3},
    });

    // the lookup index followed the list across, so both halves still work
    BOOST_CHECK(b.find("2") != b.end());
    BOOST_CHECK_EQUAL(b.find("2")->second, 2);
    b.append("4", 4);
    BOOST_CHECK_EQUAL(b.size(), 4u);
    a.append("y", 25);
    BOOST_CHECK_EQUAL(a.size(), 2u);

    // swapping back restores both
    a.swap(b);
    BOOST_CHECK_EQUAL(a.size(), 4u);
    BOOST_CHECK_EQUAL(b.size(), 2u);

    // swapping with an empty map, and with itself
    Map empty;
    a.swap(empty);
    BOOST_CHECK(a.empty());
    BOOST_CHECK_EQUAL(empty.size(), 4u);

    empty.swap(empty);
    BOOST_CHECK_EQUAL(empty.size(), 4u);
    BOOST_CHECK_EQUAL(empty.value("1"), 1);
}

BOOST_AUTO_TEST_CASE(test_lookup) {
    auto map = make_map();

    BOOST_CHECK(map.contains("2"));
    BOOST_CHECK(!map.contains("9"));

    auto it = map.find("2");
    BOOST_REQUIRE(it != map.end());
    BOOST_CHECK_EQUAL(it->first, "2");
    BOOST_CHECK_EQUAL(it->second, 2);
    BOOST_CHECK_EQUAL(it->second, 2);
    BOOST_CHECK(map.find("9") == map.end());

    // value() falls back when the key is missing
    BOOST_CHECK_EQUAL(map.value("2"), 2);
    BOOST_CHECK_EQUAL(map.value("9"), 0);      // default-constructed V
    BOOST_CHECK_EQUAL(map.value("9", -1), -1); // explicit fallback

    // const lookup goes through the const_iterator overload
    const auto &cmap = map;
    auto cit = cmap.find("3");
    BOOST_REQUIRE(cit != cmap.end());
    BOOST_CHECK_EQUAL(cit->first, "3");
    BOOST_CHECK_EQUAL(cit->second, 3);
    BOOST_CHECK(cmap.find("9") == cmap.cend());

    // writing through a non-const iterator is visible in the map
    map.find("1")->second = 11;
    BOOST_CHECK_EQUAL(map.value("1"), 11);
}

BOOST_AUTO_TEST_CASE(test_erase) {
    // erase by key returns how many entries went away
    {
        auto map = make_map();
        BOOST_CHECK_EQUAL(map.erase("2"), 1u);
        BOOST_CHECK_EQUAL(map.erase("2"), 0u); // already gone
        BOOST_CHECK_EQUAL(map.erase("9"), 0u); // never there
        check_order(map, {
                             {"1", 1},
                             {"3", 3},
        });
    }

    // remove() is the bool-returning spelling of the same thing
    {
        auto map = make_map();
        BOOST_CHECK(map.remove("1"));
        BOOST_CHECK(!map.remove("1"));
        check_order(map, {
                             {"2", 2},
                             {"3", 3},
        });
    }

    // erase by iterator returns the following entry
    {
        auto map = make_map();
        auto next = map.erase(map.find("2"));
        BOOST_REQUIRE(next != map.end());
        BOOST_CHECK_EQUAL(next->first, "3");
        check_order(map, {
                             {"1", 1},
                             {"3", 3},
        });

        // erasing the last entry lands on end()
        BOOST_CHECK(map.erase(map.find("3")) == map.end());
        check_order(map, {
                             {"1", 1},
        });
    }

    // erasing everything one at a time
    {
        auto map = make_map();
        while (!map.empty()) {
            map.erase(map.begin());
        }
        BOOST_CHECK(map.empty());
        BOOST_CHECK(map.begin() == map.end());
        BOOST_CHECK(!map.contains("1"));
    }

    // a key removed and re-added goes to the back, not to its old spot
    {
        auto map = make_map();
        map.erase("1");
        map.append("1", 1);
        check_order(map, {
                             {"2", 2},
                             {"3", 3},
                             {"1", 1},
        });
    }
}

BOOST_AUTO_TEST_CASE(test_keys_values) {
    auto map = make_map();

    std::vector<std::string> expect_keys = {"1", "2", "3"};
    std::vector<int> expect_values = {1, 2, 3};
    BOOST_CHECK(map.keys() == expect_keys);
    BOOST_CHECK(map.values() == expect_values);

    // both follow insertion order, including after a prepend
    map.prepend("0", 0);
    expect_keys.insert(expect_keys.begin(), "0");
    expect_values.insert(expect_values.begin(), 0);
    BOOST_CHECK(map.keys() == expect_keys);
    BOOST_CHECK(map.values() == expect_values);
}

BOOST_AUTO_TEST_CASE(test_copy_move) {
    auto original = make_map();

    // copy construct: an independent map with the same order
    {
        Map copy(original);
        check_order(copy, to_vector(original));
        BOOST_CHECK(copy == original);

        copy["1"] = 99;
        BOOST_CHECK_EQUAL(original.value("1"), 1); // the source is untouched
        BOOST_CHECK(copy != original);
    }

    // copy assign, over a non-empty target
    {
        Map copy;
        copy.append("junk", -1);
        copy = original;
        check_order(copy, to_vector(original));
        BOOST_CHECK(!copy.contains("junk"));
    }

    // move construct
    {
        Map source = make_map();
        Map moved(std::move(source));
        check_order(moved, to_vector(original));
        BOOST_CHECK(moved == original);
    }

    // move assign
    {
        Map source = make_map();
        Map target;
        target.append("junk", -1);
        target = std::move(source);
        check_order(target, to_vector(original));
    }

    // self assignment leaves the map alone
    {
        Map map = make_map();
        auto &alias = map;
        map = alias;
        check_order(map, to_vector(original));
    }
}

BOOST_AUTO_TEST_CASE(test_compare) {
    auto a = make_map();
    auto b = make_map();
    BOOST_CHECK(a == b);
    BOOST_CHECK(!(a != b));

    // a different value
    b["2"] = 22;
    BOOST_CHECK(a != b);

    // a different size
    Map c = make_map();
    c.append("4", 4);
    BOOST_CHECK(a != c);

    // same entries, different order: linked_map compares the sequence, so these differ
    Map d;
    d.append("3", 3);
    d.append("2", 2);
    d.append("1", 1);
    BOOST_CHECK(a != d);

    Map e1, e2;
    BOOST_CHECK(e1 == e2);
}

BOOST_AUTO_TEST_CASE(test_iterators) {
    auto map = make_map();

    // forward, with the key()/value() accessors
    {
        std::vector<std::string> keys;
        for (auto it = map.begin(); it != map.end(); ++it) {
            keys.push_back(it->first);
        }
        std::vector<std::string> expect = {"1", "2", "3"};
        BOOST_CHECK(keys == expect);
    }

    // post-increment returns the old position
    {
        auto it = map.begin();
        auto old = it++;
        BOOST_CHECK_EQUAL(old->first, "1");
        BOOST_CHECK_EQUAL(it->first, "2");
    }

    // bidirectional
    {
        auto it = map.begin();
        ++it;
        ++it;
        BOOST_CHECK_EQUAL(it->first, "3");
        --it;
        BOOST_CHECK_EQUAL(it->first, "2");
        auto old = it--;
        BOOST_CHECK_EQUAL(old->first, "2");
        BOOST_CHECK_EQUAL(it->first, "1");
    }

    // an iterator converts to a const_iterator
    {
        Map::const_iterator cit = map.begin();
        BOOST_CHECK_EQUAL(cit->first, "1");
        BOOST_CHECK(cit == map.cbegin());
    }

    // a const_iterator walks both ways, prefix and postfix
    {
        auto cit = map.cbegin();
        BOOST_CHECK_EQUAL((++cit)->first, "2");
        auto old = cit++;
        BOOST_CHECK_EQUAL(old->first, "2");
        BOOST_CHECK_EQUAL(cit->first, "3");
        BOOST_CHECK_EQUAL((--cit)->first, "2");
        auto old2 = cit--;
        BOOST_CHECK_EQUAL(old2->first, "2");
        BOOST_CHECK_EQUAL(cit->first, "1");
        BOOST_CHECK(cit == map.cbegin());
    }

    // cbegin/cend and the const overloads of begin/end agree
    {
        const auto &cmap = map;
        BOOST_CHECK(cmap.begin() == map.cbegin());
        BOOST_CHECK(cmap.end() == map.cend());
        BOOST_CHECK_EQUAL(std::distance(map.cbegin(), map.cend()), 3);
    }

    // mutating through an iterator
    {
        for (auto &item : map) {
            item.second *= 10;
        }
        std::vector<int> expect = {10, 20, 30};
        BOOST_CHECK(map.values() == expect);
    }

    // A default constructed one refers to nothing and is assigned over later, which is what a
    // caller declaring an iterator before the loop that finds it writes. Required of every
    // forward iterator, and reached by nothing here until now.
    {
        static_assert(std::is_default_constructible_v<Map::iterator>,
                      "a forward iterator has to be default constructible");
        Map::iterator it;
        Map::const_iterator cit;
        it = map.find("2");
        cit = map.cbegin();
        BOOST_CHECK_EQUAL(it->first, "2");
        BOOST_CHECK_EQUAL(cit->first, "1");
    }
}

BOOST_AUTO_TEST_CASE(test_reserve) {
    Map map;
    map.reserve(128);
    for (int i = 0; i < 100; ++i) {
        map.append(std::to_string(i), i);
    }
    BOOST_CHECK_EQUAL(map.size(), 100u);
    BOOST_CHECK_EQUAL(map.value("42"), 42);

    // insertion order survives the growth
    auto keys = map.keys();
    BOOST_REQUIRE_EQUAL(keys.size(), 100u);
    BOOST_CHECK_EQUAL(keys.front(), "0");
    BOOST_CHECK_EQUAL(keys.back(), "99");
}

BOOST_AUTO_TEST_CASE(test_ordered_index) {
    OrderedMap map;
    map.append("b", 2);
    map.prepend("a", 1);
    map.append("c", 3);

    std::vector<std::pair<std::string, int>> values;
    for (const auto &item : map) {
        values.emplace_back(item.first, item.second);
    }
    BOOST_CHECK(values == (std::vector<std::pair<std::string, int>>{
                              {"a", 1},
                              {"b", 2},
                              {"c", 3},
    }));
    BOOST_CHECK_EQUAL(map.find("b")->second, 2);
    BOOST_CHECK_EQUAL(map.erase("b"), 1u);
    BOOST_CHECK(!map.contains("b"));

    OrderedMap copy = map;
    BOOST_CHECK(copy == map);
    OrderedMap moved = std::move(copy);
    BOOST_CHECK(moved == map);
}

BOOST_AUTO_TEST_CASE(test_view_index) {
    static_assert(std::is_same_v<StringViewMap::map_type::key_type, std::string_view>);

    std::string callerKey = "one";
    StringViewMap map;
    map.append(callerKey, 1);
    callerKey.assign("changed");
    BOOST_CHECK(map.contains("one"));
    BOOST_CHECK(!map.contains("changed"));

    map.append("two", 2);
    StringViewMap copy = map;
    map.clear();
    BOOST_CHECK_EQUAL(copy.value("one"), 1);
    BOOST_CHECK_EQUAL(copy.value("two"), 2);

    StringViewMap moved = std::move(copy);
    BOOST_CHECK_EQUAL(moved.erase("one"), 1u);
    BOOST_CHECK(!moved.contains("one"));
    BOOST_CHECK_EQUAL(moved.value("two"), 2);

    StringViewMap assigned;
    assigned.append("old", 0);
    assigned = moved;
    moved.clear();
    BOOST_CHECK_EQUAL(assigned.value("two"), 2);
    BOOST_CHECK(!assigned.contains("old"));

    StringViewMap moveAssigned;
    moveAssigned.append("old", 0);
    moveAssigned = std::move(assigned);
    BOOST_CHECK_EQUAL(moveAssigned.value("two"), 2);

    StringViewMap swapped;
    swapped.append("three", 3);
    moveAssigned.swap(swapped);
    BOOST_CHECK_EQUAL(moveAssigned.value("three"), 3);
    BOOST_CHECK_EQUAL(swapped.value("two"), 2);

    linked_map<std::string, int, linked_map_ordered_traits<>, StringViewKey> ordered;
    ordered.append("b", 2);
    ordered.prepend("a", 1);
    BOOST_CHECK_EQUAL(ordered.begin()->first, "a");
    BOOST_CHECK_EQUAL(ordered.value("b"), 2);
}

BOOST_AUTO_TEST_CASE(test_explicit_owning_index) {
    using OwningMap = linked_map<std::string, int, linked_map_unordered_traits<>,
                                 linked_map_key_traits<std::string>>;
    static_assert(std::is_same_v<OwningMap::map_type::key_type, std::string>);

    OwningMap map;
    map.append("one", 1);
    BOOST_CHECK_EQUAL(map.value("one"), 1);
}

BOOST_AUTO_TEST_CASE(test_list_and_index_share_the_allocator) {
    using Pair = std::pair<const std::string, int>;
    using Allocator = TrackingAllocator<Pair>;
    using HashedMap = linked_map<
        std::string, int,
        linked_map_unordered_traits<std::hash<std::string>, std::equal_to<std::string>, Allocator>,
        linked_map_key_traits<std::string>>;
    using TreeMap =
        linked_map<std::string, int, linked_map_ordered_traits<std::less<std::string>, Allocator>,
                   linked_map_key_traits<std::string>>;
    using ViewHashedMap =
        linked_map<std::string, int,
                   linked_map_unordered_traits<std::hash<std::string_view>,
                                               std::equal_to<std::string_view>, Allocator>,
                   StringViewKey>;

    auto firstState = std::make_shared<AllocatorState>();
    HashedMap source{Allocator(firstState)};
    source.append("one", 1);
    BOOST_CHECK(source.get_allocator().state == firstState);
    BOOST_CHECK(firstState->allocations >= 3u); // list node, index node, and hash buckets

    auto secondState = std::make_shared<AllocatorState>();
    HashedMap target{Allocator(secondState)};
    target.append("old", 0);
    target = source;
    BOOST_CHECK(target.get_allocator().state == secondState);
    BOOST_CHECK_EQUAL(target.value("one"), 1);
    BOOST_CHECK(!target.contains("old"));

    auto thirdState = std::make_shared<AllocatorState>();
    HashedMap moved{Allocator(thirdState)};
    moved = std::move(source);
    BOOST_CHECK(moved.get_allocator().state == thirdState);
    BOOST_CHECK_EQUAL(moved.value("one"), 1);
    BOOST_CHECK(source.empty());

    HashedMap equalSource{Allocator(thirdState)};
    equalSource.append("two", 2);
    moved = std::move(equalSource);
    BOOST_CHECK(moved.get_allocator().state == thirdState);
    BOOST_CHECK_EQUAL(moved.value("two"), 2);
    BOOST_CHECK(equalSource.empty());

    auto treeState = std::make_shared<AllocatorState>();
    TreeMap tree{Allocator(treeState)};
    tree.append("one", 1);
    BOOST_CHECK(tree.get_allocator().state == treeState);
    BOOST_CHECK(treeState->allocations >= 2u); // one list node and one tree node

    ViewHashedMap viewSource{Allocator(firstState)};
    viewSource.append("view", 1);
    ViewHashedMap viewTarget{Allocator(secondState)};
    viewTarget.append("old", 0);
    viewTarget = std::move(viewSource);
    BOOST_CHECK(viewSource.empty());
    BOOST_CHECK_EQUAL(viewTarget.value("view"), 1);
    BOOST_CHECK(!viewTarget.contains("old"));
}

BOOST_AUTO_TEST_CASE(test_existing_subscript_does_not_construct_a_value) {
    linked_map<int, CountedValue> map;
    map.append(1, CountedValue(7));

    CountedValue::defaultConstructions = 0;
    BOOST_CHECK_EQUAL(map[1].value, 7);
    BOOST_CHECK_EQUAL(CountedValue::defaultConstructions, 0);

    BOOST_CHECK_EQUAL(map[2].value, 0);
    BOOST_CHECK_EQUAL(CountedValue::defaultConstructions, 1);

    auto inserted = map.try_emplace(3, 9);
    BOOST_CHECK(inserted.second);
    BOOST_CHECK_EQUAL(inserted.first->second.value, 9);
    auto duplicate = map.try_emplace(3, 10);
    BOOST_CHECK(!duplicate.second);
    BOOST_CHECK_EQUAL(duplicate.first->second.value, 9);
}

#ifdef STDC_HAS_EXCEPTIONS
BOOST_AUTO_TEST_CASE(test_failed_insertion_rolls_back_the_index) {
    linked_map<int, ThrowingValue> map;
    ThrowingValue value;

    BOOST_CHECK_THROW(map.append(1, value), std::runtime_error);
    BOOST_CHECK(map.empty());
    BOOST_CHECK(!map.contains(1));
    BOOST_CHECK(map.find(1) == map.end());

    BOOST_CHECK(map.append(2, ThrowingValue()).second);
    BOOST_CHECK_EQUAL(map.size(), 1u);
    BOOST_CHECK(map.contains(2));
}
#endif

// The value type does not have to be default constructible for the map to work, as long as
// operator[] is left alone.
BOOST_AUTO_TEST_CASE(test_non_trivial_value) {
    linked_map<int, std::string> map;
    map.append(1, "one");
    map.append(2, "two");

    BOOST_CHECK_EQUAL(map.value(1), "one");
    BOOST_CHECK_EQUAL(map.find(2)->second, "two");

    // move a value in
    std::string big(1000, 'x');
    map.append(3, std::move(big));
    BOOST_CHECK_EQUAL(map.value(3).size(), 1000u);

    std::vector<int> expect_keys = {1, 2, 3};
    BOOST_CHECK(map.keys() == expect_keys);
}

BOOST_AUTO_TEST_SUITE_END()

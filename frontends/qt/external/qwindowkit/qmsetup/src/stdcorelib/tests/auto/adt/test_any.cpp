// SPDX-License-Identifier: MIT

#include <memory>
#include <string>
#include <utility>
#include <vector>

#include <stdcorelib/adt/any.h>
#include <stdcorelib/support/sharedlibrary.h>

#include "../plugins/test_any_plugin.h"

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_any)

namespace {

    struct Tracked {
        static int alive;
        int value;

        explicit Tracked(int v = 0) : value(v) {
            ++alive;
        }
        Tracked(const Tracked &other) : value(other.value) {
            ++alive;
        }
        Tracked &operator=(const Tracked &) = default;
        ~Tracked() {
            --alive;
        }
    };

    int Tracked::alive = 0;

    struct Base {
        int b = 1;
    };
    struct Derived : Base {
        int d = 2;
    };

    // Small and cheap to move, so it belongs in the buffer, and it counts its own lifetimes so
    // that the buffer's destructor can be checked.
    struct SmallTracked {
        static int alive;
        int value;

        explicit SmallTracked(int v = 0) noexcept : value(v) {
            ++alive;
        }
        SmallTracked(const SmallTracked &other) noexcept : value(other.value) {
            ++alive;
        }
        SmallTracked(SmallTracked &&other) noexcept : value(other.value) {
            ++alive;
        }
        ~SmallTracked() {
            --alive;
        }
    };

    int SmallTracked::alive = 0;

    // Exactly the width of the buffer, and spelled as a name so the comma in it does not reach
    // the check macros.
    using PointerPair = std::pair<void *, void *>;

    // Too wide for the buffer whatever else is true of it.
    struct Wide {
        void *a;
        void *b;
        void *c;
        void *d;
    };

    // Small enough, but throwing while being moved would make moving an any throw, so this one
    // has to go to the heap anyway.
    struct ThrowingMove {
        int value;
        explicit ThrowingMove(int v = 0) : value(v) {
        }
        ThrowingMove(const ThrowingMove &other) : value(other.value) {
        }
        ThrowingMove(ThrowingMove &&other) : value(other.value) {
        }
    };

    // Whether the value sits inside the any rather than at the far end of a pointer.
    template <class T>
    bool stored_inline(const any &value) {
        const auto *held = reinterpret_cast<const char *>(any_cast<T>(&value));
        const auto *self = reinterpret_cast<const char *>(&value);
        return held >= self && held < self + sizeof(any);
    }

}

BOOST_AUTO_TEST_CASE(test_empty) {
    any value;
    BOOST_CHECK(!value.has_value());
    BOOST_CHECK(value.type().name().empty());
    BOOST_CHECK(any_cast<int>(&value) == nullptr);
    BOOST_CHECK(!value.holds<int>());
}

BOOST_AUTO_TEST_CASE(test_round_trip) {
    any value = 42;
    BOOST_REQUIRE(value.has_value());
    BOOST_CHECK(value.holds<int>());
    BOOST_REQUIRE(any_cast<int>(&value) != nullptr);
    BOOST_CHECK_EQUAL(*any_cast<int>(&value), 42);

    // a type that is not trivially copyable, so the storage has real work to do
    any text = std::string("hello");
    BOOST_REQUIRE(any_cast<std::string>(&text) != nullptr);
    BOOST_CHECK_EQUAL(*any_cast<std::string>(&text), "hello");

    // and one that is only movable into place
    any vec = std::vector<int>{1, 2, 3};
    BOOST_REQUIRE(any_cast<std::vector<int>>(&vec) != nullptr);
    BOOST_CHECK_EQUAL(any_cast<std::vector<int>>(&vec)->size(), 3u);
}

BOOST_AUTO_TEST_CASE(test_wrong_type_is_null_not_garbage) {
    any value = 42;
    BOOST_CHECK(any_cast<long>(&value) == nullptr); // a different type of the same size
    BOOST_CHECK(any_cast<unsigned>(&value) == nullptr);
    BOOST_CHECK(any_cast<std::string>(&value) == nullptr);
    BOOST_CHECK(!value.holds<long>());
}

// Only the exact type comes back. This is the same rule std::any follows, and it is worth a test
// because reading a Derived as a Base looks reasonable until it silently does not work.
BOOST_AUTO_TEST_CASE(test_no_conversion_to_base) {
    any value = Derived{};
    BOOST_CHECK(value.holds<Derived>());
    BOOST_CHECK(!value.holds<Base>());
    BOOST_CHECK(any_cast<Base>(&value) == nullptr);
}

// const and reference qualifiers are stripped on the way in, so they cannot be asked for on the
// way out either.
BOOST_AUTO_TEST_CASE(test_qualifiers_are_stripped) {
    const int original = 7;
    const int &ref = original;
    any value = ref;

    BOOST_CHECK(value.holds<int>());
    BOOST_CHECK(value.holds<const int>());
    BOOST_CHECK(value.holds<const int &>());
    BOOST_REQUIRE(any_cast<int>(&value) != nullptr);
    BOOST_CHECK_EQUAL(*any_cast<int>(&value), 7);

    // a string literal decays to a pointer, which is the type that comes back out
    any literal = "text";
    BOOST_CHECK(literal.holds<const char *>());
}

BOOST_AUTO_TEST_CASE(test_copy_and_move) {
    BOOST_REQUIRE_EQUAL(Tracked::alive, 0);
    {
        any value = Tracked{5};
        BOOST_CHECK_EQUAL(Tracked::alive, 1);

        any copy = value;
        BOOST_CHECK_EQUAL(Tracked::alive, 2); // a copy really is a copy
        BOOST_CHECK_EQUAL(any_cast<Tracked>(&copy)->value, 5);
        any_cast<Tracked>(&copy)->value = 6;
        BOOST_CHECK_EQUAL(any_cast<Tracked>(&value)->value, 5); // and is independent

        any moved = std::move(copy);
        BOOST_CHECK_EQUAL(Tracked::alive, 2); // moving does not
        BOOST_CHECK(!copy.has_value());
        BOOST_CHECK_EQUAL(any_cast<Tracked>(&moved)->value, 6);
    }
    BOOST_CHECK_EQUAL(Tracked::alive, 0); // and everything is destroyed
}

BOOST_AUTO_TEST_CASE(test_assignment_and_reset) {
    any value = 1;
    value = std::string("now a string");
    BOOST_CHECK(value.holds<std::string>());
    BOOST_CHECK(!value.holds<int>());

    value.reset();
    BOOST_CHECK(!value.has_value());

    // self assignment through the by value parameter has to leave the value alone
    any keep = 99;
    keep = keep;
    BOOST_REQUIRE(keep.has_value());
    BOOST_CHECK_EQUAL(*any_cast<int>(&keep), 99);
}

BOOST_AUTO_TEST_CASE(test_swap) {
    any left = 1;
    any right = std::string("right");
    swap(left, right);
    BOOST_CHECK(left.holds<std::string>());
    BOOST_CHECK(right.holds<int>());
}

BOOST_AUTO_TEST_CASE(test_type_name_is_readable) {
    any value = 42;
    // the exact spelling is the compiler's, so only look for the part every one of them agrees on
    BOOST_CHECK(value.type().name().find("int") != std::string_view::npos);

    any text = std::string();
    BOOST_CHECK(text.type().name().find("string") != std::string_view::npos);
}

// The identity of a type is a name looked up in a table, so two entries that were never compared
// before still have to agree, and a type never seen before has to get an answer of its own.
BOOST_AUTO_TEST_CASE(test_identity_is_stable) {
    any first = 42;
    any second = 43;
    BOOST_CHECK(first.holds<int>() && second.holds<int>());
    BOOST_CHECK_EQUAL(first.type().name(), second.type().name());

    struct NeverSeenBefore {
        int x;
    };
    any fresh = NeverSeenBefore{1};
    BOOST_CHECK(fresh.holds<NeverSeenBefore>());
    BOOST_CHECK(!fresh.holds<int>());
}

// A value small enough and cheap enough to move is kept in the any itself. This is the whole
// reason the storage is not simply a pointer, so it is worth asserting rather than assuming.
BOOST_AUTO_TEST_CASE(test_small_values_avoid_the_heap) {
    any number = 42;
    BOOST_CHECK(stored_inline<int>(number));

    any pointer = static_cast<void *>(nullptr);
    BOOST_CHECK(stored_inline<void *>(pointer));

    any two_pointers = PointerPair{};
    BOOST_CHECK(stored_inline<PointerPair>(two_pointers));

    // and the ones that cannot be
    any wide = Wide{};
    BOOST_CHECK(!stored_inline<Wide>(wide));

    any throwing = ThrowingMove{1};
    BOOST_CHECK(!stored_inline<ThrowingMove>(throwing));

    // a string owns its own allocation and is wider than the buffer either way
    any text = std::string("text");
    BOOST_CHECK(!stored_inline<std::string>(text));
}

// The buffer holds a real object, so it has to be destroyed, copied and moved like one.
BOOST_AUTO_TEST_CASE(test_inline_values_have_their_lifetime_run) {
    BOOST_REQUIRE_EQUAL(SmallTracked::alive, 0);
    {
        any value = SmallTracked{5};
        BOOST_REQUIRE(stored_inline<SmallTracked>(value));
        BOOST_CHECK_EQUAL(SmallTracked::alive, 1);

        any copy = value;
        BOOST_CHECK_EQUAL(SmallTracked::alive, 2);
        any_cast<SmallTracked>(&copy)->value = 6;
        BOOST_CHECK_EQUAL(any_cast<SmallTracked>(&value)->value, 5); // independent copies

        any moved = std::move(copy);
        BOOST_CHECK(!copy.has_value());
        BOOST_CHECK_EQUAL(any_cast<SmallTracked>(&moved)->value, 6);
        BOOST_CHECK_EQUAL(SmallTracked::alive, 2); // the moved from one is gone, not leaked

        moved.reset();
        BOOST_CHECK_EQUAL(SmallTracked::alive, 1);
    }
    BOOST_CHECK_EQUAL(SmallTracked::alive, 0);
}

// Swapping cannot be a pointer exchange once a value can live in the buffer.
BOOST_AUTO_TEST_CASE(test_swap_across_both_kinds_of_storage) {
    BOOST_REQUIRE_EQUAL(SmallTracked::alive, 0);
    {
        any small = SmallTracked{1};
        any wide = Wide{};

        swap(small, wide);
        BOOST_CHECK(small.holds<Wide>());
        BOOST_CHECK(wide.holds<SmallTracked>());
        BOOST_CHECK_EQUAL(any_cast<SmallTracked>(&wide)->value, 1);
        BOOST_CHECK_EQUAL(SmallTracked::alive, 1);

        // and with an empty one on one side
        any empty;
        swap(empty, wide);
        BOOST_CHECK(empty.holds<SmallTracked>());
        BOOST_CHECK(!wide.has_value());
        BOOST_CHECK_EQUAL(SmallTracked::alive, 1);
    }
    BOOST_CHECK_EQUAL(SmallTracked::alive, 0);
}

#ifdef TEST_ANY_PLUGIN_PATH

// Whether a value keeps its identity on the way into another module cannot be answered from
// inside one binary. The plugin is a separate one, built with hidden visibility, so nothing here
// can pass by accident of the loader having merged a symbol.
BOOST_AUTO_TEST_CASE(test_identity_across_a_module_boundary) {
    SharedLibrary plugin;
    BOOST_REQUIRE_MESSAGE(plugin.open(TEST_ANY_PLUGIN_PATH), plugin.errorMessage());

    auto fill = reinterpret_cast<void (*)(any *, int)>(plugin.resolve("any_plugin_fill"));
    auto read = reinterpret_cast<bool (*)(const any *, int *)>(plugin.resolve("any_plugin_read"));
    auto entry = reinterpret_cast<const void *(*) ()>(plugin.resolve("any_plugin_entry"));
    BOOST_REQUIRE(fill && read && entry);

    // The two modules really do have a record each. Were it one shared object, everything below
    // would be answered by the fast path and would prove nothing.
    const auto *mine = static_cast<const void *>(&detail::entry_of<AnyPluginPayload>());
    BOOST_REQUIRE(entry() != mine);

    // No build may ever mistake one type for another. Comparing two different types first is
    // what makes this module's table put a name to them, and an entry named by one table once
    // matched an entry named by a different one.
    any number = 42;
    BOOST_CHECK(!number.holds<double>());
    int out = 0;
    BOOST_CHECK(!read(&number, &out));

    any fromPlugin;
    fill(&fromPlugin, 7);
    BOOST_CHECK(any_cast<int>(&fromPlugin) == nullptr);
    BOOST_CHECK(!fromPlugin.type().name().empty());

#  ifdef STDC_STATIC
    // Each module linked its own copy of the table, so a type is not expected to carry across.
    // The checks above still hold, because refusing is the only alternative allowed.
    BOOST_TEST_MESSAGE("stdcorelib is linked statically here, so the modules have a table each "
                       "and identity is not expected to cross between them");
#  else
    BOOST_CHECK(fromPlugin.holds<AnyPluginPayload>());
    BOOST_REQUIRE(any_cast<AnyPluginPayload>(&fromPlugin) != nullptr);
    BOOST_CHECK_EQUAL(any_cast<AnyPluginPayload>(&fromPlugin)->value, 7);

    any fromHere = AnyPluginPayload{99};
    BOOST_CHECK(read(&fromHere, &out));
    BOOST_CHECK_EQUAL(out, 99);
#  endif
}

#endif // TEST_ANY_PLUGIN_PATH

BOOST_AUTO_TEST_CASE(test_size_is_a_buffer_plus_a_pointer) {
    BOOST_CHECK_EQUAL(sizeof(any), 2 * sizeof(void *) + sizeof(void *));
}

#ifdef STDC_HAS_EXCEPTIONS
BOOST_AUTO_TEST_CASE(test_value_cast_throws_on_the_wrong_type) {
    any value = 42;
    BOOST_CHECK_EQUAL(any_cast<int>(value), 42);
    BOOST_CHECK_THROW(any_cast<std::string>(value), bad_any_cast);

    const any &constant = value;
    BOOST_CHECK_EQUAL(any_cast<int>(constant), 42);
    BOOST_CHECK_THROW(any_cast<std::string>(constant), bad_any_cast);
}

// The exception is caught by type above and nothing had ever read what it says, which is the
// part a program prints.
BOOST_AUTO_TEST_CASE(test_the_bad_cast_says_what_it_is) {
    any value = 42;
    try {
        (void) any_cast<std::string>(value);
        BOOST_ERROR("the cast should have thrown");
    } catch (const bad_any_cast &e) {
        BOOST_CHECK_EQUAL(std::string(e.what()), "stdc::bad_any_cast");
    }

    // And it is a std::exception, so catching that catches this.
    try {
        (void) any_cast<std::string>(value);
        BOOST_ERROR("the cast should have thrown");
    } catch (const std::exception &e) {
        BOOST_CHECK_EQUAL(std::string(e.what()), "stdc::bad_any_cast");
    }
}
#endif

BOOST_AUTO_TEST_SUITE_END()

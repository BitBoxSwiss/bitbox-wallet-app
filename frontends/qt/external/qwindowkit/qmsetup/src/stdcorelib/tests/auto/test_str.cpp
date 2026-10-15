// SPDX-License-Identifier: MIT

#include <stdcorelib/str.h>

#include <cstdarg>
#include <map>
#include <string>
#include <system_error>
#include <vector>

#ifdef _WIN32
// For the error numbers the UTF-8 category is asked about. Through this header, which defines
// NOMINMAX first.
#  include <stdcorelib/platform/windows/stdc_windows.h>
#endif

#include <boost/test/unit_test.hpp>

namespace fs = std::filesystem;

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_str)

BOOST_AUTO_TEST_CASE(test_split) {
    // string_view overload yields views into the source
    {
        auto parts = str::split("a,b,c", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 3u);
        BOOST_CHECK_EQUAL(parts[0], "a");
        BOOST_CHECK_EQUAL(parts[1], "b");
        BOOST_CHECK_EQUAL(parts[2], "c");
    }

    // empty fields are kept
    {
        auto parts = str::split("a,,b", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 3u);
        BOOST_CHECK_EQUAL(parts[1], "");
    }
    {
        auto parts = str::split("a,b,", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 3u);
        BOOST_CHECK_EQUAL(parts[2], "");
    }
    {
        auto parts = str::split(",a", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 2u);
        BOOST_CHECK_EQUAL(parts[0], "");
        BOOST_CHECK_EQUAL(parts[1], "a");
    }

    // no delimiter present, and the empty string, both give a single field
    {
        auto parts = str::split("abc", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 1u);
        BOOST_CHECK_EQUAL(parts[0], "abc");
    }
    {
        auto parts = str::split("", ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 1u);
        BOOST_CHECK_EQUAL(parts[0], "");
    }

    // multi-character delimiter
    {
        auto parts = str::split("a::b::c", "::");
        BOOST_REQUIRE_EQUAL(parts.size(), 3u);
        BOOST_CHECK_EQUAL(parts[1], "b");
    }

    // rvalue string overload yields owning strings
    {
        std::vector<std::string> parts = str::split(std::string("a,b"), ",");
        BOOST_REQUIRE_EQUAL(parts.size(), 2u);
        BOOST_CHECK_EQUAL(parts[0], "a");
        BOOST_CHECK_EQUAL(parts[1], "b");
    }
}

BOOST_AUTO_TEST_CASE(test_join) {
    // A braced list used to be ambiguous between the string and the string_view overload, so the
    // argument type had to be named. The initializer_list overload takes it now.
    BOOST_CHECK_EQUAL(str::join({"a", "b", "c"}, "-"), "a-b-c");
    BOOST_CHECK_EQUAL(str::join({"a"}, "-"), "a");
    BOOST_CHECK_EQUAL(str::join({"a", "b"}, ""), "ab");
    BOOST_CHECK_EQUAL(str::join({"", ""}, ","), ",");

    // a braced list of std::string, and of string_view, reach it too
    BOOST_CHECK_EQUAL(str::join({std::string("a"), std::string("b")}, "-"), "a-b");
    {
        std::string_view a = "a", b = "b";
        BOOST_CHECK_EQUAL(str::join({a, b}, "-"), "a-b");
    }

    // an empty list joins to nothing
    {
        std::vector<std::string> empty;
        BOOST_CHECK_EQUAL(str::join(empty, "-"), "");
    }

    // from a container
    {
        std::vector<std::string> v = {"x", "y", "z"};
        BOOST_CHECK_EQUAL(str::join(v, ", "), "x, y, z");
    }

    // the string_view overload
    {
        std::vector<std::string_view> v = {"x", "y"};
        BOOST_CHECK_EQUAL(str::join(v, "/"), "x/y");
    }

    // split and join are inverses when no field contains the delimiter
    {
        const std::string original = "a,b,c";
        auto parts = str::split(original, ",");
        BOOST_CHECK_EQUAL(str::join(parts, ","), original);
    }
}

// Answered at compile time, so a caller can fold a constant into a switch label or an array
// bound. Checked here rather than assumed, since an accidental call out to the C library would
// still pass every runtime check below.
static_assert(str::is_digit('7'), "");
static_assert(!str::is_digit('x'), "");
static_assert(str::is_alpha('x') && str::is_alnum('x'), "");
static_assert(str::to_upper('a') == 'A' && str::to_lower('Z') == 'z', "");
static_assert(str::hex_value('c') == 12 && str::hex_value('g') == -1, "");

BOOST_AUTO_TEST_CASE(test_ascii_classification) {
    BOOST_CHECK(str::is_digit('0') && str::is_digit('9'));
    BOOST_CHECK(!str::is_digit('/') && !str::is_digit(':')); // the neighbours of the range

    BOOST_CHECK(str::is_hex_digit('0') && str::is_hex_digit('f') && str::is_hex_digit('F'));
    BOOST_CHECK(!str::is_hex_digit('g') && !str::is_hex_digit('G'));

    BOOST_CHECK(str::is_lower('a') && str::is_lower('z') && !str::is_lower('A'));
    BOOST_CHECK(str::is_upper('A') && str::is_upper('Z') && !str::is_upper('a'));
    BOOST_CHECK(str::is_alpha('Q') && !str::is_alpha('1'));
    BOOST_CHECK(str::is_alnum('Q') && str::is_alnum('1') && !str::is_alnum('_'));

    BOOST_CHECK(str::is_space(' ') && str::is_space('\t') && str::is_space('\n'));
    BOOST_CHECK(str::is_space('\v') && str::is_space('\f') && str::is_space('\r'));
    BOOST_CHECK(!str::is_space('\0') && !str::is_space('a'));

    BOOST_CHECK(str::is_print(' ') && str::is_print('~'));
    BOOST_CHECK(!str::is_print('\x7F') && !str::is_print('\n'));
    BOOST_CHECK(str::is_punct('_') && str::is_punct('?'));
    BOOST_CHECK(!str::is_punct(' ') && !str::is_punct('a'));

    BOOST_CHECK_EQUAL(str::hex_value('0'), 0);
    BOOST_CHECK_EQUAL(str::hex_value('9'), 9);
    BOOST_CHECK_EQUAL(str::hex_value('a'), 10);
    BOOST_CHECK_EQUAL(str::hex_value('F'), 15);
    BOOST_CHECK_EQUAL(str::hex_value(' '), -1);

    // The reason this set exists. A UTF-8 lead or continuation byte is negative wherever char
    // is signed, which is outside what the C library's classifiers are defined for: MSVC's
    // debug runtime ends the process on one. Every answer here is a plain false.
    for (char c : std::string("\xE4\xB8\xAD")) { // "中"
        BOOST_CHECK(!str::is_digit(c));
        BOOST_CHECK(!str::is_alpha(c));
        BOOST_CHECK(!str::is_alnum(c));
        BOOST_CHECK(!str::is_space(c));
        BOOST_CHECK(!str::is_print(c));
        BOOST_CHECK(!str::is_punct(c));
        BOOST_CHECK(!str::is_lower(c));
        BOOST_CHECK(!str::is_upper(c));
        BOOST_CHECK_EQUAL(str::hex_value(c), -1);
        BOOST_CHECK(str::to_lower(c) == c);
        BOOST_CHECK(str::to_upper(c) == c);
    }

    // A wchar_t above the unsigned char range is the same story for the narrow classifiers, and
    // the wide overloads have to answer for it without narrowing it first. L'\u2009' is a thin
    // space, whose low byte alone would read as a tab.
    BOOST_CHECK(!str::is_space(L'\u2009'));
    BOOST_CHECK(!str::is_alpha(L'中') && !str::is_print(L'中'));
    BOOST_CHECK(str::to_upper(L'中') == L'中');
    BOOST_CHECK(str::is_space(L' ') && str::to_upper(L'a') == L'A');
}

BOOST_AUTO_TEST_CASE(test_case_conversion) {
    BOOST_CHECK_EQUAL(str::to_upper(std::string("hello")), "HELLO");
    BOOST_CHECK_EQUAL(str::to_upper(std::string("Hello World 123")), "HELLO WORLD 123");
    BOOST_CHECK_EQUAL(str::to_upper(std::string("")), "");

    BOOST_CHECK_EQUAL(str::to_lower(std::string("HELLO")), "hello");
    BOOST_CHECK_EQUAL(str::to_lower(std::string("Hello World 123")), "hello world 123");
    BOOST_CHECK_EQUAL(str::to_lower(std::string("")), "");

    // wide overloads
    BOOST_CHECK(str::to_upper(std::wstring(L"hello")) == L"HELLO");
    BOOST_CHECK(str::to_lower(std::wstring(L"HELLO")) == L"hello");

    // Only the ASCII letters fold, so UTF-8 text comes back byte for byte. Folding it one byte
    // at a time is what a locale-driven fold would do, and what it would return is not UTF-8.
    {
        const std::string utf8 = "\xE4\xB8\xAD\xE6\x96\x87"; // "中文"
        BOOST_CHECK_EQUAL(str::to_upper(utf8), utf8);
        BOOST_CHECK_EQUAL(str::to_lower(utf8), utf8);

        const std::string mixed = "a\xE4\xB8\xADz";
        BOOST_CHECK_EQUAL(str::to_upper(mixed), "A\xE4\xB8\xADZ");
    }

    // The wide ones fold the same range and no more, so a letter that has a case outside ASCII
    // keeps the case it came with.
    {
        const std::wstring wide = L"中文";
        BOOST_CHECK(str::to_upper(wide) == wide);
        BOOST_CHECK(str::to_lower(wide) == wide);

        BOOST_CHECK(str::to_upper(std::wstring(L"a中z")) == L"A中Z");
        BOOST_CHECK(str::to_lower(std::wstring(L"\u00C9")) == L"\u00C9");
    }

    // also reachable unqualified from namespace stdc
    BOOST_CHECK_EQUAL(to_upper(std::string("abc")), "ABC");
    BOOST_CHECK_EQUAL(to_lower(std::string("ABC")), "abc");
}

// Ours rather than the platform's, whose folding follows the locale, so what it answers is
// checked here rather than assumed.
BOOST_AUTO_TEST_CASE(test_compare_insensitive) {
    BOOST_CHECK_EQUAL(str::compare_insensitive("Hello", "hello"), 0);
    BOOST_CHECK_EQUAL(str::compare_insensitive("HELLO", "hello"), 0);
    BOOST_CHECK_EQUAL(str::compare_insensitive("", ""), 0);

    // Ordered by the folded bytes, and by length where one runs out.
    BOOST_CHECK_LT(str::compare_insensitive("abc", "abd"), 0);
    BOOST_CHECK_GT(str::compare_insensitive("ABD", "abc"), 0);
    BOOST_CHECK_LT(str::compare_insensitive("abc", "abcd"), 0);
    BOOST_CHECK_GT(str::compare_insensitive("abcd", "ABC"), 0);

    // A view is not null terminated, and neither is a piece of one.
    const std::string line = "--OUTPUT=x";
    BOOST_CHECK_EQUAL(str::compare_insensitive(std::string_view(line).substr(0, 8), "--output"), 0);

    // Only the ASCII letters fold. UTF-8 bytes have no case and must come through as they are.
    BOOST_CHECK_EQUAL(str::compare_insensitive("\xE4\xB8\xAD", "\xE4\xB8\xAD"), 0);
    BOOST_CHECK_EQUAL(str::compare_insensitive("a\xE4\xB8\xAD"
                                               "z",
                                               "A\xE4\xB8\xAD"
                                               "Z"),
                      0);
    BOOST_CHECK_NE(str::compare_insensitive("_", "?"), 0);

    // Bytes above 0x7F sort after every letter, which they do only when the comparison treats
    // them as unsigned. Left as char they are negative wherever char is signed.
    BOOST_CHECK_GT(str::compare_insensitive("\xE4", "z"), 0);
    BOOST_CHECK_LT(str::compare_insensitive("z", "\xE4"), 0);

    // also reachable unqualified from namespace stdc
    BOOST_CHECK_EQUAL(compare_insensitive("--INPUT", "--input"), 0);

    // The same answer without the ordering, which is what nearly every caller wants.
    BOOST_CHECK(str::equals_insensitive("--INPUT", "--input"));
    BOOST_CHECK(!str::equals_insensitive("--input", "--inputs"));
    BOOST_CHECK(str::equals_insensitive(L"Kernel32.DLL", L"kernel32.dll"));
    BOOST_CHECK(!str::equals_insensitive(L"\u4e2d", L"\u6587"));
}

BOOST_AUTO_TEST_CASE(test_starts_ends_with) {
    BOOST_CHECK(str::starts_with("hello world", "hello"));
    BOOST_CHECK(!str::starts_with("hello world", "world"));
    BOOST_CHECK(str::starts_with("hello", "hello")); // whole string
    BOOST_CHECK(str::starts_with("hello", ""));      // empty prefix
    BOOST_CHECK(!str::starts_with("ab", "abc"));     // prefix longer than string
    BOOST_CHECK(!str::starts_with("", "a"));

    BOOST_CHECK(str::ends_with("hello world", "world"));
    BOOST_CHECK(!str::ends_with("hello world", "hello"));
    BOOST_CHECK(str::ends_with("hello", "hello"));
    BOOST_CHECK(str::ends_with("hello", ""));
    BOOST_CHECK(!str::ends_with("ab", "xab"));
    BOOST_CHECK(!str::ends_with("", "a"));

    // char overloads
    BOOST_CHECK(str::starts_with("abc", 'a'));
    BOOST_CHECK(!str::starts_with("abc", 'c'));
    BOOST_CHECK(!str::starts_with("", 'a'));
    BOOST_CHECK(str::ends_with("abc", 'c'));
    BOOST_CHECK(!str::ends_with("abc", 'a'));
    BOOST_CHECK(!str::ends_with("", 'c'));

    // wide overloads
    BOOST_CHECK(str::starts_with(std::wstring_view(L"abc"), std::wstring_view(L"ab")));
    BOOST_CHECK(str::ends_with(std::wstring_view(L"abc"), std::wstring_view(L"bc")));
    BOOST_CHECK(str::starts_with(std::wstring_view(L"abc"), L'a'));
    BOOST_CHECK(str::ends_with(std::wstring_view(L"abc"), L'c'));
}

BOOST_AUTO_TEST_CASE(test_starts_ends_with_folded) {
    BOOST_CHECK(str::starts_with("Hello World", "hello", true));
    BOOST_CHECK(!str::starts_with("Hello World", "hello", false)); // the default
    BOOST_CHECK(!str::starts_with("Hello World", "hello"));
    BOOST_CHECK(str::ends_with("Hello World", "WORLD", true));
    BOOST_CHECK(!str::ends_with("Hello World", "WORLD"));

    // the edges the sensitive form has, answered the same way
    BOOST_CHECK(str::starts_with("abc", "", true));
    BOOST_CHECK(!str::starts_with("ab", "ABC", true));
    BOOST_CHECK(!str::starts_with("", "a", true));
    BOOST_CHECK(str::ends_with("abc", "", true));
    BOOST_CHECK(!str::ends_with("ab", "XAB", true));
    BOOST_CHECK(!str::ends_with("", "a", true));

    // char overloads
    BOOST_CHECK(str::starts_with("Abc", 'a', true));
    BOOST_CHECK(!str::starts_with("Abc", 'a'));
    BOOST_CHECK(str::ends_with("abC", 'c', true));
    BOOST_CHECK(!str::ends_with("abC", 'c'));
    BOOST_CHECK(!str::starts_with("", 'a', true));

    // wide overloads, which is what SharedLibrary::isLibrary() reads a suffix with
    BOOST_CHECK(
        str::ends_with(std::wstring_view(L"Qt6Core.DLL"), std::wstring_view(L".dll"), true));
    BOOST_CHECK(!str::ends_with(std::wstring_view(L"Qt6Core.DLL"), std::wstring_view(L".dll")));
    BOOST_CHECK(str::starts_with(std::wstring_view(L"ABC"), L'a', true));

    // Only the ASCII letters fold, so a name outside it still has to match itself and nothing
    // else. A locale-driven fold is what would answer otherwise.
    BOOST_CHECK(str::ends_with("\xE4\xB8\xAD.DLL", ".dll", true));
    BOOST_CHECK(str::starts_with("\xE4\xB8\xADx", "\xE4\xB8\xADX", true));
    BOOST_CHECK(!str::starts_with("\xE4\xB8\xAD", "\xE6\x96\x87", true));
}

// The string_view and the std::string&& overloads used to be ambiguous for a plain string
// literal: both need exactly one user-defined conversion. clang and gcc rejected every such
// call, MSVC quietly resolved it to the std::string one and allocated. A third overload taking
// const char * settles it, because array-to-pointer is an exact match and beats both.
BOOST_AUTO_TEST_CASE(test_literal_overload_resolution) {
    static_assert(std::is_same_v<decltype(str::trim("x")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::ltrim("x")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::rtrim("x")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::trim("x", 'x')), std::string_view>);
    static_assert(std::is_same_v<decltype(str::trim("x", "y")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::drop_front("x")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::drop_back("x")), std::string_view>);
    static_assert(std::is_same_v<decltype(str::split("x", ",")), std::vector<std::string_view>>);

    // a real std::string rvalue still gets the owning overload, since a view into it would
    // dangle the moment the call returns
    static_assert(std::is_same_v<decltype(str::trim(std::string())), std::string>);
    static_assert(std::is_same_v<decltype(str::drop_front(std::string())), std::string>);
    static_assert(
        std::is_same_v<decltype(str::split(std::string(), ",")), std::vector<std::string>>);

    // an lvalue string is not about to die, so it gets a view, as it always did
    std::string lvalue = "x";
    static_assert(std::is_same_v<decltype(str::trim(lvalue)), std::string_view>);
    static_assert(std::is_same_v<decltype(str::split(lvalue, ",")), std::vector<std::string_view>>);
    (void) lvalue;

    BOOST_CHECK(true); // the checks above are compile time
}

BOOST_AUTO_TEST_CASE(test_drop) {
    BOOST_CHECK_EQUAL(str::drop_front("hello"), "ello");
    BOOST_CHECK_EQUAL(str::drop_front("hello", 3), "lo");
    BOOST_CHECK_EQUAL(str::drop_front("hello", 5), "");
    BOOST_CHECK_EQUAL(str::drop_front("hello", 0), "hello");

    BOOST_CHECK_EQUAL(str::drop_back("hello"), "hell");
    BOOST_CHECK_EQUAL(str::drop_back("hello", 3), "he");
    BOOST_CHECK_EQUAL(str::drop_back("hello", 5), "");
    BOOST_CHECK_EQUAL(str::drop_back("hello", 0), "hello");

    // rvalue string overloads return owning strings
    BOOST_CHECK_EQUAL(str::drop_front(std::string("hello"), 2), "llo");
    BOOST_CHECK_EQUAL(str::drop_back(std::string("hello"), 2), "hel");
}

BOOST_AUTO_TEST_CASE(test_trim) {
    // default character set is whitespace
    BOOST_CHECK_EQUAL(str::trim("  hello  "), "hello");
    BOOST_CHECK_EQUAL(str::ltrim("  hello  "), "hello  ");
    BOOST_CHECK_EQUAL(str::rtrim("  hello  "), "  hello");

    BOOST_CHECK_EQUAL(str::trim("\t\n hello \r\n"), "hello");
    BOOST_CHECK_EQUAL(str::trim("hello"), "hello"); // nothing to trim
    BOOST_CHECK_EQUAL(str::trim(""), "");
    BOOST_CHECK_EQUAL(str::trim("   "), ""); // all whitespace
    BOOST_CHECK_EQUAL(str::ltrim("   "), "");
    BOOST_CHECK_EQUAL(str::rtrim("   "), "");

    // inner whitespace is untouched
    BOOST_CHECK_EQUAL(str::trim("  a b  "), "a b");

    // single character
    BOOST_CHECK_EQUAL(str::trim("xxhelloxx", 'x'), "hello");
    BOOST_CHECK_EQUAL(str::ltrim("xxhelloxx", 'x'), "helloxx");
    BOOST_CHECK_EQUAL(str::rtrim("xxhelloxx", 'x'), "xxhello");
    BOOST_CHECK_EQUAL(str::trim("xxxx", 'x'), "");

    // explicit character set
    BOOST_CHECK_EQUAL(str::trim("[hello]", "[]"), "hello");

    // rvalue string overloads
    BOOST_CHECK_EQUAL(str::trim(std::string("  hi  ")), "hi");
    BOOST_CHECK_EQUAL(str::ltrim(std::string("--hi"), '-'), "hi");
    BOOST_CHECK_EQUAL(str::rtrim(std::string("hi--"), '-'), "hi");
    BOOST_CHECK_EQUAL(str::trim(std::string("[hi]"), "[]"), "hi");

    // also reachable unqualified from namespace stdc
    BOOST_CHECK_EQUAL(trim("  hi  "), "hi");
}

BOOST_AUTO_TEST_CASE(test_contains) {
    BOOST_CHECK(str::contains("hello world", "lo w"));
    BOOST_CHECK(str::contains("hello", "hello"));
    BOOST_CHECK(str::contains("hello", "")); // the empty string is everywhere
    BOOST_CHECK(!str::contains("hello", "xyz"));
    BOOST_CHECK(!str::contains("", "a"));

    BOOST_CHECK(str::contains("hello", 'e'));
    BOOST_CHECK(!str::contains("hello", 'z'));
    BOOST_CHECK(!str::contains("", 'a'));

    // folded
    BOOST_CHECK(str::contains("Hello World", "LO W", true));
    BOOST_CHECK(!str::contains("Hello World", "LO W"));
    BOOST_CHECK(str::contains("hello", "HELLO", true)); // the whole string
    BOOST_CHECK(str::contains("hello", "", true));      // and the empty one
    BOOST_CHECK(!str::contains("hello", "XYZ", true));
    BOOST_CHECK(!str::contains("ab", "ABC", true)); // longer than the haystack
    BOOST_CHECK(!str::contains("", "a", true));
    BOOST_CHECK(str::contains("hello", 'E', true));
    BOOST_CHECK(!str::contains("hello", 'E'));
    BOOST_CHECK(!str::contains("", 'a', true));

    // Only the ASCII letters fold, so a byte outside it matches itself and nothing else.
    BOOST_CHECK(str::contains("a\xE4\xB8\xADz", "\xE4\xB8\xAD", true));
    BOOST_CHECK(!str::contains("a\xE4\xB8\xADz", "\xE6\x96\x87", true));
}

BOOST_AUTO_TEST_CASE(test_to_string) {
    BOOST_CHECK_EQUAL(str::to_string(true), "true");
    BOOST_CHECK_EQUAL(str::to_string(false), "false");

    BOOST_CHECK_EQUAL(str::to_string(42), "42");
    BOOST_CHECK_EQUAL(str::to_string(-1), "-1");
    BOOST_CHECK_EQUAL(str::to_string(0), "0");
    BOOST_CHECK_EQUAL(str::to_string(size_t(123)), "123");

    // floating point prints without a trailing dot
    BOOST_CHECK_EQUAL(str::to_string(3.5), "3.5");
    BOOST_CHECK_EQUAL(str::to_string(1.0), "1");
    BOOST_CHECK_EQUAL(str::to_string(0.5f), "0.5");

    BOOST_CHECK_EQUAL(str::to_string("hello"), "hello");
    BOOST_CHECK_EQUAL(str::to_string(std::string("hello")), "hello");
    BOOST_CHECK_EQUAL(str::to_string(std::string_view("hello")), "hello");

    // a single char becomes a one-character string, not an integer
    BOOST_CHECK_EQUAL(str::to_string('x'), "x");
    BOOST_CHECK_EQUAL(str::to_string('0'), "0");
    BOOST_CHECK_EQUAL(str::to_string(char(0)).size(), 1u);

    // wide input is converted to UTF-8
    BOOST_CHECK_EQUAL(str::to_string(L"wide"), "wide");
    BOOST_CHECK_EQUAL(str::to_string(std::wstring(L"wide")), "wide");
    BOOST_CHECK_EQUAL(str::to_string(std::wstring_view(L"wide")), "wide");
    BOOST_CHECK_EQUAL(str::to_string(L'x'), "x");

    // paths come out with native separators
    {
        auto actual = str::to_string(fs::path("a/b"));
#ifdef _WIN32
        BOOST_CHECK_EQUAL(actual, "a\\b");
#else
        BOOST_CHECK_EQUAL(actual, "a/b");
#endif
    }
}

BOOST_AUTO_TEST_CASE(test_format) {
    {
        std::string actual = formatN("%1 %2 %3 %2 %1", "alice", "bob", "cindy");
        std::string expect = "alice bob cindy bob alice";
        BOOST_CHECK(actual == expect);
    }

    {
        std::string actual = formatN("%% %1 %5 %2 %X %", "foo", "bar");
        std::string expect = "% foo %5 bar %X %";
        BOOST_CHECK(actual == expect);
    }

    {
        std::string actual = formatN("%10 %12", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
        std::string expect = "10 12";
        BOOST_CHECK(actual == expect);
    }

    // no placeholders, no arguments
    BOOST_CHECK_EQUAL(formatN("plain"), "plain");
    BOOST_CHECK_EQUAL(formatN(""), "");
    BOOST_CHECK_EQUAL(formatN("", "unused"), "");

    // adjacent and repeated placeholders
    BOOST_CHECK_EQUAL(formatN("%1%2", "a", "b"), "ab");
    BOOST_CHECK_EQUAL(formatN("%1%1%1", "x"), "xxx");
    BOOST_CHECK_EQUAL(formatN("[%1]", "x"), "[x]");

    // out-of-range and malformed indices are left as written
    BOOST_CHECK_EQUAL(formatN("%9", "a"), "%9");
    BOOST_CHECK_EQUAL(formatN("%0", "a"), "%0"); // indices start at 1
    BOOST_CHECK_EQUAL(formatN("%", "a"), "%");
    BOOST_CHECK_EQUAL(formatN("%a", "x"), "%a");

    // %% is an escaped percent
    BOOST_CHECK_EQUAL(formatN("100%%"), "100%%"); // no args: returned verbatim
    BOOST_CHECK_EQUAL(formatN("100%% %1", "done"), "100% done");

    // mixed argument types are converted through to_string()
    BOOST_CHECK_EQUAL(formatN("%1 %2 %3 %4", 1, true, 2.5, "s"), "1 true 2.5 s");
    BOOST_CHECK_EQUAL(formatN("%1%2%3", 'a', 'b', 'c'), "abc");
    BOOST_CHECK_EQUAL(formatN("%1 %2", 'x', L'y'), "x y");

    // an empty argument substitutes nothing
    BOOST_CHECK_EQUAL(formatN("[%1]", ""), "[]");

    // the underlying format() takes the arguments as a list
    BOOST_CHECK_EQUAL(str::format("%1-%2", {"a", "b"}), "a-b");
    BOOST_CHECK_EQUAL(str::format("%1", {}), "%1");
}

BOOST_AUTO_TEST_CASE(test_varexp) {
    const std::map<std::string, std::string> vars{
        {"FOO",   "Hello" },
        {"BAR",   "World" },
        {"EMPTY", ""      },
        {"A",     "X"     },
        {"B",     "Y"     },
        {"X_Y",   "nested"},
    };

    BOOST_CHECK_EQUAL(str::varexp("${FOO} ${BAR}!", vars), "Hello World!");
    BOOST_CHECK_EQUAL(str::varexp("${FOO}", vars), "Hello");
    BOOST_CHECK_EQUAL(str::varexp("a${FOO}b", vars), "aHellob");

    // nested expansion: the inner names are resolved first
    BOOST_CHECK_EQUAL(str::varexp("${${A}_${B}} World!", vars), "nested World!");

    // an unknown name expands to nothing, as does a name bound to the empty string
    BOOST_CHECK_EQUAL(str::varexp("[${NOPE}]", vars), "[]");
    BOOST_CHECK_EQUAL(str::varexp("[${EMPTY}]", vars), "[]");

    // text without variables passes through untouched
    BOOST_CHECK_EQUAL(str::varexp("no variables here", vars), "no variables here");
    BOOST_CHECK_EQUAL(str::varexp("", vars), "");
    BOOST_CHECK_EQUAL(str::varexp("100$", vars), "100$");
    BOOST_CHECK_EQUAL(str::varexp("a$b", vars), "a$b");

    // an unbalanced brace is rejected: the result is empty
    BOOST_CHECK_EQUAL(str::varexp("${FOO", vars), "");
    BOOST_CHECK_EQUAL(str::varexp("a ${ b", vars), "");

    // the callback form
    {
        auto find = [](const std::string_view &name) -> std::string {
            return std::string(name) + "!";
        };
        BOOST_CHECK_EQUAL(str::varexp("${a} ${b}", find), "a! b!");
    }
}

BOOST_AUTO_TEST_CASE(test_codec_convert) {
    {
        std::wstring actual = wstring_conv::from_utf8("HelloWorld");
        std::wstring expect = L"HelloWorld";
        BOOST_CHECK(actual == expect);
    }

    {
        std::string actual = wstring_conv::to_utf8(L"HelloWorld");
        std::string expect = "HelloWorld";
        BOOST_CHECK(actual == expect);
    }

    // the empty string round trips
    BOOST_CHECK(wstring_conv::from_utf8("").empty());
    BOOST_CHECK(wstring_conv::to_utf8(L"").empty());

    // explicit lengths stop early instead of running to the terminator
    BOOST_CHECK(wstring_conv::from_utf8("abcdef", 3) == L"abc");
    BOOST_CHECK(wstring_conv::to_utf8(L"abcdef", 3) == "abc");

    // non-ASCII round trip ("中文测试", spelled out in bytes so the source encoding
    // cannot affect the test)
    {
        const std::string utf8 = "\xE4\xB8\xAD\xE6\x96\x87\xE6\xB5\x8B\xE8\xAF\x95";
        auto wide = wstring_conv::from_utf8(utf8);
        BOOST_CHECK_EQUAL(wide.size(), 4u); // four code units on both UTF-16 and UTF-32
        BOOST_CHECK_EQUAL(wstring_conv::to_utf8(wide), utf8);
    }

    // text that is not valid UTF-8 gives an empty string rather than throwing or returning
    // something half converted
    BOOST_CHECK(wstring_conv::from_utf8("\x80").empty());          // continuation with no lead
    BOOST_CHECK(wstring_conv::from_utf8("ab\xE4\xB8", 4).empty()); // cut short at the end

    // and the same going the other way, where a lone surrogate is the invalid case UTF-16
    // wide platforms have
    if constexpr (sizeof(wchar_t) == 2) {
        const std::wstring lone(1, wchar_t(0xD800));
        BOOST_CHECK(wstring_conv::to_utf8(lone).empty());
    }

#ifdef _WIN32
    {
        std::wstring actual = wstring_conv::from_ansi("HelloWorld");
        std::wstring expect = L"HelloWorld";
        BOOST_CHECK(actual == expect);
    }

    {
        std::string actual = wstring_conv::to_ansi(L"HelloWorld");
        std::string expect = "HelloWorld";
        BOOST_CHECK(actual == expect);
    }
#endif
}

namespace {

    // vasprintf() can only be reached through a variadic function.
    std::string call_vasprintf(const char *fmt, ...) {
        va_list args;
        va_start(args, fmt);
        std::string res = str::vasprintf(fmt, args);
        va_end(args);
        return res;
    }

}

BOOST_AUTO_TEST_CASE(test_asprintf) {
    {
        std::string actual = asprintf("a=%d, b=%s, c=%p", 123, "hello", printf);
        std::string expect;
        expect.resize(100);
        size_t size = snprintf(&expect[0], expect.size(), "a=%d, b=%s, c=%p", 123, "hello", printf);
        expect.resize(size);
        BOOST_CHECK(actual == expect);
    }

    BOOST_CHECK_EQUAL(asprintf("no args"), "no args");
    BOOST_CHECK_EQUAL(asprintf(""), "");
    BOOST_CHECK_EQUAL(asprintf("%d%%", 50), "50%");
    BOOST_CHECK_EQUAL(asprintf("%5d|", 42), "   42|");
    BOOST_CHECK_EQUAL(asprintf("%.2f", 3.14159), "3.14");

    // a result well past any small internal buffer
    {
        std::string long_arg(4096, 'x');
        std::string actual = asprintf("[%s]", long_arg.c_str());
        BOOST_CHECK_EQUAL(actual.size(), long_arg.size() + 2);
        BOOST_CHECK_EQUAL(actual.front(), '[');
        BOOST_CHECK_EQUAL(actual.back(), ']');
        BOOST_CHECK_EQUAL(actual.substr(1, long_arg.size()), long_arg);
    }

    // vasprintf() is the same formatting, taking an assembled va_list
    BOOST_CHECK_EQUAL(call_vasprintf("a=%d, b=%s", 7, "x"), "a=7, b=x");
    BOOST_CHECK_EQUAL(call_vasprintf("plain"), "plain");
}

#ifdef _WIN32
// The category the registry and the process code build their error codes with. It exists so a
// Windows message arrives as UTF-8 rather than in the process code page, and it has to keep
// comparing equal to the system category or every existing check against std::errc breaks.
BOOST_AUTO_TEST_CASE(test_the_utf8_error_category) {
    const auto &category = windows_utf8_category();
    BOOST_CHECK_EQUAL(std::string(category.name()), "system_utf8");

    // A message, in UTF-8. Which text Windows gives depends on the system language, so what is
    // checked is that there is one and that it is not the raw number.
    std::error_code ec(ERROR_FILE_NOT_FOUND, category);
    BOOST_CHECK(!ec.message().empty());
    BOOST_CHECK(ec.message() != std::to_string(ERROR_FILE_NOT_FOUND));

    // It answers the same conditions the system category does, so code written against
    // std::errc keeps working on an error that came from here.
    BOOST_CHECK(ec == std::errc::no_such_file_or_directory);
    BOOST_CHECK_EQUAL(ec.default_error_condition().value(),
                      std::error_code(ERROR_FILE_NOT_FOUND, std::system_category())
                          .default_error_condition()
                          .value());

    // The same object every time, since an error_code holds a reference to it.
    BOOST_CHECK_EQUAL(&category, &windows_utf8_category());
    BOOST_CHECK(ec.category() == category);
}
#endif

BOOST_AUTO_TEST_SUITE_END()

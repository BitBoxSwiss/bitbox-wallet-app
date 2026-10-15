// SPDX-License-Identifier: MIT

#include <stdcorelib/path.h>

#include <stdcorelib/system.h>

#include <boost/test/unit_test.hpp>

namespace fs = std::filesystem;

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_path)

namespace {

    // clean_path() builds the result with native separators. Compare in generic form so the
    // expectations read the same on every platform.
    std::string cleaned(const std::string &s) {
        return path::clean_path(fs::path(s)).generic_string();
    }

}

BOOST_AUTO_TEST_CASE(test_clean_path) {
    // "." is dropped
    BOOST_CHECK_EQUAL(cleaned("a/./b"), "a/b");
    BOOST_CHECK_EQUAL(cleaned("./a"), "a");
    BOOST_CHECK_EQUAL(cleaned("a/."), "a");
    BOOST_CHECK_EQUAL(cleaned("./././a"), "a");

    // ".." cancels the preceding component
    BOOST_CHECK_EQUAL(cleaned("a/b/.."), "a");
    BOOST_CHECK_EQUAL(cleaned("a/b/../c"), "a/c");
    BOOST_CHECK_EQUAL(cleaned("a/b/c/../.."), "a");
    BOOST_CHECK_EQUAL(cleaned("a/./b/../c"), "a/c");

    // a leading ".." has nothing to cancel and is kept
    BOOST_CHECK_EQUAL(cleaned("../a"), "../a");
    BOOST_CHECK_EQUAL(cleaned("../../a"), "../../a");
    BOOST_CHECK_EQUAL(cleaned("a/../.."), "..");

    // nothing to do
    BOOST_CHECK_EQUAL(cleaned("a/b/c"), "a/b/c");
    BOOST_CHECK_EQUAL(cleaned(""), "");

    // absolute paths keep their root
    BOOST_CHECK_EQUAL(cleaned("/a/b/../c"), "/a/c");
#ifdef _WIN32
    BOOST_CHECK_EQUAL(cleaned("C:/a/../b"), "C:/b");
#endif
}

BOOST_AUTO_TEST_CASE(test_normalize_separators) {
    // backslashes always fold to '/' when native is not requested
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a\\b\\c")), "a/b/c");
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a/b/c")), "a/b/c");
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a\\b/c")), "a/b/c");

#ifdef _WIN32
    // native uses the platform separator
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a/b/c"), true), "a\\b\\c");
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a\\b\\c"), true), "a\\b\\c");
#else
    // on POSIX there is only one separator, so `native` changes nothing
    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("a/b/c"), true), "a/b/c");
#endif

    BOOST_CHECK_EQUAL(path::normalize_separators(fs::path("")), "");

    // the free function in namespace stdc is the same one
    BOOST_CHECK_EQUAL(normalize_separators(fs::path("a\\b")), "a/b");
}

BOOST_AUTO_TEST_CASE(test_utf8_conversion) {
    // ASCII round trip
    {
        auto p = path::from_utf8("a/b/c.txt");
        BOOST_CHECK_EQUAL(path::to_utf8(p), "a/b/c.txt");
    }

    // non-ASCII round trip ("测试/文件.txt", spelled out in bytes so the source encoding
    // cannot affect the test)
    {
        const std::string original = "\xE6\xB5\x8B\xE8\xAF\x95/\xE6\x96\x87\xE4\xBB\xB6.txt";
        auto p = path::from_utf8(original);
        BOOST_CHECK_EQUAL(path::to_utf8(p), original);
    }

    // the string_type overload agrees with the path one
    {
        auto p = path::from_utf8("hello.txt");
        BOOST_CHECK_EQUAL(path::to_utf8(p.native()), path::to_utf8(p));
    }

    BOOST_CHECK_EQUAL(path::to_utf8(fs::path()), "");
}

BOOST_AUTO_TEST_CASE(test_canonical) {
    // a path that exists resolves to an absolute, existing path
    {
        auto dir = system::application_directory();
        auto c = path::canonical(dir);
        BOOST_CHECK(!c.empty());
        BOOST_CHECK(c.is_absolute());
        BOOST_CHECK(fs::exists(c));
    }

    // "." resolves relative to the current directory
    {
        auto c = path::canonical(fs::path("."));
        BOOST_CHECK(!c.empty());
        BOOST_CHECK(fs::exists(c));
    }

    // a missing path reports failure by returning empty instead of throwing
    {
        auto c = path::canonical(fs::path("no_such_dir_9f3a/no_such_file_9f3a.txt"));
        BOOST_CHECK(c.empty());
    }
}

BOOST_AUTO_TEST_SUITE_END()

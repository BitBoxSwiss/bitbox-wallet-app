// SPDX-License-Identifier: MIT

#include <stdcorelib/system.h>

#include <stdcorelib/path.h>

#include <boost/test/unit_test.hpp>

namespace fs = std::filesystem;

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_system)

BOOST_AUTO_TEST_CASE(test_application_path) {
    auto exe = system::application_path();

    BOOST_CHECK(!exe.empty());
    BOOST_CHECK(exe.is_absolute());
    BOOST_CHECK(fs::exists(exe));
    BOOST_CHECK(fs::is_regular_file(exe));

    // the pieces agree with the whole
    BOOST_CHECK(system::application_directory() == exe.parent_path());
    BOOST_CHECK(system::application_filename() == exe.filename());
    BOOST_CHECK(fs::is_directory(system::application_directory()));

    // cached: repeated calls give the same answer
    BOOST_CHECK(system::application_path() == exe);
}

BOOST_AUTO_TEST_CASE(test_application_name) {
    auto name = system::application_name();
    auto filename = path::to_utf8(system::application_filename());

    BOOST_CHECK(!name.empty());

    // the name is the filename with the executable suffix taken off
    BOOST_CHECK(str::starts_with(filename, name));
#ifdef _WIN32
    if (str::ends_with(filename, ".exe", true)) {
        BOOST_CHECK_EQUAL(name + ".exe", filename);
    } else {
        BOOST_CHECK_EQUAL(name, filename);
    }
#else
    BOOST_CHECK_EQUAL(name, filename);
#endif
}

BOOST_AUTO_TEST_CASE(test_command_line_arguments) {
    auto args = system::command_line_arguments();

    BOOST_REQUIRE(!args.empty());
    BOOST_CHECK(!args[0].empty());

    // argv[0] names this executable
    auto arg0 = fs::path(path::from_utf8(args[0])).filename();
    BOOST_CHECK(arg0 == system::application_filename());

    // cached: the view refers to the same storage every time
    auto again = system::command_line_arguments();
    BOOST_CHECK_EQUAL(again.size(), args.size());
    BOOST_CHECK_EQUAL(again.data(), args.data());
}

BOOST_AUTO_TEST_CASE(test_split_command_line) {
    // plain words split on whitespace, runs of it collapse
    {
        auto args = system::split_command_line("a b c");
        BOOST_REQUIRE_EQUAL(args.size(), 3u);
        BOOST_CHECK_EQUAL(args[0], "a");
        BOOST_CHECK_EQUAL(args[1], "b");
        BOOST_CHECK_EQUAL(args[2], "c");
    }
    {
        auto args = system::split_command_line("  a \t\t b  ");
        BOOST_REQUIRE_EQUAL(args.size(), 2u);
        BOOST_CHECK_EQUAL(args[0], "a");
        BOOST_CHECK_EQUAL(args[1], "b");
    }

    // double quotes group a token
    {
        auto args = system::split_command_line(R"(a "b c" d)");
        BOOST_REQUIRE_EQUAL(args.size(), 3u);
        BOOST_CHECK_EQUAL(args[0], "a");
        BOOST_CHECK_EQUAL(args[1], "b c");
        BOOST_CHECK_EQUAL(args[2], "d");
    }

    // three consecutive quotes stand for a literal quote
    {
        auto args = system::split_command_line(R"(""")");
        BOOST_REQUIRE_EQUAL(args.size(), 1u);
        BOOST_CHECK_EQUAL(args[0], "\"");
    }
    {
        auto args = system::split_command_line(R"("a """b""" c")");
        BOOST_REQUIRE_EQUAL(args.size(), 1u);
        BOOST_CHECK_EQUAL(args[0], "a \"b\" c");
    }

    // a quoted empty token produces nothing, as does an empty command line
    BOOST_CHECK(system::split_command_line("").empty());
    BOOST_CHECK(system::split_command_line("   ").empty());

    // paths with spaces are the reason quoting exists
    {
        auto args = system::split_command_line(R"("C:\Program Files\app.exe" --flag)");
        BOOST_REQUIRE_EQUAL(args.size(), 2u);
        BOOST_CHECK_EQUAL(args[0], R"(C:\Program Files\app.exe)");
        BOOST_CHECK_EQUAL(args[1], "--flag");
    }

    // A path outside ASCII, which every case above is missing. The bytes of one are negative
    // wherever char is signed, and handing such a byte to the C library's isspace() ended the
    // process under MSVC's debug runtime rather than answering.
    {
        auto args = system::split_command_line("app \xE4\xB8\xAD\xE6\x96\x87.txt --flag");
        BOOST_REQUIRE_EQUAL(args.size(), 3u);
        BOOST_CHECK_EQUAL(args[0], "app");
        BOOST_CHECK_EQUAL(args[1], "\xE4\xB8\xAD\xE6\x96\x87.txt");
        BOOST_CHECK_EQUAL(args[2], "--flag");
    }
    {
        // the same bytes inside quotes, where the space must not split the token
        auto args = system::split_command_line("\"\xE4\xB8\xAD \xE6\x96\x87.txt\" --flag");
        BOOST_REQUIRE_EQUAL(args.size(), 2u);
        BOOST_CHECK_EQUAL(args[0], "\xE4\xB8\xAD \xE6\x96\x87.txt");
        BOOST_CHECK_EQUAL(args[1], "--flag");
    }
}

BOOST_AUTO_TEST_CASE(test_join_command_line) {
    // arguments without whitespace are emitted as-is
    BOOST_CHECK_EQUAL(system::join_command_line({"a", "b", "c"}), "a b c");
    BOOST_CHECK_EQUAL(system::join_command_line({"solo"}), "solo");
    BOOST_CHECK_EQUAL(system::join_command_line({}), "");

    // whitespace forces quoting
    BOOST_CHECK_EQUAL(system::join_command_line({"a", "b c"}), R"(a "b c")");
    BOOST_CHECK_EQUAL(system::join_command_line({"a\tb"}), "\"a\tb\"");

    // a quote inside a quoted argument is tripled
    BOOST_CHECK_EQUAL(system::join_command_line({R"(a "b" c)"}), R"("a """b""" c")");
}

BOOST_AUTO_TEST_CASE(test_command_line_round_trip) {
    const std::vector<std::vector<std::string>> cases = {
        {"a", "b", "c"},
        {"one"},
        {"a", "b c"},
        {R"(C:\Program Files\app.exe)", "--flag", "value with spaces"},
        {"a \"quoted\" word", "plain"},
    };

    for (const auto &args : cases) {
        auto line = system::join_command_line(args);
        auto parsed = system::split_command_line(line);
        BOOST_CHECK_MESSAGE(parsed == args, "round trip failed for: " + line);
    }
}

BOOST_AUTO_TEST_CASE(test_command_line_fits) {
    BOOST_CHECK(system::command_line_fits({}));
    BOOST_CHECK(system::command_line_fits({"program", "short"}));

    // One argument past what either platform takes. Windows counts the whole line against
    // 32767 characters and Linux refuses any single argument of 128 KiB whatever the total is.
    BOOST_CHECK(!system::command_line_fits({"program", std::string(1 << 20, 'a')}));

    // Or many arguments that add up to too much.
    std::vector<std::string> args = {"program"};
    args.insert(args.end(), 8000, std::string(64, 'a'));
    BOOST_CHECK(!system::command_line_fits(args));
}

// This was declared static in the header, which gave it internal linkage and left every caller
// with a link error against a definition that was right there in the library.
BOOST_AUTO_TEST_CASE(test_environment) {
    auto env = system::environment();
    BOOST_REQUIRE(!env.empty());

    // PATH is the one variable every platform this builds on defines
    auto it = env.find("PATH");
    if (it == env.end()) {
        it = env.find("Path"); // Windows keeps the name in whatever case it was given
    }
    BOOST_REQUIRE(it != env.end());
    BOOST_CHECK(!it->second.empty());

    // The separator never ends up inside a name, except at the front: cmd.exe keeps the current
    // directory of each drive in variables called =C:, =D: and so on, which the parser allows on
    // purpose by starting its search one character in.
    for (const auto &pair : env) {
        BOOST_CHECK(!pair.first.empty());
        BOOST_CHECK_MESSAGE(pair.first.find('=', 1) == std::string::npos, pair.first);
    }
}

BOOST_AUTO_TEST_SUITE_END()

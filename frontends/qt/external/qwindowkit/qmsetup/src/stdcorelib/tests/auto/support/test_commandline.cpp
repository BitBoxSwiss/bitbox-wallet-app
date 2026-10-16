// SPDX-License-Identifier: MIT

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <limits>
#include <optional>
#include <string>
#include <type_traits>
#include <vector>

#include <stdcorelib/console.h>
#include <stdcorelib/path.h>
#include <stdcorelib/support/commandline.h>

// Private header: the small checks that make up whole-tree validation are shared with their
// focused tests but are not API of their own.
#include "support/commandline_p.h"

#include <boost/test/unit_test.hpp>

// For the one case that reads back what showError() put on stderr.
#ifdef _WIN32
#  include <io.h>
#  define STDC_TEST_DUP    _dup
#  define STDC_TEST_DUP2   _dup2
#  define STDC_TEST_CLOSE  _close
#  define STDC_TEST_FILENO _fileno
#else
#  include <unistd.h>
#  define STDC_TEST_DUP    dup
#  define STDC_TEST_DUP2   dup2
#  define STDC_TEST_CLOSE  close
#  define STDC_TEST_FILENO fileno
#endif

using namespace stdc::cli;

// What is in here, in order. Each line is the heading of a section below, spelled the same way,
// so searching for one lands on it. No line numbers: they would be wrong by the next commit.
//
//     Reading a token back as a type
//     The builders
//     Parsing
//     Edges, taken from what CLI11, argparse and argtable3 test their own parsers with
//     The help text
//     Shapes a whole program asks for
//     Degenerate trees and misuse
//     What a whole program does, from argv to a handler
//     When it goes wrong: corrections and what is printed
//     Wrapping, and the width to wrap to
//     A subcommand, and what it inherited
//     The layout: which blocks, in what order
//     The formatter: overriding a rung of the ladder
//     Whether a tree may be built that way at all
//     Reuse, ownership and what outlives what

namespace {

    /// The value a case says has to be there. Reading an empty optional would be undefined,
    /// so a case that loses one says which assertion lost it rather than walking off an end.
    template <class T>
    T must(const std::optional<T> &value) {
        BOOST_REQUIRE_MESSAGE(value.has_value(), "expected a value, got nothing");
        return *value;
    }

    /// Reads \a token as a \c T, saying whether it could be read at all.
    template <class T>
    bool reads(std::string_view token, T *out) {
        return value_traits<T>::parse(token, out);
    }

    /// Reads \a token as a \c T that is expected to succeed, for the cases where only the value
    /// is interesting.
    template <class T>
    T read(std::string_view token) {
        T out{};
        BOOST_REQUIRE_MESSAGE(reads(token, &out), "could not read \"" << token << "\"");
        return out;
    }

    struct Fraction {
        int numerator = 0;
        int denominator = 1;
    };

}

/// A type of the caller's own, to check that the customization point is reachable from outside
/// the library and that a type carrying its own syntax works.
template <>
struct stdc::cli::value_traits<Fraction> {
    static bool parse(std::string_view token, Fraction *out) {
        auto slash = token.find('/');
        if (slash == std::string_view::npos) {
            return false;
        }
        return value_traits<int>::parse(token.substr(0, slash), &out->numerator) &&
               value_traits<int>::parse(token.substr(slash + 1), &out->denominator);
    }
    static const char *type_name() {
        return "fraction";
    }
};

BOOST_AUTO_TEST_SUITE(test_commandline)

// ---------------------------------------------------------------------------------------------
// Reading a token back as a type
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_string_takes_anything) {
    BOOST_CHECK_EQUAL(read<std::string>(""), "");
    BOOST_CHECK_EQUAL(read<std::string>("--not-an-option"), "--not-an-option");
    BOOST_CHECK_EQUAL(read<std::string>(" spaces kept "), " spaces kept ");

    // The view alternative sees the same bytes rather than a copy.
    std::string_view token = "borrowed";
    std::string_view view;
    BOOST_REQUIRE(reads(token, &view));
    BOOST_CHECK(view.data() == token.data());
}

BOOST_AUTO_TEST_CASE(test_integers) {
    BOOST_CHECK_EQUAL(read<int>("0"), 0);
    BOOST_CHECK_EQUAL(read<int>("42"), 42);
    BOOST_CHECK_EQUAL(read<int>("-42"), -42);
    BOOST_CHECK_EQUAL(read<int>("+42"), 42);

    int out;
    // A number has to be the whole token. Half of one is not a number.
    BOOST_CHECK(!reads("12abc", &out));
    BOOST_CHECK(!reads("", &out));
    BOOST_CHECK(!reads(" 12", &out));
    BOOST_CHECK(!reads("12 ", &out));
    BOOST_CHECK(!reads("1.5", &out));
    BOOST_CHECK(!reads("0x10", &out));
    BOOST_CHECK(!reads("--", &out));
}

BOOST_AUTO_TEST_CASE(test_integer_range_belongs_to_the_target_type) {
    // The check is the range of the type asked for, not of int64_t, so a value that fits nothing
    // narrower is refused where a narrower type was wanted.
    BOOST_CHECK_EQUAL(read<uint8_t>("255"), 255);
    uint8_t small;
    BOOST_CHECK(!reads("256", &small));

    BOOST_CHECK_EQUAL(read<int8_t>("-128"), -128);
    int8_t signed_small;
    BOOST_CHECK(!reads("-129", &signed_small));

    BOOST_CHECK_EQUAL(read<int64_t>("9223372036854775807"), INT64_MAX);
    int64_t big;
    BOOST_CHECK(!reads("9223372036854775808", &big));

    BOOST_CHECK_EQUAL(read<uint64_t>("18446744073709551615"), UINT64_MAX);
}

// This one pins a promise of the standard library rather than of the code above it: from_chars
// into an unsigned rejects a minus by itself, on all three of MSVC, libstdc++ and libc++, so
// nothing here refuses one by hand. If that ever stops being true, this is where it shows.
BOOST_AUTO_TEST_CASE(test_negative_is_not_an_unsigned) {
    unsigned out;
    BOOST_CHECK(!reads("-1", &out));
    BOOST_CHECK(!reads("-0", &out));
    BOOST_CHECK(!reads("-", &out));

    // A plus is refused by from_chars too, and is dropped before it gets there.
    BOOST_CHECK_EQUAL(read<unsigned>("+7"), 7u);
}

BOOST_AUTO_TEST_CASE(test_floating_point) {
    BOOST_CHECK_CLOSE(read<double>("1.5"), 1.5, 1e-9);
    BOOST_CHECK_CLOSE(read<double>("-2"), -2.0, 1e-9);
    BOOST_CHECK_CLOSE(read<double>("1e3"), 1000.0, 1e-9);
    BOOST_CHECK_CLOSE(read<float>("0.25"), 0.25f, 1e-6f);

    double out;
    BOOST_CHECK(!reads("1.5.5", &out));
    BOOST_CHECK(!reads("", &out));
    BOOST_CHECK(!reads("abc", &out));
    BOOST_CHECK(!reads("1.5x", &out));
    // Beyond what a double can hold, rather than silently infinite.
    BOOST_CHECK(!reads("1e400", &out));

    // The range belongs to the type asked for. Going through double first accepted this and
    // narrowed it to infinity.
    float narrow;
    BOOST_CHECK(!reads("1e39", &narrow));

    // A platform whose long double is wider than double must not lose that range by going
    // through double. MSVC and Apple arm64 make the two types alike, so there is no wider value
    // to ask for there.
    if constexpr (std::numeric_limits<long double>::max_exponent10 >
                  std::numeric_limits<double>::max_exponent10) {
        long double wide;
        BOOST_REQUIRE(reads("1e400", &wide));
        BOOST_CHECK(std::isfinite(wide));
    }
}

BOOST_AUTO_TEST_CASE(test_booleans_spell_themselves_several_ways) {
    for (auto token : {"true", "TRUE", "True", "yes", "on", "1"}) {
        BOOST_CHECK_MESSAGE(read<bool>(token), token);
    }
    for (auto token : {"false", "FALSE", "no", "off", "0"}) {
        BOOST_CHECK_MESSAGE(!read<bool>(token), token);
    }

    bool out;
    BOOST_CHECK(!reads("", &out));
    BOOST_CHECK(!reads("2", &out));
    BOOST_CHECK(!reads("maybe", &out));
}

BOOST_AUTO_TEST_CASE(test_a_caller_can_add_a_type) {
    auto half = read<Fraction>("1/2");
    BOOST_CHECK_EQUAL(half.numerator, 1);
    BOOST_CHECK_EQUAL(half.denominator, 2);

    Fraction out;
    BOOST_CHECK(!reads("1", &out));
    BOOST_CHECK(!reads("1/x", &out));

    BOOST_CHECK_EQUAL(std::string(value_traits<Fraction>::type_name()), "fraction");
}

BOOST_AUTO_TEST_CASE(test_type_info_carries_the_check_without_a_template) {
    // What Argument stores, so that it can hold a type without becoming one.
    auto info = detail::type_info_for<int>();
    BOOST_REQUIRE(info.check != nullptr);
    BOOST_CHECK(info.check("42"));
    BOOST_CHECK(!info.check("x"));
    BOOST_CHECK_EQUAL(std::string(info.name), "int");

    auto text = detail::type_info_for<std::string>();
    BOOST_CHECK(text.check("anything at all"));
}

// ---------------------------------------------------------------------------------------------
// The builders
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_argument_defaults) {
    Argument arg("file", "The file to read");
    BOOST_CHECK_EQUAL(arg.name(), "file");
    BOOST_CHECK_EQUAL(arg.description(), "The file to read");
    BOOST_CHECK(arg.isRequired());
    BOOST_CHECK(arg.arity() == Argument::Single);
    BOOST_CHECK(!arg.hasDefaultValue());
    BOOST_CHECK(arg.expectedValues().empty());
    BOOST_CHECK(!arg.validator());
    // No type asked for means no check, which is what lets an argument take anything.
    BOOST_CHECK(arg.typeInfo().check == nullptr);
    // Without a metavar the name is what shows.
    BOOST_CHECK_EQUAL(arg.displayName(), "file");
}

BOOST_AUTO_TEST_CASE(test_argument_setters_chain) {
    auto arg = Argument("count", "How many").metavar("N").optional().defaultValue("1").type<int>();

    BOOST_CHECK_EQUAL(arg.displayName(), "N");
    BOOST_CHECK(!arg.isRequired());
    BOOST_REQUIRE(arg.hasDefaultValue());
    BOOST_CHECK_EQUAL(arg.defaultValue(), "1");

    BOOST_REQUIRE(arg.typeInfo().check != nullptr);
    BOOST_CHECK(arg.typeInfo().check("7"));
    BOOST_CHECK(!arg.typeInfo().check("seven"));
    BOOST_CHECK_EQUAL(std::string(arg.typeInfo().name), "int");
}

BOOST_AUTO_TEST_CASE(test_argument_arity) {
    BOOST_CHECK(Argument("x").arity() == Argument::Single);
    BOOST_CHECK(Argument("x").multi().arity() == Argument::Multiple);
    BOOST_CHECK(Argument("x").multi(false).arity() == Argument::Single);
    BOOST_CHECK(Argument("x").nargs(Argument::Remainder).arity() == Argument::Remainder);
}

BOOST_AUTO_TEST_CASE(test_argument_carries_a_validator_and_a_set_of_words) {
    auto arg = Argument("mode")
                   .expect({"fast", "slow"})
                   .validate([](std::string_view token, std::string *error) {
                       if (token == "slow") {
                           *error = "too slow";
                           return false;
                       }
                       return true;
                   });

    BOOST_CHECK(arg.expectedValues() == std::vector<std::string>({"fast", "slow"}));

    std::string error;
    BOOST_REQUIRE(arg.validator());
    BOOST_CHECK(arg.validator()("fast", &error));
    BOOST_CHECK(error.empty());
    BOOST_CHECK(!arg.validator()("slow", &error));
    BOOST_CHECK_EQUAL(error, "too slow");
}

BOOST_AUTO_TEST_CASE(test_option_is_built_several_ways) {
    Option from_list({"-f", "--force"}, "Force it");
    BOOST_CHECK(from_list.tokens() == std::vector<std::string>({"-f", "--force"}));
    BOOST_CHECK_EQUAL(from_list.token(), "-f");
    BOOST_CHECK_EQUAL(from_list.description(), "Force it");

    Option from_one("--force");
    BOOST_CHECK(from_one.tokens() == std::vector<std::string>({"--force"}));

    Option from_vector(std::vector<std::string>{"-e", "--exclude"});
    BOOST_CHECK_EQUAL(from_vector.tokens().size(), 2u);

    // Defaults, so that what a bare option means is written down somewhere.
    BOOST_CHECK(!from_list.isRequired());
    BOOST_CHECK(!from_list.isRecursive());
    BOOST_CHECK(from_list.role() == Option::NoRole);
    BOOST_CHECK(from_list.prior() == Option::NoPrior);
    BOOST_CHECK(from_list.shortMatch() == Option::NoShortMatch);
    BOOST_CHECK_EQUAL(from_list.maxOccurrence(), 1);
    BOOST_CHECK(from_list.arguments().empty());
}

BOOST_AUTO_TEST_CASE(test_option_roles_bring_their_own_spelling) {
    Option help = Option::Help;
    BOOST_CHECK(help.role() == Option::Help);
    BOOST_CHECK(help.tokens() == std::vector<std::string>({"-h", "--help"}));

    BOOST_CHECK(Option(Option::Version).tokens() == std::vector<std::string>({"-v", "--version"}));
    BOOST_CHECK_EQUAL(Option(Option::Version).description(), "Show the version and exit");

    // Naming the tokens keeps the role and drops the usual spelling.
    Option renamed(Option::Help, {"--usage"}, "Print usage");
    BOOST_CHECK(renamed.role() == Option::Help);
    BOOST_CHECK(renamed.tokens() == std::vector<std::string>({"--usage"}));
    BOOST_CHECK_EQUAL(renamed.description(), "Print usage");

    // A role with no spelling of its own gets none.
    BOOST_CHECK(Option(Option::NoRole).tokens().empty());
}

BOOST_AUTO_TEST_CASE(test_option_setters_chain) {
    auto opt = Option({"-D", "--define"}, "Define a variable")
                   .arg("expr")
                   .multi()
                   .shortMatch(Option::ShortMatchSingleChar)
                   .prior(Option::IgnoreMissingArguments)
                   .required()
                   .recursive();

    BOOST_REQUIRE_EQUAL(opt.arguments().size(), 1u);
    BOOST_CHECK_EQUAL(opt.arguments().front().name(), "expr");
    BOOST_CHECK(opt.arguments().front().isRequired());
    // An option's argument has the option's description to stand on and needs none of its own.
    BOOST_CHECK(opt.arguments().front().description().empty());

    BOOST_CHECK_EQUAL(opt.maxOccurrence(), 0);
    BOOST_CHECK(opt.shortMatch() == Option::ShortMatchSingleChar);
    BOOST_CHECK(opt.prior() == Option::IgnoreMissingArguments);
    BOOST_CHECK(opt.isRequired());
    BOOST_CHECK(opt.isRecursive());

    // An optional argument, and one built up on its own.
    auto with_optional = Option("-w").arg("file", false);
    BOOST_CHECK(!with_optional.arguments().front().isRequired());

    auto with_typed = Option("-n").arg(Argument("count").type<int>());
    BOOST_CHECK(with_typed.arguments().front().typeInfo().check("3"));
}

BOOST_AUTO_TEST_CASE(test_prior_is_a_ladder) {
    // The parser picks the highest level given rather than switching on each, so the order these
    // are declared in is part of what they mean.
    BOOST_CHECK(Option::NoPrior < Option::IgnoreMissingArguments);
    BOOST_CHECK(Option::IgnoreMissingArguments < Option::IgnoreMissingSymbols);
    BOOST_CHECK(Option::IgnoreMissingSymbols < Option::AutoSetWhenNoSymbols);
    BOOST_CHECK(Option::AutoSetWhenNoSymbols < Option::ExclusiveToArguments);
    BOOST_CHECK(Option::ExclusiveToArguments < Option::ExclusiveToOptions);
    BOOST_CHECK(Option::ExclusiveToOptions < Option::ExclusiveToAll);
}

BOOST_AUTO_TEST_CASE(test_command_collects_what_it_is_given) {
    auto command = Command("copy", "Copy files")
                       .addArguments({
                           Argument("src", "Source").multi(),
                           Argument("dest", "Destination"),
                       })
                       .addOptions({
                           Option({"-e", "--exclude"}, "Exclude a pattern").arg("regex").multi(),
                           Option({"-f", "--force"}, "Force overwrite"),
                       })
                       .addOption({Option::Version})
                       .setHandler([](const ParseResult &) { return 7; });

    BOOST_CHECK_EQUAL(command.name(), "copy");
    BOOST_CHECK_EQUAL(command.description(), "Copy files");
    BOOST_REQUIRE_EQUAL(command.arguments().size(), 2u);
    BOOST_CHECK_EQUAL(command.arguments()[0].name(), "src");
    BOOST_CHECK(command.arguments()[0].arity() == Argument::Multiple);
    BOOST_REQUIRE_EQUAL(command.options().size(), 3u);
    BOOST_CHECK(command.options()[2].role() == Option::Version);
    BOOST_REQUIRE(command.handler());
}

BOOST_AUTO_TEST_CASE(test_command_addition_appends_rather_than_replaces) {
    // Called twice, which is how a program adds its common options after the specific ones.
    Command command("x");
    command.addOption(Option("-a")).addOptions({Option("-b"), Option("-c")});
    BOOST_CHECK_EQUAL(command.options().size(), 3u);

    command.addArgument(Argument("one")).addArguments({Argument("two")});
    BOOST_CHECK_EQUAL(command.arguments().size(), 2u);

    command.addCommand(Command("sub")).addCommands({Command("other")});
    BOOST_CHECK_EQUAL(command.commands().size(), 2u);
}

BOOST_AUTO_TEST_CASE(test_command_lookup) {
    auto command = Command("root")
                       .addOptions({Option({"-f", "--force"}), Option({"-e", "--exclude"})})
                       .addCommands({Command("copy"), Command("rmdir")});

    BOOST_REQUIRE(command.findCommand("copy") != nullptr);
    BOOST_CHECK_EQUAL(command.findCommand("copy")->name(), "copy");
    BOOST_CHECK(command.findCommand("nothing") == nullptr);

    // Any spelling finds it, not only the first.
    BOOST_REQUIRE(command.findOption("-f") != nullptr);
    BOOST_CHECK_EQUAL(command.findOption("--force")->token(), "-f");
    BOOST_CHECK_EQUAL(command.findOption("--exclude")->token(), "-e");
    BOOST_CHECK(command.findOption("-x") == nullptr);
    BOOST_CHECK(command.findOption("") == nullptr);

    // Lookup is one level down, not a search of the whole tree.
    auto nested = Command("outer").addCommand(Command("inner").addCommand(Command("deep")));
    BOOST_CHECK(nested.findCommand("inner") != nullptr);
    BOOST_CHECK(nested.findCommand("deep") == nullptr);
}

BOOST_AUTO_TEST_CASE(test_catalogue_groups_by_heading) {
    CommandCatalogue catalogue;
    BOOST_CHECK(catalogue.isEmpty());

    catalogue.addCommands("Filesystem Commands", {"copy", "rmdir", "touch"})
        .addCommands("Buildsystem Commands", {"configure", "deploy"})
        .addOptions("Common Options", {"-V"});

    BOOST_CHECK(!catalogue.isEmpty());
    BOOST_REQUIRE_EQUAL(catalogue.commandGroups().size(), 2u);
    // Declaration order is the order the headings appear in, so it is kept.
    BOOST_CHECK_EQUAL(catalogue.commandGroups()[0].name, "Filesystem Commands");
    BOOST_CHECK_EQUAL(catalogue.commandGroups()[0].members.size(), 3u);
    BOOST_CHECK_EQUAL(catalogue.commandGroups()[1].name, "Buildsystem Commands");
    BOOST_REQUIRE_EQUAL(catalogue.optionGroups().size(), 1u);
    BOOST_CHECK(catalogue.argumentGroups().empty());

    Command command("root");
    BOOST_CHECK(command.catalogue().isEmpty());
    command.setCatalogue(catalogue);
    BOOST_CHECK_EQUAL(command.catalogue().commandGroups().size(), 2u);
}

BOOST_AUTO_TEST_CASE(test_a_command_tree_copies_whole) {
    // These are values, so handing one around is a copy and not a share. Building a command in a
    // lambda and returning it, which is how a tree of any size gets built, has to work.
    auto make = [] {
        return Command("copy", "Copy files").addOption(Option("-f")).addArgument(Argument("src"));
    };
    Command original = make();
    Command copy = original;

    copy.addOption(Option("-g"));
    BOOST_CHECK_EQUAL(original.options().size(), 1u);
    BOOST_CHECK_EQUAL(copy.options().size(), 2u);
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

namespace {

    /// The program name the shell puts in front, which the parser is expected to step over.
    std::vector<std::string> argv(std::initializer_list<std::string> rest) {
        std::vector<std::string> res{"prog"};
        res.insert(res.end(), rest.begin(), rest.end());
        return res;
    }

    /// A parse that is expected to succeed, so that a failing one says why rather than blowing
    /// up somewhere further down.
    ParseResult ok(const Parser &parser, std::initializer_list<std::string> args,
                   Parser::ParseOptions flags = Parser::Standard) {
        auto result = parser.parse(argv(args), flags);
        BOOST_REQUIRE_MESSAGE(result.isValid(), result.errorText());
        return result;
    }

    ParseResult bad(const Parser &parser, std::initializer_list<std::string> args,
                    ParseResult::Error expected, Parser::ParseOptions flags = Parser::Standard) {
        auto result = parser.parse(argv(args), flags);
        BOOST_REQUIRE_MESSAGE(!result.isValid(), "expected a failure, got a clean parse");
        BOOST_CHECK_EQUAL(int(result.error()), int(expected));
        // Whatever went wrong, it has to be sayable.
        BOOST_CHECK_MESSAGE(!result.errorText().empty(), "the failure came with nothing to print");
        return result;
    }


    // showError() writes to stderr and showHelp() to stdout, so reading either back means
    // pointing that descriptor at a file for as long as it runs. A file is never a terminal, so
    // the console code resolves color to never and what lands is plain text, unless the caller
    // has forced a mode.
    template <class F>
    std::string captured(FILE *stream, const char *name, F &&body) {
        auto path = std::filesystem::temp_directory_path() / name;

        std::fflush(stream);
        int saved = STDC_TEST_DUP(STDC_TEST_FILENO(stream));
        BOOST_REQUIRE(saved >= 0);

        FILE *file = nullptr;
#ifdef _WIN32
        fopen_s(&file, path.string().c_str(), "wb");
#else
        file = std::fopen(path.string().c_str(), "wb");
#endif
        BOOST_REQUIRE(file != nullptr);

        STDC_TEST_DUP2(STDC_TEST_FILENO(file), STDC_TEST_FILENO(stream));
        body();
        std::fflush(stream);
        STDC_TEST_DUP2(saved, STDC_TEST_FILENO(stream));
        STDC_TEST_CLOSE(saved);
        std::fclose(file);

        std::ifstream in(path, std::ios::binary);
        std::string res((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
        in.close();
        std::error_code ec;
        std::filesystem::remove(path, ec);
        return res;
    }

    template <class F>
    std::string capturedStderr(F &&body) {
        return captured(stderr, "stdc_cli_stderr.txt", std::forward<F>(body));
    }

    template <class F>
    std::string capturedStdout(F &&body) {
        return captured(stdout, "stdc_cli_stdout.txt", std::forward<F>(body));
    }
}

BOOST_AUTO_TEST_CASE(test_parse_bare_command) {
    Parser parser(Command("prog", "A program"));
    auto result = ok(parser, {});
    BOOST_REQUIRE(result.command() != nullptr);
    BOOST_CHECK_EQUAL(result.command()->name(), "prog");
    BOOST_CHECK(result.commandPath() == std::vector<std::string>({"prog"}));
}

BOOST_AUTO_TEST_CASE(test_positional_arguments) {
    Parser parser(Command("prog").addArguments({Argument("src"), Argument("dest")}));

    auto result = ok(parser, {"a", "b"});
    BOOST_CHECK_EQUAL(must(result.value(0)), "a");
    BOOST_CHECK_EQUAL(must(result.value(1)), "b");

    // Reading past the end is nothing rather than a crash, which is what lets a caller read an
    // optional argument without asking first. Nothing rather than an empty string, so it does
    // not read as an argument that was given and happened to be empty.
    BOOST_CHECK(!result.value(2).has_value());
    BOOST_CHECK(!result.value(-1).has_value());

    bad(parser, {"a"}, ParseResult::MissingCommandArgument);
    bad(parser, {"a", "b", "c"}, ParseResult::TooManyArguments);
}

BOOST_AUTO_TEST_CASE(test_a_multi_argument_leaves_room_for_what_follows) {
    // copy <src>... <dest>, which only works if the greedy one stops one short.
    Parser parser(
        Parser(Command("prog").addArguments({Argument("src").multi(), Argument("dest")})));

    auto result = ok(parser, {"one", "two", "three", "out"});
    BOOST_CHECK(result.values(0) == std::vector<std::string>({"one", "two", "three"}));
    BOOST_CHECK_EQUAL(must(result.value(1)), "out");

    // Two tokens is one each.
    auto pair = ok(parser, {"one", "out"});
    BOOST_CHECK(pair.values(0) == std::vector<std::string>({"one"}));
    BOOST_CHECK_EQUAL(must(pair.value(1)), "out");

    bad(parser, {"only"}, ParseResult::MissingCommandArgument);
}

// The same shape as an option's own arguments, which is where it did not work. The rule is one
// rule and both ask for it, so a shape detail::arguments_can_follow() allows can be written
// arguments are declared rather than only after a command.
BOOST_AUTO_TEST_CASE(test_an_options_multi_argument_leaves_room_for_what_follows) {
    Parser parser(
        Command("prog")
            .addOption(
                Option({"--copy"}, "Copy").arg(Argument("src").multi()).arg(Argument("dest")))
            .addOption(Option({"-v"}, "Say more")));

    auto result = ok(parser, {"--copy", "one", "two", "three", "out"});
    auto handle = result.option("--copy");
    BOOST_REQUIRE(handle);
    BOOST_CHECK(must(handle->values<std::string>(0)) ==
                std::vector<std::string>({"one", "two", "three"}));
    BOOST_CHECK_EQUAL(must(handle->value<std::string>(1)), "out");

    // Two tokens is one each, the same as it is for a command's own.
    auto pair = ok(parser, {"--copy", "one", "out"});
    BOOST_REQUIRE(pair.option("--copy"));
    BOOST_CHECK(must(pair.option("--copy")->values<std::string>(0)) ==
                std::vector<std::string>({"one"}));
    BOOST_CHECK_EQUAL(must(pair.option("--copy")->value<std::string>(1)), "out");

    // One token leaves the destination with nothing, which is a missing value rather than a
    // greedy source that took it.
    bad(parser, {"--copy", "only"}, ParseResult::MissingOptionArgument);

    // The run ends where the next declared option starts, and what is left is shared out inside
    // that run rather than across the whole line.
    auto stopped = ok(parser, {"--copy", "one", "two", "-v"});
    BOOST_REQUIRE(stopped.option("--copy"));
    BOOST_CHECK(must(stopped.option("--copy")->values<std::string>(0)) ==
                std::vector<std::string>({"one"}));
    BOOST_CHECK_EQUAL(must(stopped.option("--copy")->value<std::string>(1)), "two");
    BOOST_CHECK(stopped.option("-v").has_value());
}

// A run stops at an option however the option was written. Asking whether a token is somebody's
// option went through a plain lookup while reading one accepted three spellings besides, so a
// run walked over --out=x and -Dfoo and took them for values of what it was reading.
BOOST_AUTO_TEST_CASE(test_a_run_stops_at_every_spelling_of_an_option) {
    Parser parser(
        Command("prog")
            .addOption(Option({"-c"}, "Copy").arg(Argument("src").multi()))
            .addOption(Option({"--out"}, "Where").arg("dir"))
            .addOption(Option({"-D"}, "Define").arg("macro").shortMatch(Option::ShortMatchAll))
            .addOption(Option({"-a"}, "A"))
            .addOption(Option({"-b"}, "B")));

    const std::vector<std::string> one{"x"};

    // Written out, which always worked, and then the three that did not.
    BOOST_CHECK(ok(parser, {"-c", "x", "--out", "d"}).option("-c")->values() == one);

    auto joined = ok(parser, {"-c", "x", "--out=d"});
    BOOST_CHECK(joined.option("-c")->values() == one);
    BOOST_CHECK_EQUAL(joined.valueForOption("--out").value_or(""), "d");

    auto stuck = ok(parser, {"-c", "x", "-Dfoo"});
    BOOST_CHECK(stuck.option("-c")->values() == one);
    BOOST_CHECK_EQUAL(stuck.valueForOption("-D").value_or(""), "foo");

    auto grouped = ok(parser, {"-c", "x", "-ab"}, Parser::AllowUnixGroupFlags);
    BOOST_CHECK(grouped.option("-c")->values() == one);
    BOOST_CHECK(grouped.option("-a").has_value());
    BOOST_CHECK(grouped.option("-b").has_value());

    // Grouping off, so -ab is nobody's option and is a value like any other word.
    BOOST_CHECK(ok(parser, {"-c", "x", "-ab"}).option("-c")->values() ==
                std::vector<std::string>({"x", "-ab"}));

    // The same option written twice, each occurrence reading its own run.
    Parser twice(
        Command("prog").addOption(Option({"-c"}, "Copy").arg(Argument("src").multi()).multi()));
    auto both = ok(twice, {"-c=a", "b", "-c=x", "y"});
    BOOST_CHECK_EQUAL(both.option("-c")->count(), 2);
    BOOST_CHECK(both.option("-c")->at(0).values() == std::vector<std::string>({"a", "b"}));
    BOOST_CHECK(both.option("-c")->at(1).values() == std::vector<std::string>({"x", "y"}));
}

// An option is to a command what an occurrence is to an option: the same four questions asked
// in the same four words. Reading an option without saying which occurrence reads the first,
// so its four are that occurrence's four and nothing else, and every occurrence at once is
// spelled apart. A greedy argument given twice had no reading at all before at().
BOOST_AUTO_TEST_CASE(test_each_occurrence_reads_the_way_a_command_does) {
    Parser parser(Command("prog").addOption(
        Option({"-c"}, "Copy").arg(Argument("src").multi()).arg("dest").multi()));
    // Held rather than taken off the temporary, which OptionResult warns about and means.
    auto result = ok(parser, {"-c", "a", "b", "d1", "-c", "x", "y", "d2"});
    auto given = result.option("-c");
    BOOST_REQUIRE(given.has_value());
    BOOST_CHECK_EQUAL(given->count(), 2);

    // Each occurrence, which is the reading that was missing.
    BOOST_CHECK(given->at(0).values(0) == std::vector<std::string>({"a", "b"}));
    BOOST_CHECK(given->at(1).values(0) == std::vector<std::string>({"x", "y"}));
    BOOST_CHECK_EQUAL(given->at(0).value(1).value_or(""), "d1");
    BOOST_CHECK_EQUAL(given->at(1).value(1).value_or(""), "d2");

    // The option's own four are the first occurrence's, to the letter.
    BOOST_CHECK(given->value(0) == given->at(0).value(0));
    BOOST_CHECK(given->values(0) == given->at(0).values(0));
    BOOST_CHECK(given->rawValue(1) == given->at(0).rawValue(1));
    BOOST_CHECK(given->rawValues(0) == given->at(0).rawValues(0));

    // And every occurrence at once is the other pair, which nothing else answers.
    BOOST_CHECK(given->allValues(0) == std::vector<std::string>({"a", "b", "x", "y"}));
    BOOST_CHECK(given->allValues(1) == std::vector<std::string>({"d1", "d2"}));

    // An index nobody declared still answers with nothing, which is the rule everywhere a
    // value is read. An occurrence nobody wrote is a different thing and is at()'s
    // precondition, so there is nothing to ask here about at(2) or at(-1).
    BOOST_CHECK(!given->at(0).value(9).has_value());
    BOOST_CHECK(given->at(1).values(9) == std::vector<std::string>());

    // The shape that tells the two readings apart: an argument that may be left out, left out
    // the first time and given the second. The option's own reads the first occurrence, which
    // has nothing, and only the all-prefixed one finds what was written.
    Parser maybe(Command("prog").addOption(Option({"-p"}, "Maybe").arg("v", false).multi()));
    auto twice = ok(maybe, {"-p", "-p", "x"});
    auto p = twice.option("-p");
    BOOST_REQUIRE(p.has_value());
    BOOST_CHECK_EQUAL(p->count(), 2);
    BOOST_CHECK(!p->at(0).value().has_value());
    BOOST_CHECK_EQUAL(p->at(1).value().value_or(""), "x");
    BOOST_CHECK(!p->value().has_value());
    BOOST_CHECK(p->values() == std::vector<std::string>());
    BOOST_CHECK(p->allValues() == std::vector<std::string>({"x"}));
}

BOOST_AUTO_TEST_CASE(test_remainder_takes_everything_left) {
    Parser parser(Command("prog").addArguments(
        {Argument("script"), Argument("args").nargs(Argument::Remainder).optional()}));

    auto result = ok(parser, {"run.sh", "one", "two"});
    BOOST_CHECK_EQUAL(must(result.value(0)), "run.sh");
    BOOST_CHECK(result.values(1) == std::vector<std::string>({"one", "two"}));
}

BOOST_AUTO_TEST_CASE(test_default_value_stands_in) {
    Parser parser(Command("prog").addArgument(
        Argument("level", "How loud", false).defaultValue("3").type<int>()));

    BOOST_CHECK_EQUAL(must(ok(parser, {}).value<int>(0)), 3);
    BOOST_CHECK_EQUAL(must(ok(parser, {"7"}).value<int>(0)), 7);
}

BOOST_AUTO_TEST_CASE(test_options_in_their_several_spellings) {
    Parser parser(
        Command("prog").addOptions({Option({"-f", "--force"}, "Force"),
                                    Option({"-o", "--out"}, "Where to write").arg("dir")}));

    BOOST_CHECK(ok(parser, {"-f"}).option("-f").has_value());
    // Any spelling is the same option, whichever was typed and whichever is asked for.
    BOOST_CHECK(ok(parser, {"--force"}).option("-f").has_value());
    BOOST_CHECK(ok(parser, {"-f"}).option("--force").has_value());
    BOOST_CHECK(!ok(parser, {}).option("-f").has_value());

    BOOST_CHECK_EQUAL(must(ok(parser, {"-o", "build"}).valueForOption("-o")), "build");
    BOOST_CHECK_EQUAL(must(ok(parser, {"--out=build"}).valueForOption("--out")), "build");

    bad(parser, {"-x"}, ParseResult::UnknownOption);
    bad(parser, {"-o"}, ParseResult::MissingOptionArgument);
    // An option that takes nothing cannot be given something.
    bad(parser, {"--force=yes"}, ParseResult::UnknownOption);
}

BOOST_AUTO_TEST_CASE(test_repeated_options) {
    Parser parser(Command("prog").addOptions({
        Option({"-e", "--exclude"}, "Exclude").arg("pattern").multi(),
        Option({"-f"}, "Force"),
    }));

    auto result = ok(parser, {"-e", "a", "-e", "b", "-e", "c"});
    BOOST_CHECK_EQUAL(result.option("-e")->count(), 3);
    BOOST_CHECK(result.option("-e")->allRawValues() ==
                std::vector<std::string_view>({"a", "b", "c"}));
    // Each occurrence is still reachable on its own, and the option's own four are the first
    // occurrence's rather than all three gathered.
    BOOST_CHECK_EQUAL(must(result.option("-e")->at(1).rawValue(0)), "b");
    BOOST_CHECK(result.option("-e")->rawValues() == std::vector<std::string_view>({"a"}));

    // One that did not say it repeats does not.
    bad(parser, {"-f", "-f"}, ParseResult::OptionOccurTooMuch);
}

BOOST_AUTO_TEST_CASE(test_short_match_joins_a_value_to_its_option) {
    Parser parser(Command("prog").addOptions({
        Option({"-D", "--define"}, "Define")
            .arg("expr")
            .multi()
            .shortMatch(Option::ShortMatchSingleChar),
        Option({"-p"}, "Plain").arg("value"),
    }));

    auto result = ok(parser, {"-DKEY=VALUE"});
    BOOST_CHECK_EQUAL(must(result.valueForOption("-D")), "KEY=VALUE");

    // Separately still works, and both forms mix.
    auto mixed = ok(parser, {"-D", "A=1", "-DB=2"});
    BOOST_CHECK(mixed.option("-D")->allRawValues() ==
                std::vector<std::string_view>({"A=1", "B=2"}));

    // An option that did not ask for short matching does not get it.
    bad(parser, {"-pvalue"}, ParseResult::UnknownOption);
}

BOOST_AUTO_TEST_CASE(test_short_match_rules_differ) {
    auto build = [](Option::ShortMatch rule) {
        return Parser(Command("prog").addOption(
            Option({"-1", "--one"}, "Numeric token").arg("value").shortMatch(rule)));
    };

    // A single letter means a letter, so an option spelled with a digit is not matched.
    BOOST_CHECK(!build(Option::ShortMatchSingleLetter).parse(argv({"-1x"})).isValid());
    // A single character does not care what the character is.
    BOOST_CHECK(build(Option::ShortMatchSingleChar).parse(argv({"-1x"})).isValid());

    // A longer token only matches under the rule that allows any length.
    Parser strict(Command("prog").addOption(
        Option({"--jobs"}, "How many").arg("n").shortMatch(Option::ShortMatchSingleChar)));
    BOOST_CHECK(!strict.parse(argv({"--jobs8"})).isValid());

    Parser loose(Command("prog").addOption(
        Option({"--jobs"}, "How many").arg("n").shortMatch(Option::ShortMatchAll)));
    BOOST_CHECK_EQUAL(must(ok(loose, {"--jobs8"}).valueForOption("--jobs")), "8");
}

BOOST_AUTO_TEST_CASE(test_grouped_short_flags) {
    Parser parser(Command("prog").addOptions({
        Option({"-a"}, "A"),
        Option({"-b"}, "B"),
        Option({"-c"}, "C").arg("value"),
    }));

    auto result = ok(parser, {"-ab"}, Parser::AllowUnixGroupFlags);
    BOOST_CHECK(result.option("-a").has_value());
    BOOST_CHECK(result.option("-b").has_value());

    // Off by default, so the same line is one unknown option.
    bad(parser, {"-ab"}, ParseResult::UnknownOption);

    // A letter that wants a value cannot be in the middle of a group, so the group is refused
    // whole rather than half taken.
    bad(parser, {"-abc"}, ParseResult::UnknownOption, Parser::AllowUnixGroupFlags);
}

// Where option reading stops is a program's own to declare, and the word it stops at is its
// own to choose. The parser reserves none, so the familiar -- is a declaration like any other.
BOOST_AUTO_TEST_CASE(test_a_program_says_where_options_stop) {
    const auto &tree = [](const char *word) {
        return Parser(Command("prog")
                          .addOption(Option({"-f"}, "Force"))
                          .addOption(Option({word}, "The rest, whatever it looks like")
                                         .arg(Argument("rest").nargs(Argument::Remainder))));
    };

    auto usual = tree("--");
    auto result = ok(usual, {"-f", "--", "-f", "--not-an-option"});
    BOOST_CHECK(result.option("-f").has_value());
    BOOST_CHECK_EQUAL(result.option("-f")->count(), 1);
    BOOST_REQUIRE(result.option("--"));
    BOOST_CHECK(must(result.option("--")->values<std::string>(0)) ==
                std::vector<std::string>({"-f", "--not-an-option"}));

    // Any other word does the same, since nothing about -- is built in.
    auto chosen = tree("--exec");
    auto other = ok(chosen, {"-f", "--exec", "-f", "--not-an-option"});
    BOOST_CHECK_EQUAL(other.option("-f")->count(), 1);
    BOOST_CHECK(must(other.option("--exec")->values<std::string>(0)) ==
                std::vector<std::string>({"-f", "--not-an-option"}));

    // Undeclared, it is an option nobody has heard of rather than a rule of the language.
    Parser bare(Command("prog").addOption(Option({"-f"}, "Force")));
    bad(bare, {"--", "x"}, ParseResult::UnknownOption);
}

// The terminator against an option whose own argument is greedy. Each of those was covered and
// the two were never crossed, and the greedy run stopped at any declared option while walking
// straight over the one token that exists to say stop.
BOOST_AUTO_TEST_CASE(test_the_terminator_ends_a_greedy_option_too) {
    Parser parser(Command("prog")
                      .addArgument(Argument("dest"))
                      .addOption(Option({"-f"}, "Files").arg(Argument("file").multi()))
                      .addOption(Option({"-v"}, "Say more")));

    // What it always did for a declared option, for contrast.
    auto stopped = ok(parser, {"-f", "a", "b", "-v", "dest"});
    BOOST_CHECK(must(stopped.option("-f")->values<std::string>(0)) ==
                std::vector<std::string>({"a", "b"}));
    BOOST_CHECK_EQUAL(must(stopped.value(0)), "dest");

    // A declared word does the same, and what follows it is a value even where it is spelled
    // like an option, which is the whole of what a Remainder is for.
    Parser withRest(
        Command("prog")
            .addArgument(Argument("dest"))
            .addOption(Option({"-f"}, "Files").arg(Argument("file").multi()))
            .addOption(
                Option({"--"}, "The rest").arg(Argument("rest").nargs(Argument::Remainder))));
    auto ended = ok(withRest, {"dest", "-f", "a", "b", "--", "-f", "x"});
    BOOST_CHECK(must(ended.option("-f")->values<std::string>(0)) ==
                std::vector<std::string>({"a", "b"}));
    BOOST_CHECK_EQUAL(must(ended.value(0)), "dest");
    BOOST_CHECK(must(ended.option("--")->values<std::string>(0)) ==
                std::vector<std::string>({"-f", "x"}));

    // An argument that has to have a value does not take a declared option as one. A negative
    // number is still a value, since it is nobody's option.
    Parser single(Command("prog")
                      .addOption(Option({"-o"}, "Out").arg("dir"))
                      .addOption(Option({"-v"}, "Say more")));
    bad(single, {"-o", "-v"}, ParseResult::MissingOptionArgument);
    BOOST_CHECK_EQUAL(must(ok(single, {"-o", "-5"}).valueForOption("-o")), "-5");
}

BOOST_AUTO_TEST_CASE(test_subcommands) {
    Parser parser(Command("prog").addCommands({
        Command("copy", "Copy").addArgument(Argument("src")),
        Command("remove", "Remove").addArgument(Argument("path")),
    }));

    auto result = ok(parser, {"copy", "a"});
    BOOST_REQUIRE(result.command() != nullptr);
    BOOST_CHECK_EQUAL(result.command()->name(), "copy");
    BOOST_CHECK(result.commandPath() == std::vector<std::string>({"prog", "copy"}));
    BOOST_CHECK_EQUAL(must(result.value(0)), "a");

    // A name that is no subcommand, on a command that takes no arguments either, is named as
    // the command it is not rather than counted as an argument too many.
    auto failure = bad(parser, {"nonsense"}, ParseResult::UnknownCommand);
    BOOST_CHECK(failure.errorText().find("nonsense") != std::string::npos);

    // Where the command does take arguments, a name that is not a subcommand is one of those,
    // and only the surplus is counted.
    Parser mixed(Command("prog").addArgument(Argument("a")).addCommand(Command("copy")));
    BOOST_CHECK_EQUAL(must(ok(mixed, {"nonsense"}).value(0)), "nonsense");
    bad(mixed, {"one", "two"}, ParseResult::TooManyArguments);
}

BOOST_AUTO_TEST_CASE(test_nested_subcommands) {
    Parser parser(Command("prog").addCommand(
        Command("remote").addCommand(Command("add").addArgument(Argument("name")))));

    auto result = ok(parser, {"remote", "add", "origin"});
    BOOST_CHECK(result.commandPath() == std::vector<std::string>({"prog", "remote", "add"}));
    BOOST_CHECK_EQUAL(must(result.value(0)), "origin");
}

BOOST_AUTO_TEST_CASE(test_global_options_reach_subcommands) {
    Parser parser(Command("prog")
                      .addOption(Option({"-V", "--verbose"}, "Talk more").recursive())
                      .addOption(Option({"-q"}, "Local to the root"))
                      .addCommand(Command("copy")));

    auto result = ok(parser, {"copy", "-V"});
    BOOST_CHECK(result.option("-V").has_value());

    // One that is not global stays where it was declared.
    bad(parser, {"copy", "-q"}, ParseResult::UnknownOption);
}

BOOST_AUTO_TEST_CASE(test_required_option) {
    Parser parser(Command("prog").addOption(Option({"-o"}, "Out").arg("dir").required()));

    BOOST_CHECK(ok(parser, {"-o", "x"}).option("-o").has_value());
    bad(parser, {}, ParseResult::MissingRequiredOption);
}

BOOST_AUTO_TEST_CASE(test_a_declared_type_is_checked_while_parsing) {
    Parser parser(Command("prog")
                      .addArgument(Argument("count").type<int>())
                      .addOption(Option({"-r"}, "Ratio").arg(Argument("value").type<double>())));

    BOOST_CHECK_EQUAL(must(ok(parser, {"12"}).value<int>(0)), 12);
    BOOST_CHECK_CLOSE(must(ok(parser, {"1", "-r", "0.5"}).valueForOption<double>("-r")), 0.5, 1e-9);

    // The point of declaring the type: a bad token is a diagnostic, not a zero read later.
    auto failure = bad(parser, {"twelve"}, ParseResult::ArgumentTypeMismatch);
    BOOST_CHECK(failure.errorText().find("int") != std::string::npos);
    bad(parser, {"1", "-r", "half"}, ParseResult::ArgumentTypeMismatch);
}

BOOST_AUTO_TEST_CASE(test_expected_values_and_validators) {
    Parser parser(Command("prog")
                      .addArgument(Argument("mode").expect({"fast", "slow"}))
                      .addOption(Option({"-n"}, "Name")
                                     .arg(Argument("value").validate(
                                         [](std::string_view token, std::string *error) {
                                             if (token.empty()) {
                                                 *error = "a name cannot be empty";
                                                 return false;
                                             }
                                             return true;
                                         }))));

    BOOST_CHECK_EQUAL(must(ok(parser, {"fast"}).value(0)), "fast");
    bad(parser, {"medium"}, ParseResult::InvalidArgumentValue);

    auto failure = bad(parser, {"fast", "-n", ""}, ParseResult::ArgumentValidateFailed);
    // What the validator said is what gets printed, rather than a generic complaint.
    BOOST_CHECK_EQUAL(failure.errorText(), "a name cannot be empty");
}

BOOST_AUTO_TEST_CASE(test_prior_lets_help_answer_an_incomplete_line) {
    Parser parser(Command("prog")
                      .addArgument(Argument("required one"))
                      .addOption(Option(Option::Help).prior(Option::IgnoreMissingSymbols)));

    // Without the prior level this is a missing argument.
    BOOST_CHECK(!parser.parse(argv({})).isValid());
    auto result = ok(parser, {"--help"});
    BOOST_CHECK(result.isRoleSet(Option::Help));
    // The role is what a caller asks about, not the spelling.
    BOOST_CHECK(!result.isRoleSet(Option::Version));
}

BOOST_AUTO_TEST_CASE(test_prior_can_set_itself_on_an_empty_line) {
    Parser parser(Command("prog")
                      .addArgument(Argument("required one"))
                      .addOption(Option(Option::Help).prior(Option::AutoSetWhenNoSymbols)));

    auto result = ok(parser, {});
    BOOST_CHECK(result.option("--help").has_value());

    // Given anything at all it stays out of the way.
    BOOST_CHECK(!ok(parser, {"value"}).option("--help").has_value());
}

// Everything the tokenizer does, asked once at the root and once a level down, against one set
// of declarations put in both places. Anything that reads the whole command line rather than
// what the command that was reached was given looks right on a flat tree and is wrong under a
// subcommand, which is how AutoSetWhenNoSymbols was broken for every subcommand while a case
// watched the line that decides it.
BOOST_AUTO_TEST_CASE(test_the_parser_reads_the_same_a_level_down) {
    const auto &declare = [](std::string name) {
        return Command(std::move(name))
            .addArguments({Argument("src").multi(), Argument("dest")})
            .addOptions({
                Option({"-f", "--force"}, "Force"),
                Option({"-o", "--output"}, "Out").arg("file"),
                Option({"-n"}, "Count").arg(Argument("n").type<int>()),
                Option({"-m"}, "Mode").arg(Argument("mode").expect({"fast", "slow"})),
                Option({"-c"}, "Config").arg(Argument("path", {}, false).defaultValue("none")),
            });
    };

    // Everything a caller can read back, in one string, so a mismatch says what differs rather
    // than only that something does.
    const auto &readBack = [](const ParseResult &result) {
        std::string res = result.isValid() ? "ok" : "error " + std::to_string(int(result.error()));
        for (int i = 0; i < 2; ++i) {
            res += " |";
            for (auto value : result.rawValues(i)) {
                res += " " + std::string(value);
            }
        }
        for (const auto *token : {"-f", "-o", "-n", "-m", "-c"}) {
            auto given = result.option(token);
            res += std::string(" ") + token + "=";
            res += given ? given->value<std::string>().value_or("(set)") : "(no)";
        }
        return res;
    };

    const std::vector<std::vector<std::string>> lines = {
        {},
        {"a"},
        {"a", "b"},
        {"a", "b", "c"},
        {"-f", "a", "b"},
        {"a", "-f", "b"},
        {"a", "b", "-f"},
        {"-o", "x", "a", "b"},
        {"--output=x", "a", "b"},
        {"-ox", "a", "b"},
        {"--force", "--output", "x", "a", "b"},
        {"-fo", "x", "a", "b"},
        {"--", "-f", "b"},
        {"-n", "12", "a", "b"},
        {"-n", "notanumber", "a", "b"},
        {"-m", "fast", "a", "b"},
        {"-m", "sideways", "a", "b"},
        {"-c", "a", "b"},
        {"--unknown", "a", "b"},
        {"-f", "-f", "a", "b"},
        {"-o", "a", "b"},
    };

    for (auto options : {Parser::Standard, Parser::AllowUnixGroupFlags}) {
        Parser flat(declare("prog"));
        Parser deep(Command("prog").addCommand(declare("inner")));
        Parser deeper(Command("prog").addCommand(Command("mid").addCommand(declare("inner"))));

        for (const auto &line : lines) {
            std::string what;
            for (const auto &item : line) {
                what += " " + item;
            }

            const auto &at = [&line, options](const Parser &parser, std::vector<std::string> path) {
                path.insert(path.end(), line.begin(), line.end());
                return parser.parse(path, options);
            };
            auto root = readBack(at(flat, {"prog"}));
            for (const auto &deeperOne :
                 {std::make_pair(std::vector<std::string>{"prog", "inner"}, &deep),
                  std::make_pair(std::vector<std::string>{"prog", "mid", "inner"}, &deeper)}) {
                auto below = readBack(at(*deeperOne.second, deeperOne.first));
                BOOST_CHECK_MESSAGE(root == below,
                                    "[" + what + "] reads one way at the root and another " +
                                        std::to_string(deeperOne.first.size() - 1) +
                                        " down:\n  root " + root + "\n  down " + below);
            }
        }
    }
}

// Everything the prior ladder does, asked once at the root and once a level down, because the
// two only tell each other apart there. A root only tree makes "the line was empty" and "this
// command was given nothing" the same value, which is how AutoSetWhenNoSymbols was broken for
// every subcommand while a case watched the line that decides it.
BOOST_AUTO_TEST_CASE(test_the_prior_ladder_reads_the_same_a_level_down) {
    const auto &shaped = [](Option::Prior level, bool nested) {
        auto inner = Command(nested ? "build" : "prog")
                         .addArgument(Argument("target"))
                         .addOption(Option({"-j"}, "Jobs").arg("n"))
                         .addOption(Option(Option::Help).prior(level));
        return nested ? Command("prog").addCommand(std::move(inner)) : std::move(inner);
    };
    const auto &given = [&shaped](Option::Prior level, bool nested, std::vector<std::string> args) {
        Parser parser(shaped(level, nested));
        std::vector<std::string> line = {"prog"};
        if (nested) {
            line.push_back("build");
        }
        line.insert(line.end(), args.begin(), args.end());
        return parser.parse(line);
    };

    for (auto level :
         {Option::NoPrior, Option::IgnoreMissingArguments, Option::IgnoreMissingSymbols,
          Option::AutoSetWhenNoSymbols, Option::ExclusiveToArguments, Option::ExclusiveToOptions,
          Option::ExclusiveToAll}) {
        const std::string at = "prior level " + std::to_string(int(level));
        for (const auto &args : {
                 std::vector<std::string>{},
                 std::vector<std::string>{"--help"},
                 std::vector<std::string>{"--help", "-j", "4"},
                 std::vector<std::string>{"x"}
        }) {
            auto flat = given(level, false, args);
            auto deep = given(level, true, args);

            std::string what = at + ", given";
            for (const auto &item : args) {
                what += " " + item;
            }
            BOOST_CHECK_MESSAGE(flat.isValid() == deep.isValid(),
                                what + ": valid at the root and not a level down, or the other "
                                       "way about");
            BOOST_CHECK_MESSAGE(int(flat.error()) == int(deep.error()), what + ": a different "
                                                                               "error each way");
            BOOST_CHECK_MESSAGE(flat.isRoleSet(Option::Help) == deep.isRoleSet(Option::Help),
                                what + ": the option was set at one depth and not the other");
        }
    }
}

// What counts is what the command that was reached was given, not how long the command line
// was. The name of a subcommand is a token, so counting tokens left "prog build" looking like a
// line with something in it, and a subcommand's own auto option never fired. Every
// addHelpOption(true) on a subcommand was dead.
BOOST_AUTO_TEST_CASE(test_prior_sets_itself_on_a_bare_subcommand) {
    const auto &tree = [] {
        return Parser(
            Command("prog")
                .addOption(Option(Option::Version).prior(Option::AutoSetWhenNoSymbols))
                .addCommand(
                    Command("build")
                        .addArgument(Argument("target"))
                        .addOption(Option({"-j"}, "Jobs").arg("n"))
                        .addOption(Option(Option::Help).prior(Option::AutoSetWhenNoSymbols))));
    };

    // A subcommand with nothing after it, which is the case that never worked. Its required
    // argument is not missed, since the option that was set stands in for the whole line.
    auto parser = tree();
    auto bare = ok(parser, {"build"});
    BOOST_CHECK(bare.option("--help").has_value());
    BOOST_CHECK(bare.isRoleSet(Option::Help));

    // Given a value, it stays out of the way and the argument is read as usual.
    auto given = ok(parser, {"build", "x"});
    BOOST_CHECK(!given.option("--help").has_value());
    BOOST_CHECK_EQUAL(must(given.value(0)), "x");

    // Given an option rather than a value, it stays out of the way as well, and what is missing
    // is missed.
    bad(parser, {"build", "-j", "4"}, ParseResult::MissingCommandArgument);

    // The root's own is not set by reaching a subcommand, since the line was not empty.
    BOOST_CHECK(!bare.isRoleSet(Option::Version));
    BOOST_CHECK(ok(parser, {}).isRoleSet(Option::Version));
}

BOOST_AUTO_TEST_CASE(test_exclusive_prior_levels) {
    auto build = [](Option::Prior level) {
        return Parser(Command("prog")
                          .addArgument(Argument("path").optional())
                          .addOption(Option({"-f"}, "Force"))
                          .addOption(Option(Option::Version).prior(level)));
    };

    // Alone it is fine either way.
    BOOST_CHECK(build(Option::ExclusiveToAll).parse(argv({"--version"})).isValid());

    // With an argument beside it, only the levels that forbid arguments complain.
    BOOST_CHECK(build(Option::ExclusiveToOptions).parse(argv({"--version", "x"})).isValid());
    auto with_argument = build(Option::ExclusiveToArguments).parse(argv({"--version", "x"}));
    BOOST_CHECK_EQUAL(int(with_argument.error()), int(ParseResult::PriorOptionWithArguments));

    // With another option beside it, likewise.
    BOOST_CHECK(build(Option::ExclusiveToArguments).parse(argv({"--version", "-f"})).isValid());
    auto with_option = build(Option::ExclusiveToAll).parse(argv({"--version", "-f"}));
    BOOST_CHECK_EQUAL(int(with_option.error()), int(ParseResult::PriorOptionWithOptions));
}

// "No arguments may be given" is about what was given. A default value stands in where nothing
// was, so reading the arguments after the defaults are applied has an option that forbids them
// refuse a line that carried none.
BOOST_AUTO_TEST_CASE(test_an_exclusive_option_reads_what_was_given_not_what_stood_in) {
    auto build = [](Option::Prior level, bool with_default) {
        auto path = Argument("path").optional();
        if (with_default) {
            path.defaultValue("a.out");
        }
        return Parser(Command("prog")
                          .addArgument(path)
                          .addOption(Option({"-f"}, "Force"))
                          .addOption(Option({"--stat"}, "Just report").prior(level)));
    };

    // The line carries nothing either way, and the default is still there to be read.
    BOOST_CHECK(ok(build(Option::ExclusiveToArguments, false), {"--stat"}).values(0) ==
                std::vector<std::string>());
    BOOST_CHECK_EQUAL(
        ok(build(Option::ExclusiveToArguments, true), {"--stat"}).value(0).value_or(""), "a.out");

    // Given one, it complains, which is the whole of what the level is for.
    bad(build(Option::ExclusiveToArguments, true), {"--stat", "x"},
        ParseResult::PriorOptionWithArguments);

    // ExclusiveToAll forbids both, and the option it was given beside is what it should name.
    // Reading the defaults made this the argument complaint, which is the wrong one.
    bad(build(Option::ExclusiveToAll, true), {"--stat", "-f"}, ParseResult::PriorOptionWithOptions);
    BOOST_CHECK_EQUAL(ok(build(Option::ExclusiveToAll, true), {"--stat"}).value(0).value_or(""),
                      "a.out");

    // More than one argument, so the token count and the argument count differ.
    Parser several(
        Command("prog")
            .addArgument(Argument("a").optional().defaultValue("1"))
            .addArgument(Argument("b").optional().defaultValue("2"))
            .addOption(Option({"--stat"}, "Just report").prior(Option::ExclusiveToArguments)));
    auto filled = ok(several, {"--stat"});
    BOOST_CHECK_EQUAL(filled.value(0).value_or(""), "1");
    BOOST_CHECK_EQUAL(filled.value(1).value_or(""), "2");
    bad(several, {"--stat", "x"}, ParseResult::PriorOptionWithArguments);

    // Crossed with a leading Remainder, whose default stands in the same way and whose tokens
    // are read before any argument is filled.
    Parser tail(
        Command("prog")
            .addArgument(
                Argument("rest").nargs(Argument::Remainder).optional().defaultValue("none"))
            .addOption(Option({"--stat"}, "Just report").prior(Option::ExclusiveToArguments)));
    BOOST_CHECK_EQUAL(ok(tail, {"--stat"}).value(0).value_or(""), "none");
    bad(tail, {"--stat", "x"}, ParseResult::PriorOptionWithArguments);

    // Crossed with recursive, where the option forbidding arguments belongs to another command.
    Parser below(
        Command("prog")
            .addOption(
                Option({"--stat"}, "Just report").prior(Option::ExclusiveToArguments).recursive())
            .addCommand(
                Command("build").addArgument(Argument("target").optional().defaultValue("all"))));
    BOOST_CHECK_EQUAL(ok(below, {"build", "--stat"}).value(0).value_or(""), "all");
    bad(below, {"build", "--stat", "x"}, ParseResult::PriorOptionWithArguments);
}

BOOST_AUTO_TEST_CASE(test_an_option_may_ignore_its_own_missing_arguments) {
    Parser parser(Command("prog").addOption(
        Option({"-l"}, "List").arg("what").prior(Option::IgnoreMissingArguments)));

    auto result = ok(parser, {"-l"});
    BOOST_CHECK(result.option("-l").has_value());
    // The option is there and its argument is not, which is a different thing from its argument
    // being the empty string. \c -l and \c -l "" do not read the same.
    BOOST_CHECK(!result.valueForOption("-l").has_value());
}

BOOST_AUTO_TEST_CASE(test_case_insensitivity_is_asked_for) {
    Parser parser(
        Command("prog").addOption(Option({"--force"}, "Force")).addCommand(Command("copy")));

    BOOST_CHECK(ok(parser, {"--FORCE"}, Parser::IgnoreOptionCase).option("--force").has_value());
    BOOST_CHECK(!parser.parse(argv({"--FORCE"})).isValid());

    BOOST_CHECK_EQUAL(ok(parser, {"COPY"}, Parser::IgnoreCommandCase).command()->name(), "copy");
    // Without the flag it is not a command, so it falls through to being an argument.
    BOOST_CHECK(!parser.parse(argv({"COPY"})).isValid());
}

BOOST_AUTO_TEST_CASE(test_dos_short_options) {
    Parser parser(Command("prog").addOption(Option({"-f"}, "Force")));

    BOOST_CHECK(ok(parser, {"/f"}, Parser::AllowDosShortOptions).option("-f").has_value());
    // Off by default, where it is a positional and the command takes none.
    bad(parser, {"/f"}, ParseResult::TooManyArguments);
}

BOOST_AUTO_TEST_CASE(test_unix_short_options_can_be_turned_off) {
    Parser parser(Command("prog")
                      .addArgument(Argument("path").optional())
                      .addOption(Option({"-f", "--force"}, "Force")));

    BOOST_CHECK(ok(parser, {"-f"}).option("-f").has_value());
    // With them off a single dash is just a token, which lands in the argument.
    auto result = ok(parser, {"-f"}, Parser::DontAllowUnixShortOptions);
    BOOST_CHECK(!result.option("-f").has_value());
    BOOST_CHECK_EQUAL(must(result.value(0)), "-f");
    // The long spelling is untouched.
    BOOST_CHECK(
        ok(parser, {"--force"}, Parser::DontAllowUnixShortOptions).option("-f").has_value());
}

BOOST_AUTO_TEST_CASE(test_invoke_runs_the_command_that_was_reached) {
    std::string seen;
    Parser parser(Command("prog")
                      .addCommand(Command("copy")
                                      .addArgument(Argument("src"))
                                      .setHandler([&seen](const ParseResult &result) {
                                          seen = must(result.value(0));
                                          return 3;
                                      }))
                      .addCommand(Command("bare")));

    BOOST_CHECK_EQUAL(parser.invoke(argv({"copy", "file"})), 3);
    BOOST_CHECK_EQUAL(seen, "file");

    // No handler, and a parse that failed, both hand back what the caller asked for. The
    // failure is said on the way, since nothing else is going to say it.
    BOOST_CHECK_EQUAL(parser.invoke(argv({"bare"}), -9), -9);
    int code = 0;
    auto complaint = capturedStderr([&] { code = parser.invoke(argv({"copy"}), -9); });
    BOOST_CHECK_EQUAL(code, -9);
    BOOST_CHECK(!complaint.empty());
}

BOOST_AUTO_TEST_CASE(test_typed_reads) {
    Parser parser(Command("prog")
                      .addArgument(Argument("numbers").multi().type<int>())
                      .addOption(Option({"-n"}, "How many").arg(Argument("n").type<int>())));

    auto result = ok(parser, {"1", "2", "3", "-n", "9"});
    BOOST_CHECK(result.values<int>(0) == std::vector<int>({1, 2, 3}));
    BOOST_CHECK_EQUAL(must(result.value<int>(0)), 1);
    BOOST_CHECK_EQUAL(must(result.valueForOption<int>("-n")), 9);
    // The untyped read is the text, which is what everything is stored as.
    BOOST_CHECK_EQUAL(must(result.value(0)), "1");
}

// ---------------------------------------------------------------------------------------------
// Edges, taken from what CLI11, argparse and argtable3 test their own parsers with. Their
// semantics are not ours, so what is borrowed is the question each case asks rather than the
// answer it expects.
// ---------------------------------------------------------------------------------------------

// CLI11's DashedOptions and FlagLikeOption ask what happens to a value that looks like a switch.
BOOST_AUTO_TEST_CASE(test_a_value_that_looks_like_an_option) {
    Parser parser(Command("prog")
                      .addOption(Option({"-o"}, "Out").arg("dir"))
                      .addOption(Option({"-f"}, "Force")));

    // A declared option is never quietly taken as somebody else's value. The complaint names
    // the option that went without, which beats swallowing -f and saying nothing.
    bad(parser, {"-o", "-f"}, ParseResult::MissingOptionArgument);

    // Joined to it, it is a value like any other.
    BOOST_CHECK_EQUAL(must(ok(parser, {"-o=-f"}).valueForOption("-o")), "-f");

    // So is anything that merely looks like an option without being one. A negative number is
    // the case this matters for.
    BOOST_CHECK_EQUAL(must(ok(parser, {"-o", "-5"}).valueForOption("-o")), "-5");
    BOOST_CHECK_EQUAL(must(ok(parser, {"-o", "-nonsense"}).valueForOption("-o")), "-nonsense");
}

// CLI11's ForcedPositional, pushed further than the first case in this file does.
BOOST_AUTO_TEST_CASE(test_what_survives_a_remainder) {
    Parser parser(Command("prog")
                      .addOption(Option({"-f"}, "Force"))
                      .addOption(Option({"--"}, "The rest")
                                     .arg(Argument("rest").nargs(Argument::Remainder).optional())));

    // A second one is a value like everything else after the first.
    auto twice = ok(parser, {"--", "--", "-f"});
    BOOST_REQUIRE(twice.option("--"));
    BOOST_CHECK(must(twice.option("--")->values<std::string>(0)) ==
                std::vector<std::string>({"--", "-f"}));
    BOOST_CHECK(!twice.option("-f").has_value());

    // On its own it leaves nothing behind, a Remainder being content with none.
    auto alone = ok(parser, {"--"});
    BOOST_REQUIRE(alone.option("--"));
    BOOST_CHECK(must(alone.option("--")->values<std::string>(0)).empty());
}

// argparse asks this one about equals signs inside values.
BOOST_AUTO_TEST_CASE(test_only_the_first_equals_sign_splits) {
    Parser parser(Command("prog").addOption(Option({"-D", "--define"}, "Define").arg("expr")));

    BOOST_CHECK_EQUAL(must(ok(parser, {"--define=KEY=VALUE"}).valueForOption("-D")), "KEY=VALUE");
    BOOST_CHECK_EQUAL(must(ok(parser, {"--define="}).valueForOption("-D")), "");
    // A whole token with nothing before the sign is not an option anybody declared.
    bad(parser, {"=value"}, ParseResult::TooManyArguments);
}

// CLI11 has several tests about one option name being the start of another.
BOOST_AUTO_TEST_CASE(test_one_option_being_a_prefix_of_another) {
    Parser parser(Command("prog").addOptions({
        Option({"--out"}, "Out").arg("dir"),
        Option({"--output"}, "Output").arg("file"),
    }));

    // The whole token is tried before anything is taken apart, so the longer name is reachable.
    BOOST_CHECK_EQUAL(must(ok(parser, {"--output", "a"}).valueForOption("--output")), "a");
    BOOST_CHECK_EQUAL(must(ok(parser, {"--out", "b"}).valueForOption("--out")), "b");
    BOOST_CHECK(!ok(parser, {"--output", "a"}).option("--out").has_value());
}

// argtable3 tests the count of a repeatable flag rather than its values.
BOOST_AUTO_TEST_CASE(test_counting_a_flag_that_carries_nothing) {
    Parser parser(Command("prog").addOption(Option({"-v"}, "More talk").multi()));

    // A count is only ever asked of an option that was given, so it is never zero.
    auto once = ok(parser, {"-v"});
    BOOST_REQUIRE(once.option("-v").has_value());
    BOOST_CHECK_EQUAL(once.option("-v")->count(), 1);

    auto thrice = ok(parser, {"-v", "-v", "-v"});
    BOOST_CHECK_EQUAL(thrice.option("-v")->count(), 3);

    // Declared and not given is nothing, and so is never declared at all. A program knows
    // which of its own options it wrote down, so the two need not be told apart.
    BOOST_CHECK(!ok(parser, {}).option("-v").has_value());
    BOOST_CHECK(!ok(parser, {}).option("-q").has_value());
    BOOST_CHECK(!ok(parser, {"-v"}).option("-q").has_value());
}

// CLI11's ExpectedRange cases, in the shape our arities give them.
BOOST_AUTO_TEST_CASE(test_how_few_and_how_many_a_multi_argument_takes) {
    Parser parser(Command("prog").addArgument(Argument("files").multi()));

    bad(parser, {}, ParseResult::MissingCommandArgument);
    BOOST_CHECK_EQUAL(must(ok(parser, {"one"}).values(0)).size(), 1u);
    BOOST_CHECK_EQUAL(must(ok(parser, {"a", "b", "c", "d", "e"}).values(0)).size(), 5u);

    // An optional one is content with nothing.
    Parser lenient(Command("prog").addArgument(Argument("files").multi().optional()));
    BOOST_CHECK(must(ok(lenient, {}).values(0)).empty());
}

// Two multi arguments in a row, which is the case that shows the reservation rule is counting
// required arguments rather than arguments.
BOOST_AUTO_TEST_CASE(test_two_greedy_arguments_in_a_row) {
    // A mistake, and said so wherever the question is asked. A greedy argument leaves a token
    // for each required argument after it and none for anything else, so a second one would
    // never see a token.
    BOOST_CHECK(!detail::arguments_can_follow({Argument("first").multi()},
                                              Argument("second").multi().optional()));

#ifdef NDEBUG
    // Parsed anyway, since parse() does not walk the tree in a release build. The first is
    // greedy and the second is not required, so the first takes the lot.
    Parser parser(Command("prog").addArguments({
        Argument("first").multi(),
        Argument("second").multi().optional(),
    }));
    auto result = ok(parser, {"a", "b", "c"});
    BOOST_CHECK_EQUAL(must(result.values(0)).size(), 3u);
    BOOST_CHECK(must(result.values(1)).empty());
#endif
}

// Options and positionals interleaved, which every one of the three suites checks somewhere.
BOOST_AUTO_TEST_CASE(test_options_may_come_anywhere) {
    Parser parser(Command("prog")
                      .addArguments({Argument("a"), Argument("b")})
                      .addOption(Option({"-f"}, "Force"))
                      .addOption(Option({"-o"}, "Out").arg("dir")));

    for (auto args : {
             std::vector<std::string>{"-f",  "one", "two"},
             std::vector<std::string>{"one", "-f",  "two"},
             std::vector<std::string>{"one", "two", "-f" }
    }) {
        auto full = argv({});
        full.insert(full.end(), args.begin(), args.end());
        auto result = parser.parse(full);
        BOOST_REQUIRE_MESSAGE(result.isValid(), result.errorText());
        BOOST_CHECK(result.option("-f").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "one");
        BOOST_CHECK_EQUAL(must(result.value(1)), "two");
    }

    // An option's value is its own and is not counted as a positional.
    auto result = ok(parser, {"one", "-o", "dir", "two"});
    BOOST_CHECK_EQUAL(must(result.value(1)), "two");
    BOOST_CHECK_EQUAL(must(result.valueForOption("-o")), "dir");
}

// A subcommand name that is also a value, which CLI11 tests as a fallthrough question.
BOOST_AUTO_TEST_CASE(test_a_subcommand_name_used_as_a_value) {
    Parser parser(Command("prog")
                      .addOption(Option({"-o"}, "Out").arg("dir"))
                      .addCommand(Command("copy").addArgument(Argument("src"))));

    // A command is only looked for where a command can be, which is before anything else.
    auto result = ok(parser, {"copy", "copy"});
    BOOST_CHECK_EQUAL(result.command()->name(), "copy");
    BOOST_CHECK_EQUAL(must(result.value(0)), "copy");

    // An option in front of it ends the path, so what follows is too late to be a command. The
    // recursive one is written after the command it reaches, like every other option.
    Parser recursive(Command("prog")
                         .addOption(Option({"-V"}, "Verbose").recursive())
                         .addCommand(Command("copy").addArgument(Argument("src"))));
    bad(recursive, {"-V", "copy", "x"}, ParseResult::UnknownCommand);
    auto after = ok(recursive, {"copy", "-V", "x"});
    BOOST_CHECK_EQUAL(after.command()->name(), "copy");
    BOOST_CHECK(after.option("-V").has_value());
    BOOST_CHECK_EQUAL(must(after.value(0)), "x");

    // Once a value has been taken, a name is a value and not a command any more. Without that
    // rule a program could never be given a file that happens to share a subcommand's name.
    Parser positional(
        Command("prog").addArguments({Argument("a"), Argument("b")}).addCommand(Command("copy")));
    auto late = ok(positional, {"x", "copy"});
    BOOST_CHECK_EQUAL(late.command()->name(), "prog");
    BOOST_CHECK_EQUAL(must(late.value(1)), "copy");

    // Nor once a Remainder has started, where nothing is a command and nothing is an option.
    Parser rest(Command("prog")
                    .addArgument(Argument("head"))
                    .addArgument(Argument("tail").nargs(Argument::Remainder).optional())
                    .addOption(Option({"-f"}, "Force"))
                    .addCommand(Command("copy")));
    auto forced = ok(rest, {"x", "copy", "-f"});
    BOOST_CHECK_EQUAL(forced.command()->name(), "prog");
    BOOST_CHECK(forced.values(1) == std::vector<std::string>({"copy", "-f"}));
    BOOST_CHECK(!forced.option("-f").has_value());
}

// Short matching carries exactly one value, so it is offered only to an option that wants
// exactly one and has to have it. Anything else would set half an option and leave the rest to
// be discovered as a missing argument somewhere further on.
BOOST_AUTO_TEST_CASE(test_short_matching_needs_one_required_argument) {
    Parser two(Command("prog").addOption(
        Option({"-o"}, "Two values").arg("a").arg("b").shortMatch(Option::ShortMatchAll)));
    bad(two, {"-oX"}, ParseResult::UnknownOption);
    // Written out it is fine.
    BOOST_CHECK(ok(two, {"-o", "X", "Y"}).option("-o").has_value());

    Parser optional(Command("prog").addOption(
        Option({"-p"}, "Maybe a value").arg("v", false).shortMatch(Option::ShortMatchAll)));
    bad(optional, {"-pX"}, ParseResult::UnknownOption);

    Parser none(Command("prog").addOption(
        Option({"-f"}, "No value at all").shortMatch(Option::ShortMatchAll)));
    bad(none, {"-fX"}, ParseResult::UnknownOption);

    // One that has to have exactly one but reads on past it is the same case: a value written
    // against the spelling says this is the value, and a greedy run would take the next token
    // as well. Written out with a space it works.
    Parser greedy(Command("prog").addOption(
        Option({"-I"}, "Includes").arg(Argument("dir").multi()).shortMatch(Option::ShortMatchAll)));
    bad(greedy, {"-IX"}, ParseResult::UnknownOption);
    BOOST_CHECK(ok(greedy, {"-I", "X", "Y"}).option("-I")->values() ==
                std::vector<std::string>({"X", "Y"}));
}

// A value written against the spelling is the first value of the option's first argument, not
// the whole of it. An argument that takes one is finished by it and one that takes more reads on
// from the next token, so --opt=a b and --opt a b are one line said two ways.
BOOST_AUTO_TEST_CASE(test_a_joined_value_starts_an_argument_rather_than_finishing_it) {
    const std::vector<std::string> both{"a", "b"};

    Parser greedy(
        Command("prog").addOption(Option({"-I"}, "Includes").arg(Argument("dir").multi())));
    BOOST_CHECK(ok(greedy, {"-I=a", "b"}).option("-I")->values() == both);
    BOOST_CHECK(ok(greedy, {"-I", "a", "b"}).option("-I")->values() == both);
    // Nothing after it, and the joined value is the one value the argument had to have.
    BOOST_CHECK(ok(greedy, {"-I=a"}).option("-I")->values() == std::vector<std::string>({"a"}));

    // The same for a Remainder, which takes what is left whether an option is among it or not.
    Parser rest(
        Command("prog")
            .addOption(Option({"--rest"}, "The rest").arg(Argument("r").nargs(Argument::Remainder)))
            .addOption(Option({"-f"}, "Force")));
    auto joined = ok(rest, {"--rest=a", "-f", "b"});
    BOOST_CHECK(joined.option("--rest")->values() == std::vector<std::string>({"a", "-f", "b"}));
    BOOST_CHECK(!joined.option("-f").has_value());

    // A Single argument still takes only what was joined to it, the rest being positional.
    Parser one(
        Command("prog").addArgument(Argument("path")).addOption(Option({"-o"}, "Out").arg("dir")));
    auto single = ok(one, {"-o=x", "y"});
    BOOST_CHECK_EQUAL(single.option("-o")->value().value_or(""), "x");
    BOOST_CHECK_EQUAL(single.value(0).value_or(""), "y");

    // The reservation for what follows counts the joined value as one of the greedy run's.
    Parser reserved(Command("prog").addOption(
        Option({"-c"}, "Copy").arg(Argument("src").multi()).arg(Argument("dest"))));
    auto pair = ok(reserved, {"-c=a", "b", "c"});
    BOOST_CHECK(pair.option("-c")->values(0) == both);
    BOOST_CHECK_EQUAL(pair.option("-c")->value(1).value_or(""), "c");
}

// A greedy argument takes one token whatever it leaves behind, since one or more is what it
// promised. A value written against the option has already kept that promise, so there is
// nothing left to force and what follows keeps what was reserved for it. Without this the
// smallest line that should work, -c=a b, is the one that does not.
BOOST_AUTO_TEST_CASE(test_a_joined_value_keeps_the_promise_the_reservation_would_have_kept) {
    Parser copy(
        Command("prog").addOption(Option({"-c"}, "Copy").arg(Argument("src").multi()).arg("dest")));

    // Every line here and its spaced twin, which is the property that was broken.
    const auto &same_as_spaced = [&copy](std::initializer_list<std::string> joined,
                                         std::initializer_list<std::string> spaced) {
        auto a = ok(copy, joined);
        auto b = ok(copy, spaced);
        BOOST_CHECK(a.option("-c")->values(0) == b.option("-c")->values(0));
        BOOST_CHECK(a.option("-c")->value(1) == b.option("-c")->value(1));
        return a;
    };
    auto minimum = same_as_spaced({"-c=a", "b"}, {"-c", "a", "b"});
    BOOST_CHECK(minimum.option("-c")->values(0) == std::vector<std::string>({"a"}));
    BOOST_CHECK_EQUAL(minimum.option("-c")->value(1).value_or(""), "b");

    auto spare = same_as_spaced({"-c=a", "b", "c"}, {"-c", "a", "b", "c"});
    BOOST_CHECK(spare.option("-c")->values(0) == std::vector<std::string>({"a", "b"}));

    // Nothing to reserve from, so what follows says so rather than the run giving way.
    bad(copy, {"-c=a"}, ParseResult::MissingOptionArgument);
    bad(copy, {"-c", "a"}, ParseResult::MissingOptionArgument);

    // Two to reserve rather than one, which the smallest line has exactly enough for.
    Parser three(Command("prog").addOption(
        Option({"-c"}, "Copy").arg(Argument("src").multi()).arg("mid").arg("dest")));
    auto tight = ok(three, {"-c=a", "b", "c"});
    BOOST_CHECK(tight.option("-c")->values(0) == std::vector<std::string>({"a"}));
    BOOST_CHECK_EQUAL(tight.option("-c")->value(1).value_or(""), "b");
    BOOST_CHECK_EQUAL(tight.option("-c")->value(2).value_or(""), "c");

    // Nothing follows it, so nothing is reserved and the run takes the lot. An argument that
    // may be left out cannot follow a greedy one, so last is the only way to reserve nothing.
    Parser last(Command("prog").addOption(Option({"-I"}, "Includes").arg(Argument("dir").multi())));
    BOOST_CHECK(ok(last, {"-I=a", "b"}).option("-I")->values() ==
                ok(last, {"-I", "a", "b"}).option("-I")->values());

    // An empty joined value is a value, as --prefix= is elsewhere, so it keeps the promise too.
    auto empty = ok(copy, {"-c=", "b"});
    BOOST_CHECK(empty.option("-c")->values(0) == std::vector<std::string>({""}));
    BOOST_CHECK_EQUAL(empty.option("-c")->value(1).value_or("-"), "b");

    // Crossed with the rule that a run ends at a declared option: there is nothing to take
    // after the joined value, so the argument after it reports what it did not get.
    Parser stopped(Command("prog")
                       .addOption(Option({"-c"}, "Copy").arg(Argument("src").multi()).arg("dest"))
                       .addOption(Option({"-f"}, "Force")));
    bad(stopped, {"-c=a", "-f"}, ParseResult::MissingOptionArgument);

    // The other caller of the same reservation never has a value in hand, so it is unchanged.
    Parser positional(
        Command("prog").addArgument(Argument("src").multi()).addArgument(Argument("dest")));
    BOOST_CHECK(ok(positional, {"a", "b"}).values(0) == std::vector<std::string>({"a"}));
    BOOST_CHECK(ok(positional, {"a", "b", "c"}).values(0) == std::vector<std::string>({"a", "b"}));
}

// IgnoreOptionCase is about the spellings a program declared, so it holds wherever one is
// matched. Matching the whole token without regard to case and the stuck-on prefix with regard
// to it would make -d foo work and -dfoo not.
BOOST_AUTO_TEST_CASE(test_ignoring_case_reaches_a_value_stuck_to_the_spelling) {
    Parser parser(Command("prog").addOption(
        Option({"-D"}, "Define").arg("macro").shortMatch(Option::ShortMatchAll)));

    BOOST_CHECK_EQUAL(ok(parser, {"-Dfoo"}).option("-D")->value().value_or(""), "foo");
    BOOST_CHECK_EQUAL(
        ok(parser, {"-dfoo"}, Parser::IgnoreOptionCase).option("-D")->value().value_or(""), "foo");
    BOOST_CHECK_EQUAL(
        ok(parser, {"-d", "foo"}, Parser::IgnoreOptionCase).option("-D")->value().value_or(""),
        "foo");

    // Without it the declared case is the only one, for both spellings of the same line.
    bad(parser, {"-dfoo"}, ParseResult::UnknownOption);
    bad(parser, {"-d", "foo"}, ParseResult::UnknownOption);
}

BOOST_AUTO_TEST_CASE(test_response_files) {
    auto path = std::filesystem::temp_directory_path() / "stdc_cli_response.txt";
    {
        std::ofstream file(path);
        file << "-f\n"
             << "one\n"
             << "\n"          // blank lines are nothing
             << "--out=dir\n" // and a joined value survives the trip
             << "two\n";
    }

    Parser parser(Command("prog")
                      .addArguments({Argument("a"), Argument("b")})
                      .addOption(Option({"-f"}, "Force"))
                      .addOption(Option({"--out"}, "Out").arg("dir")));

    auto result = ok(parser, {"@" + path.string()}, Parser::EnableResponseFile);
    BOOST_CHECK(result.option("-f").has_value());
    BOOST_CHECK_EQUAL(must(result.value(0)), "one");
    BOOST_CHECK_EQUAL(must(result.value(1)), "two");
    BOOST_CHECK_EQUAL(must(result.valueForOption("--out")), "dir");

    // Off by default, where the token is taken at face value instead of read as a file name.
    auto literal = ok(parser, {"@" + path.string(), "x"});
    BOOST_CHECK_EQUAL(must(literal.value(0)), "@" + path.string());
    BOOST_CHECK_EQUAL(must(literal.value(1)), "x");

    // A file that is not there is said so rather than passed along.
    bad(parser, {"@no_such_response_file.txt"}, ParseResult::ErrorReadingResponseFile,
        Parser::EnableResponseFile);

    std::filesystem::remove(path);
}

// A response file is written by a build system rather than typed at a shell, so a line arrives
// carrying things a shell would have taken off. All three of these were measured against
// qmcorecmd's suite, where every one of them turned a working command line into a diagnostic.
BOOST_AUTO_TEST_CASE(test_a_response_file_line_is_not_taken_as_it_is_written) {
    auto path = std::filesystem::temp_directory_path() / "stdc_cli_response_shapes.txt";
    const auto &given = [&path](const std::string &contents) {
        {
            // Binary, so that what the case says is on the line is what lands on it.
            std::ofstream file(path, std::ios::binary);
            file << contents;
        }
        Parser parser(Command("prog")
                          .addArguments({Argument("a"), Argument("b")})
                          .addOption(Option({"-f"}, "Force"))
                          .addOption(Option({"--out"}, "Out").arg("dir")));
        return ok(parser, {"@" + path.string()}, Parser::EnableResponseFile);
    };

    // Blanks at either end, which a generator writes when it lines its arguments up.
    {
        auto result = given("  -f  \n\tone\t\n   --out=dir   \n  two\n");
        BOOST_CHECK(result.option("-f").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "one");
        BOOST_CHECK_EQUAL(must(result.value(1)), "two");
        BOOST_CHECK_EQUAL(must(result.valueForOption("--out")), "dir");
    }

    // One pair of quotes, which is how a path with a space in it is written. CMake writes every
    // path that way, so this is the ordinary case rather than the odd one.
    {
        auto result = given("\"src dir/\"\n\"dest dir/\"\n");
        BOOST_CHECK_EQUAL(must(result.value(0)), "src dir/");
        BOOST_CHECK_EQUAL(must(result.value(1)), "dest dir/");
    }

    // One pair, not every quote on the line, and only where there is a pair to take.
    {
        auto result = given("\"a\"b\"c\"\n\"unbalanced\n");
        BOOST_CHECK_EQUAL(must(result.value(0)), "a\"b\"c");
        BOOST_CHECK_EQUAL(must(result.value(1)), "\"unbalanced");
    }

    // Quotes come off after the blanks do, so a quoted path indented by its generator is still
    // the path.
    BOOST_CHECK_EQUAL(must(given("   \"src dir/\"   \nx\n").value(0)), "src dir/");

    // The blanks inside a pair of quotes are the argument's own and stay.
    BOOST_CHECK_EQUAL(must(given("\"  padded  \"\nx\n").value(0)), "  padded  ");

    // A byte order mark on the first line, which is what a Windows editor leaves behind.
    {
        auto result = given("\xEF\xBB\xBF-f\none\ntwo\n");
        BOOST_CHECK(result.option("-f").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "one");
    }

    // Only the first line carries one, and only whole. Two of its three bytes are not a mark
    // and belong to whatever they are part of.
    BOOST_CHECK_EQUAL(must(given("x\n\xEF\xBB\xBFy\n").value(1)), "\xEF\xBB\xBFy");
    BOOST_CHECK_EQUAL(must(given("\xEF\xBB"
                                 "y\nx\n")
                               .value(0)),
                      "\xEF\xBB"
                      "y");

    // A line that is only a pair of quotes is an empty argument, which is the one way a response
    // file has of writing one. A line that is empty or only blanks is not an argument at all.
    {
        auto result = given("\"\"\n   \n\nsecond\n");
        BOOST_CHECK_EQUAL(must(result.value(0)), "");
        BOOST_CHECK_EQUAL(must(result.value(1)), "second");
    }

    // CRLF is taken off wherever the file was written and whatever it is read on.
    {
        auto result = given("-f\r\n\"one two\"\r\nthree\r\n");
        BOOST_CHECK(result.option("-f").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "one two");
        BOOST_CHECK_EQUAL(must(result.value(1)), "three");
    }

    // Read as bytes, so nothing in the file is interpreted. A Windows text stream takes a Ctrl-Z
    // for the end of the file, which would drop everything a response file has after one.
    {
        auto result = given("one\n\x1a"
                            "two\n");
        BOOST_CHECK_EQUAL(must(result.value(0)), "one");
        BOOST_CHECK_EQUAL(must(result.value(1)), "\x1a"
                                                 "two");
    }

    std::filesystem::remove(path);
}

// The name after the @ is UTF-8 like everything else here. Handing it to ifstream as a narrow
// string reads it in the system code page on Windows, so a file whose name is not ASCII is
// reported missing while sitting there.
BOOST_AUTO_TEST_CASE(test_a_response_file_is_found_by_a_name_that_is_not_ascii) {
    auto path = std::filesystem::temp_directory_path() /
                stdc::path::from_utf8("stdc_cli_\xe5\x93\x8d\xe5\xba\x94.txt");
    {
        std::ofstream file(path, std::ios::binary);
        file << "one\ntwo\n";
    }

    Parser parser(Command("prog").addArguments({Argument("a"), Argument("b")}));
    auto result = ok(parser, {"@" + stdc::path::to_utf8(path)}, Parser::EnableResponseFile);
    BOOST_CHECK_EQUAL(must(result.value(0)), "one");
    BOOST_CHECK_EQUAL(must(result.value(1)), "two");

    std::filesystem::remove(path);
}

BOOST_AUTO_TEST_CASE(test_an_empty_command_line_is_not_an_error_by_itself) {
    // Nothing declared, nothing given, nothing wrong. argparse tests this one because it is easy
    // to write a parser that trips over it.
    Parser parser(Command("prog"));
    BOOST_CHECK(parser.parse({}).isValid());
    BOOST_CHECK(parser.parse({"prog"}).isValid());
}

// ---------------------------------------------------------------------------------------------
// The help text
// ---------------------------------------------------------------------------------------------

namespace {

    /// Where \a needle starts, so that two of them can be compared for order.
    size_t at(const std::string &text, std::string_view needle) {
        auto pos = text.find(needle);
        BOOST_REQUIRE_MESSAGE(pos != std::string::npos, "\"" << needle << "\" is nowhere in:\n"
                                                             << text);
        return pos;
    }

    bool has(const std::string &text, std::string_view needle) {
        return text.find(needle) != std::string::npos;
    }

    /// The column the description starts at on the line holding \a left, for the cases about
    /// lining things up.
    size_t descriptionColumn(const std::string &text, std::string_view left) {
        auto start = text.rfind('\n', at(text, left)) + 1;
        auto line = text.substr(start, text.find('\n', start) - start);
        auto after = line.find(left) + left.size();
        auto column = line.find_first_not_of(' ', after);
        BOOST_REQUIRE_MESSAGE(column != std::string::npos, "nothing after \"" << left << "\"");
        return column;
    }

    Parser helpTree() {
        CommandCatalogue catalogue;
        catalogue.addCommands("Filesystem Commands", {"copy"})
            .addCommands("Buildsystem Commands", {"configure"});

        Parser parser(
            Command("prog", "What the program is for")
                .addOptions({Option(Option::Help), Option({"-V"}, "Say more").recursive()})
                .addCommands({
                    Command("copy", "Copy things")
                        .addArguments(
                            {Argument("src", "Where from").multi(), Argument("dest", "Where to")})
                        .addOption(Option({"-f", "--force"}, "Overwrite")),
                    Command("configure", "Configure things")
                        .addArgument(Argument("mode", "Which way", false)
                                         .defaultValue("fast")
                                         .expect({"fast", "slow"}))
                        .addOption(Option({"-p"}, "Project").arg("name").required()),
                    Command("orphan", "Not in any group"),
                })
                .setCatalogue(catalogue));
        parser.setPrologue("A prologue line");
        parser.setEpilogue("An epilogue line");
        // Fixed, so that what these cases assert does not depend on the terminal the suite
        // happens to run under, nor on whether COLUMNS is set in the environment.
        parser.setTextWidth(80);
        return parser;
    }

}

BOOST_AUTO_TEST_CASE(test_help_layout_is_in_a_fixed_order) {
    auto text = helpTree().parse(argv({})).helpText();

    BOOST_CHECK(at(text, "A prologue line") < at(text, "What the program is for"));
    BOOST_CHECK(at(text, "What the program is for") < at(text, "Usage:"));
    BOOST_CHECK(at(text, "Usage:") < at(text, "Options:"));
    BOOST_CHECK(at(text, "Options:") < at(text, "Filesystem Commands:"));
    BOOST_CHECK(at(text, "Filesystem Commands:") < at(text, "An epilogue line"));

    // One blank line between any two blocks, none above the first and none below the last.
    // Only the relative order was ever checked, which left a blank line at the very top for
    // nothing to notice.
    BOOST_CHECK_EQUAL(text.rfind("A prologue line", 0), 0u);
    BOOST_CHECK(!has(text, "\n\n\n"));
    BOOST_CHECK(has(text, "An epilogue line\n"));
    BOOST_CHECK(!has(text, "An epilogue line\n\n"));
}

BOOST_AUTO_TEST_CASE(test_usage_names_the_path_it_took) {
    auto parser = helpTree();
    BOOST_CHECK(has(parser.parse(argv({})).helpText(), "Usage:\n    prog [commands] [options]"));
    BOOST_CHECK(has(parser.parse(argv({"copy", "a", "b"})).helpText(),
                    "Usage:\n    prog copy [options] <src>... <dest>"));
    // An optional argument is bracketed, and one that repeats carries the ellipsis. The only
    // option this command declares is a required one, so it is spelled out, and the hint stands
    // for the root's global that it inherited.
    BOOST_CHECK(has(parser.parse(argv({"configure"})).helpText(),
                    "Usage:\n    prog configure -p <name> [options] [<mode>]"));
}

// A subcommand's name comes first or not at all, so it is written first. The line used to read
// "prog [options] [commands]", which is the one arrangement the parser refuses.
BOOST_AUTO_TEST_CASE(test_usage_writes_a_subcommand_before_the_options) {
    Parser parser(Command("prog")
                      .addOption(Option({"--plain"}, "Plain"))
                      .addCommand(Command("build").addArgument(Argument("target"))));
    BOOST_CHECK(has(parser.parse(argv({})).helpText(), "Usage:\n    prog [commands] [options]\n"));

    // What the usage line shows is what the parser takes, and the order it no longer shows is
    // the order it refuses.
    BOOST_CHECK_EQUAL(ok(parser, {"build", "x"}).command()->name(), "build");
    BOOST_CHECK(ok(parser, {"--plain"}).option("--plain").has_value());
    bad(parser, {"--plain", "build", "x"}, ParseResult::UnknownCommand);

    // Subcommands and nothing else to say.
    Parser bare(Command("prog").addCommand(Command("build")));
    BOOST_CHECK(has(bare.parse(argv({})).helpText(), "Usage:\n    prog [commands]\n"));

    // No subcommands, so nothing in front of the options.
    Parser flat(
        Command("prog").addArgument(Argument("path")).addOption(Option({"-v"}, "Say more")));
    BOOST_CHECK(has(flat.parse(argv({"x"})).helpText(), "Usage:\n    prog [options] <path>\n"));

    // A command that was reached says nothing about commands unless it has some of its own.
    BOOST_CHECK(
        has(parser.parse(argv({"build", "x"})).helpText(), "Usage:\n    prog build <target>\n"));
}

// An option that has to be given belongs on the usage line. Left inside "[options]" it is
// indistinguishable from the ones that can be left out, which is the one thing about it that
// matters.
BOOST_AUTO_TEST_CASE(test_usage_spells_out_the_options_that_are_required) {
    // Its first spelling and whatever it takes, in the order they were declared, ahead of the
    // hint that stands for the rest.
    {
        Parser parser(
            Command("prog")
                .addArgument(Argument("path"))
                .addOption(Option({"-o", "--output"}, "Where to write").arg("file").required())
                .addOption(Option({"-v"}, "Say more")));
        BOOST_CHECK(
            has(parser.parse(argv({})).helpText(), "Usage:\n    prog -o <file> [options] <path>"));
    }

    // More than one, and no hint left when every option is accounted for.
    {
        Parser parser(Command("prog")
                          .addOption(Option({"-i"}, "In").arg("in").required())
                          .addOption(Option({"-o"}, "Out").arg("out").required()));
        BOOST_CHECK(has(parser.parse(argv({"-i", "a", "-o", "b"})).helpText(),
                        "Usage:\n    prog -i <in> -o <out>\n"));
    }

    // Nothing required reads as it did before.
    {
        Parser parser(Command("prog").addOption(Option({"-v"}, "Say more")));
        BOOST_CHECK(has(parser.parse(argv({})).helpText(), "Usage:\n    prog [options]\n"));
    }

    // An option carrying an optional argument of its own keeps that argument's brackets.
    {
        Parser parser(
            Command("prog").addOption(Option({"-c"}, "Config").arg("file", false).required()));
        BOOST_CHECK(has(parser.parse(argv({"-c"})).helpText(), "Usage:\n    prog -c [<file>]\n"));
    }

    // A subcommand's own required options, on its own usage line.
    {
        Parser parser(Command("prog").addCommand(
            Command("build").addOption(Option({"-t"}, "Target").arg("name").required())));
        auto text = parser.parse(argv({"build", "-t", "x"})).helpText();
        BOOST_CHECK(has(text, "Usage:\n    prog build -t <name>\n"));
    }

#ifdef NDEBUG
    // An option with no spelling cannot be typed, so it is not in the hint either. It used to
    // be counted, which put "[options]" on a command that had nothing to offer. Adding one is
    // a mistake parse() asserts through validate() in a debug build, and this is what happens
    // where it does not. \sa test_an_option_with_no_spelling_is_ignored_rather_than_fatal
    {
        Parser parser(Command("prog").addOption(Option()));
        BOOST_CHECK(has(parser.parse(argv({})).helpText(), "Usage:\n    prog\n"));
    }
#endif
}

BOOST_AUTO_TEST_CASE(test_a_catalogue_names_the_headings_and_keeps_their_order) {
    auto text = helpTree().parse(argv({})).helpText();

    BOOST_CHECK(at(text, "Filesystem Commands:") < at(text, "Buildsystem Commands:"));
    // What the catalogue does not mention still shows, under the usual heading, at the end.
    // Anchored to the start of a line, since "Commands:" is a tail of the headings above it.
    BOOST_CHECK(at(text, "Buildsystem Commands:") < at(text, "\nCommands:"));
    BOOST_CHECK(at(text, "\nCommands:") < at(text, "orphan"));

    // Every command appears exactly once, wherever it was put.
    for (auto name : {"copy", "configure", "orphan"}) {
        BOOST_CHECK_MESSAGE(has(text, name), name);
    }
}

BOOST_AUTO_TEST_CASE(test_aligning_all_catalogues_shares_one_column) {
    auto parser = helpTree();

    parser.setDisplayOptions(Parser::Normal);
    auto apart = parser.parse(argv({})).helpText();
    // Group by group, a short group is narrow.
    BOOST_CHECK(descriptionColumn(apart, "copy") < descriptionColumn(apart, "-h, --help"));

    parser.setDisplayOptions(Parser::AlignAllCatalogues);
    auto together = parser.parse(argv({})).helpText();
    BOOST_CHECK_EQUAL(descriptionColumn(together, "copy"),
                      descriptionColumn(together, "configure"));
    BOOST_CHECK_EQUAL(descriptionColumn(together, "copy"),
                      descriptionColumn(together, "-h, --help"));
}

BOOST_AUTO_TEST_CASE(test_the_extras_are_asked_for) {
    auto parser = helpTree();

    auto plain = parser.parse(argv({"configure"})).helpText();
    BOOST_CHECK(!has(plain, "default:"));
    BOOST_CHECK(!has(plain, "fast, slow"));
    BOOST_CHECK(!has(plain, "(required)"));

    parser.setDisplayOptions(Parser::ShowArgumentDefaultValue | Parser::ShowArgumentExpectedValues |
                             Parser::ShowOptionIsRequired);
    auto full = parser.parse(argv({"configure"})).helpText();
    BOOST_CHECK(has(full, "(default: fast)"));
    BOOST_CHECK(has(full, "[fast, slow]"));
    BOOST_CHECK(has(full, "(required)"));
}

BOOST_AUTO_TEST_CASE(test_an_options_own_argument_carries_its_extras_too) {
    Parser parser(Command("prog").addOption(
        Option({"-l"}, "How loud")
            .arg(Argument("n", {}, false).defaultValue("1").expect({"0", "1", "2"}))));
    parser.setDisplayOptions(Parser::ShowArgumentDefaultValue | Parser::ShowArgumentExpectedValues);

    auto text = parser.parse(argv({})).helpText();
    BOOST_CHECK(has(text, "-l [<n>]"));
    BOOST_CHECK(has(text, "(default: 1)"));
    BOOST_CHECK(has(text, "[0, 1, 2]"));
}

BOOST_AUTO_TEST_CASE(test_roles_describe_themselves) {
    // The two options every program has are otherwise the two with nothing written beside them,
    // which is where a generated help text starts looking unfinished.
    Parser parser(Command("prog").addOptions({Option(Option::Help), Option(Option::Version)}));
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "Show this help and exit"));
    BOOST_CHECK(has(text, "Show the version and exit"));

    // A description of one's own wins.
    Parser named(Command("prog").addOption(Option(Option::Help, {}, "Read this")));
    BOOST_CHECK(has(named.parse(argv({})).helpText(), "Read this"));
    BOOST_CHECK(!has(named.parse(argv({})).helpText(), "Show this help"));
}

BOOST_AUTO_TEST_CASE(test_help_of_a_command_that_was_never_reached_is_empty) {
    // A default constructed result has no command, and asking it for help is empty rather than
    // a walk off the end.
    ParseResult empty;
    BOOST_CHECK(empty.helpText().empty());
    BOOST_CHECK(empty.command() == nullptr);
}

BOOST_AUTO_TEST_CASE(test_a_parser_can_be_built_and_returned) {
    // helpTree() above returns a named local, which needs the move that deleting the copy
    // suppressed. This is the case that found it.
    auto parser = helpTree();
    BOOST_CHECK_EQUAL(parser.rootCommand().name(), "prog");
    BOOST_CHECK_EQUAL(parser.prologue(), "A prologue line");

    Parser moved = std::move(parser);
    BOOST_CHECK_EQUAL(moved.rootCommand().name(), "prog");
    BOOST_CHECK(moved.parse(argv({"copy", "a", "b"})).isValid());

    // And assigned over one that already holds a tree, which is what a parser kept as a member
    // and rebuilt later goes through. Only the constructor had ever been used.
    Parser assigned(Command("placeholder"));
    assigned = std::move(moved);
    BOOST_CHECK_EQUAL(assigned.rootCommand().name(), "prog");
    BOOST_CHECK(assigned.parse(argv({"copy", "a", "b"})).isValid());
}

// Every setting a parser takes read back off it. A program that wraps one of these, which is what
// a help formatter of its own has to do, asks for all of them, and none but the two widths had
// ever been called.
BOOST_AUTO_TEST_CASE(test_a_parser_answers_for_what_it_was_told) {
    Parser parser;
    BOOST_CHECK(parser.prologue().empty());
    BOOST_CHECK(parser.epilogue().empty());
    BOOST_CHECK(parser.displayOptions() == Parser::Normal);
    BOOST_CHECK_EQUAL(parser.textWidth(), 0);
    BOOST_CHECK_EQUAL(parser.indent(), 4);
    BOOST_CHECK_EQUAL(parser.spacing(), 4);
    // Not empty by default: a parser that was told nothing still lays a help text out.
    BOOST_CHECK(!parser.helpLayout().isEmpty());

    parser.setRootCommand(Command("prog"));
    parser.setPrologue("A prologue line");
    parser.setEpilogue("An epilogue line");
    parser.setDisplayOptions(Parser::AlignAllCatalogues | Parser::ShowOptionIsRequired);
    parser.setTextWidth(72);
    parser.setIndent(2);
    parser.setSpacing(3);

    HelpLayout layout;
    layout.add(HelpBlock::Usage).add(HelpBlock::Options);
    parser.setHelpLayout(layout);

    BOOST_CHECK_EQUAL(parser.rootCommand().name(), "prog");
    BOOST_CHECK_EQUAL(parser.prologue(), "A prologue line");
    BOOST_CHECK_EQUAL(parser.epilogue(), "An epilogue line");
    BOOST_CHECK(parser.displayOptions() ==
                (Parser::AlignAllCatalogues | Parser::ShowOptionIsRequired));
    BOOST_CHECK_EQUAL(parser.textWidth(), 72);
    BOOST_CHECK_EQUAL(parser.indent(), 2);
    BOOST_CHECK_EQUAL(parser.spacing(), 3);
    BOOST_REQUIRE_EQUAL(parser.helpLayout().blocks().size(), 2u);
    BOOST_CHECK_EQUAL(int(parser.helpLayout().blocks().front().role), int(HelpBlock::Usage));
}

// A catalogue groups arguments and options as well as commands, and only the command half was
// ever rendered. Everything not named by a group stays under the plain heading at the end, so
// what this pins is the order and the leftovers, not just that the headings appear.
BOOST_AUTO_TEST_CASE(test_a_catalogue_groups_arguments_and_options_too) {
    // An option is matched by its first spelling, which is what token() answers.
    CommandCatalogue catalogue;
    catalogue.addArguments("Inputs", {"source"})
        .addArguments("Outputs", {"dest"})
        .addOptions("Common Options", {"-f"})
        .addOptions("Rare Options", {"-m"});

    Parser parser(Command("prog", "Something")
                      .addArguments({Argument("source", "Where from"), Argument("dest", "Where to"),
                                     Argument("extra", "An ungrouped argument")})
                      .addOptions({Option({"-f", "--force"}, "Overwrite"),
                                   Option({"-m", "--mode"}, "How").arg("name"),
                                   Option({"-q"}, "An ungrouped option")})
                      .setCatalogue(catalogue));
    parser.setTextWidth(80);
    auto text = parser.parse(argv({})).helpText();

    // The fallback headings are searched for with the newline in front, since "Options:" is a
    // substring of "Common Options:" and would be found in it.
    BOOST_CHECK(at(text, "Inputs:") < at(text, "Outputs:"));
    BOOST_CHECK(at(text, "Outputs:") < at(text, "\nArguments:"));
    BOOST_CHECK(at(text, "\nArguments:") < at(text, "Common Options:"));
    BOOST_CHECK(at(text, "Common Options:") < at(text, "Rare Options:"));
    BOOST_CHECK(at(text, "Rare Options:") < at(text, "\nOptions:"));

    // And the rows land under the heading that asked for them rather than all under the fallback.
    BOOST_CHECK(at(text, "Inputs:") < at(text, "Where from"));
    BOOST_CHECK(at(text, "Where from") < at(text, "Outputs:"));
    BOOST_CHECK(at(text, "\nArguments:") < at(text, "An ungrouped argument"));
    BOOST_CHECK(at(text, "Common Options:") < at(text, "Overwrite"));
    BOOST_CHECK(at(text, "Overwrite") < at(text, "Rare Options:"));
    BOOST_CHECK(at(text, "\nOptions:") < at(text, "An ungrouped option"));
}

// ---------------------------------------------------------------------------------------------
// Shapes a whole program asks for
//
// Transcribing a real build tool's command tree against this library turned up three things
// nothing above had declared. They are here as what they are rather than as whose they were:
// which program wanted them is that program's business, and its own suite is where it belongs.
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_an_option_carrying_two_arguments) {
    // One option, a pair of values, given more than once. Nothing above declares one, and a tool
    // that maps patterns onto directories is built out of little else.
    Parser parser(Command("prog")
                      .addArguments({Argument("src"), Argument("dest")})
                      .addOptions({Option({"-i", "--include"}, "A pattern and its subdirectory")
                                       .arg("regex")
                                       .arg("subdir")
                                       .multi(),
                                   Option({"-e", "--exclude"}, "A pattern").arg("regex").multi()}));

    auto result = ok(parser, {"src", "dst", "-i", "a", "x", "-i", "b", "y", "-e", "z"});
    BOOST_CHECK_EQUAL(must(result.value(0)), "src");
    BOOST_CHECK_EQUAL(must(result.value(1)), "dst");

    auto given = result.option("-i");
    BOOST_REQUIRE(given.has_value());
    const auto &include = *given;
    BOOST_REQUIRE_EQUAL(include.count(), 2);
    // Slot by slot within one occurrence, which is the only way a pair means anything.
    BOOST_CHECK_EQUAL(must(include.at(0).rawValue(0)), "a");
    BOOST_CHECK_EQUAL(must(include.at(0).rawValue(1)), "x");
    BOOST_CHECK_EQUAL(must(include.at(1).rawValue(0)), "b");
    BOOST_CHECK_EQUAL(must(include.at(1).rawValue(1)), "y");
    // Or everything one slot ever took, across every occurrence.
    BOOST_CHECK(include.allRawValues(0) == std::vector<std::string_view>({"a", "b"}));
    BOOST_CHECK(include.allRawValues(1) == std::vector<std::string_view>({"x", "y"}));

    // Both of a pair are required, so half of one is a diagnostic.
    bad(parser, {"src", "dst", "-i", "a"}, ParseResult::MissingOptionArgument);

    // Unless the option says its own missing arguments are no matter.
    Parser lenient(Command("prog").addOption(Option({"-c"}, "A pair")
                                                 .arg("src")
                                                 .arg("dir")
                                                 .multi()
                                                 .prior(Option::IgnoreMissingArguments)));
    BOOST_CHECK(ok(lenient, {"-c"}).option("-c").has_value());
    BOOST_CHECK_EQUAL(must(ok(lenient, {"-c", "a", "b"}).option("-c")->rawValue(1)), "b");
}

BOOST_AUTO_TEST_CASE(test_the_two_options_every_program_has) {
    // Written out by hand these need the right prior level to work at all, which is a thing to
    // know rather than a thing to guess.
    Parser parser(Command("prog")
                      .addArgument(Argument("required one"))
                      .addVersionOption("1.2.3")
                      .addHelpOption(true, true)
                      .addCommand(Command("copy").addArgument(Argument("src"))));

    // A bare program name prints help rather than complaining about what is missing.
    auto bare = ok(parser, {});
    BOOST_CHECK(bare.isRoleSet(Option::Help));

    // Asked for on a line that is missing everything, it is still answered.
    BOOST_CHECK(ok(parser, {"--help"}).isRoleSet(Option::Help));
    BOOST_CHECK(ok(parser, {"--version"}).isRoleSet(Option::Version));

    // Global, so the subcommands have it too.
    BOOST_CHECK(ok(parser, {"copy", "--help"}).isRoleSet(Option::Help));

    // The version is kept on the command, which is what the option is there to print.
    BOOST_CHECK_EQUAL(parser.rootCommand().version(), "1.2.3");

    // Spellings and descriptions can still be the caller's.
    Parser renamed(Command("prog").addHelpOption(false, false, {"-?"}, "How to use this"));
    BOOST_CHECK(ok(renamed, {"-?"}).isRoleSet(Option::Help));
    BOOST_CHECK(has(renamed.parse(argv({})).helpText(), "How to use this"));
}

BOOST_AUTO_TEST_CASE(test_a_tree_of_several_commands_reads_as_one_page) {
    CommandCatalogue catalogue;
    catalogue.addCommands("Filesystem Commands", {"copy", "rmdir", "touch"})
        .addCommands("Buildsystem Commands", {"configure", "incsync", "deploy"});

    Command root("tool", "Utility commands");
    for (auto [name, desc] : {
             std::pair{"copy",      "Copy files"          },
             {"rmdir",     "Remove directories"  },
             {"touch",     "Update timestamps"   },
             {"configure", "Generate a header"   },
             {"incsync",   "Reorganize headers"  },
             {"deploy",    "Resolve dependencies"}
    }) {
        root.addCommand(Command(name, desc).addArgument(Argument("path").multi()));
    }
    root.addVersionOption("1.0").addHelpOption(true, true).setCatalogue(catalogue);

    Parser parser(std::move(root));
    parser.setDisplayOptions(Parser::AlignAllCatalogues);
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(at(text, "Filesystem Commands:") < at(text, "Buildsystem Commands:"));
    for (auto name : {"copy", "rmdir", "touch", "configure", "incsync", "deploy"}) {
        BOOST_CHECK_MESSAGE(has(text, name), name);
    }
    // Six commands over two headings still line up as one table.
    BOOST_CHECK_EQUAL(descriptionColumn(text, "copy"), descriptionColumn(text, "configure"));

    // And the tree still parses, which a help text alone would not say.
    BOOST_CHECK_EQUAL(ok(parser, {"deploy", "a", "b"}).command()->name(), "deploy");
}

// ---------------------------------------------------------------------------------------------
// Degenerate trees and misuse
//
// Everything above describes a program using the library correctly, which is why none of it
// noticed the defects this section is written for. Breaking a line on purpose says whether the
// tests watch that line. It says nothing about a shape no test builds, and the mutations all
// passed while these went unseen.
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_an_option_with_no_spelling_is_ignored_rather_than_fatal) {
    // token() is front() on a vector that a default constructed Option leaves empty, and the
    // help text used to call it on every option there was.
    //
    // The catalogue is what makes this bite: the name of an option is asked for only while
    // matching it against a group, so a tree without one never calls token() at all. That is
    // also why a first attempt at this test passed with the defect still in.
    // A mistake, and said so wherever the question is asked: an option nobody can type is an
    // option nobody can give.
    BOOST_CHECK(!detail::options_can_join({}, Option()));
    BOOST_CHECK(!detail::options_can_join({}, Option(Option::NoRole)));

#ifdef NDEBUG
    // Parsed anyway, since parse() does not walk the tree in a release build.
    CommandCatalogue catalogue;
    catalogue.addOptions("Common Options", {"-f"});

    Parser parser(Command("prog", "Something")
                      .addOption(Option())
                      .addOption(Option(Option::NoRole))
                      .addOption(Option({"-f"}, "Force"))
                      .setCatalogue(catalogue));

    auto text = parser.parse(argv({})).helpText();
    BOOST_CHECK(has(text, "Common Options:"));
    BOOST_CHECK(has(text, "-f"));
    BOOST_CHECK(has(text, "Force"));

    // It parses too, and is simply not something that can be written.
    BOOST_CHECK(ok(parser, {"-f"}).option("-f").has_value());
    BOOST_CHECK(!ok(parser, {}).option("").has_value());
#endif
}

BOOST_AUTO_TEST_CASE(test_a_result_outlives_the_parse_and_the_tree_it_read) {
    // The result holds pointers into the command tree, kept alive by sharing it. Handing the
    // parser a new tree used to write over the old one, and every result already out was reading
    // freed vectors.
    Parser parser(Command("first").addCommand(
        Command("copy").addArgument(Argument("src")).addOption(Option({"-f"}, "Force"))));

    auto result = parser.parse(argv({"copy", "-f", "x"}));
    BOOST_REQUIRE(result.isValid());
    BOOST_CHECK_EQUAL(result.command()->name(), "copy");

    Command replacement("second");
    for (int i = 0; i < 64; ++i) {
        replacement.addCommand(
            Command("filler" + std::to_string(i)).addOption(Option({"-x" + std::to_string(i)})));
    }
    parser.setRootCommand(std::move(replacement));

    // The old answer is still the old answer, about the tree it was an answer to.
    BOOST_CHECK_EQUAL(result.command()->name(), "copy");
    BOOST_CHECK_EQUAL(must(result.value(0)), "x");
    BOOST_CHECK(result.option("-f").has_value());
    BOOST_CHECK(has(result.helpText(), "Force"));

    // And the parser answers about the new one.
    BOOST_CHECK_EQUAL(parser.rootCommand().name(), "second");
    BOOST_CHECK(parser.parse(argv({"filler3"})).isValid());
}

BOOST_AUTO_TEST_CASE(test_a_result_outlives_the_parser) {
    ParseResult result;
    {
        Parser parser(Command("prog").addArgument(Argument("path")));
        result = parser.parse(argv({"x"}));
    }
    BOOST_REQUIRE(result.isValid());
    BOOST_CHECK_EQUAL(result.command()->name(), "prog");
    BOOST_CHECK_EQUAL(must(result.value(0)), "x");
}

BOOST_AUTO_TEST_CASE(test_reading_with_a_type_the_argument_never_declared) {
    // Nothing can catch this while compiling, because the declared type lives in the Argument
    // and not in the caller's template argument. The conversion is the check.
    Parser parser(Command("prog").addArgument(Argument("name")));
    auto result = ok(parser, {"not-a-number"});

    BOOST_CHECK(!result.value<int>(0).has_value());
    // The caller says what to use instead where they read it, rather than seeding a variable
    // beforehand and hoping the read left it alone.
    BOOST_CHECK_EQUAL(result.value<int>(0).value_or(12345), 12345);

    // What is there and does convert comes back holding it.
    auto number_result = ok(Parser(Command("prog").addArgument(Argument("n"))), {"42"});
    BOOST_CHECK_EQUAL(must(number_result.value<int>(0)), 42);

    // Nothing and a zero are different answers, which is the whole reason for the optional. A
    // bare int return had one answer for both.
    Parser optional(Command("prog").addArgument(Argument("n").optional()));
    BOOST_CHECK(!ok(optional, {}).value<int>(0).has_value());
    BOOST_CHECK_EQUAL(must(ok(optional, {"0"}).value<int>(0)), 0);
    BOOST_CHECK_EQUAL(ok(optional, {"0"}).value<int>(0).value_or(99), 0);

    // The default value stands in, so it is something rather than nothing.
    Parser defaulted(
        Command("prog").addArgument(Argument("n").optional().defaultValue("5").type<int>()));
    BOOST_CHECK_EQUAL(ok(defaulted, {}).value<int>(0).value_or(99), 5);

    // An index nobody declared is nothing, not an empty string.
    BOOST_CHECK(!result.value(7).has_value());
    BOOST_CHECK(!result.value(-1).has_value());
    BOOST_CHECK(!result.rawValue(7).has_value());

    static_assert(std::is_same_v<decltype(result.value(0)), std::optional<std::string>>,
                  "the read defaults to a type that owns what it holds");
}

BOOST_AUTO_TEST_CASE(test_the_checking_read_on_an_option) {
    Parser parser(Command("prog").addOption(Option({"-n"}, "How many").arg("count")));

    // Not given at all, so there is no OptionResult to read from in the first place.
    BOOST_CHECK(!ok(parser, {}).option("-n").has_value());
    // Given, but what it carries is not a number.
    BOOST_CHECK(!ok(parser, {"-n", "many"}).option("-n")->value<int>().has_value());
    BOOST_CHECK_EQUAL(must(ok(parser, {"-n", "7"}).option("-n")->value<int>()), 7);

    // And through the shortcut, which has to answer the same as the long way round.
    BOOST_CHECK(!ok(parser, {}).valueForOption<int>("-n").has_value());
    BOOST_CHECK_EQUAL(must(ok(parser, {"-n", "7"}).valueForOption<int>("-n")), 7);

    // An option that was never declared is nothing, not a zero.
    BOOST_CHECK(!ok(parser, {}).valueForOption<int>("-x").has_value());

    // An option given an empty value has a value, and it is the empty string. Whether a token
    // is there and whether the token is empty are different questions, and empty text cannot
    // answer both, which is why the read hands back an optional rather than a view.
    Parser prefix(Command("prog").addOption(Option({"--prefix"}, "Prefix").arg("text")));
    for (const auto &given : {
             std::vector<std::string>{"prog", "--prefix="},
             std::vector<std::string>{"prog", "--prefix", ""}
    }) {
        auto result = prefix.parse(given);
        BOOST_REQUIRE_MESSAGE(result.isValid(), result.errorText());
        auto option = result.option("--prefix");
        BOOST_REQUIRE(option.has_value());
        BOOST_CHECK_EQUAL(must(option->value()), "");
        BOOST_CHECK_EQUAL(must(option->rawValue()), "");
        // As a number it is still nothing, since an empty token is not one.
        BOOST_CHECK(!option->value<int>().has_value());
    }

    // Never given is nothing at all, which is the case the empty one used to be lumped in with.
    // The result is held rather than read off a temporary, since an OptionResult owns nothing.
    auto empty = ok(prefix, {});
    BOOST_CHECK(!empty.option("--prefix").has_value());
    BOOST_CHECK(!empty.valueForOption("--prefix").has_value());
}

// An argument given an empty string has a value, and no isSet() exists to fall back on.
BOOST_AUTO_TEST_CASE(test_an_argument_given_an_empty_string_has_a_value) {
    Parser parser(Command("prog").addArgument(Argument("name").optional()));

    auto given = parser.parse({"prog", ""});
    BOOST_REQUIRE_MESSAGE(given.isValid(), given.errorText());
    BOOST_CHECK_EQUAL(must(given.value(0)), "");
    BOOST_CHECK_EQUAL(must(given.rawValue(0)), "");

    auto omitted = ok(parser, {});
    BOOST_CHECK(!omitted.rawValue(0).has_value());
    BOOST_CHECK(!omitted.value(0).has_value());

    // A default value is a token like any other, so it counts as having one.
    Parser defaulted(Command("prog").addArgument(Argument("name").optional().defaultValue("x")));
    BOOST_CHECK_EQUAL(must(ok(defaulted, {}).value(0)), "x");
}

BOOST_AUTO_TEST_CASE(test_a_tree_with_nothing_in_it) {
    // Every accessor answering something rather than walking off an end.
    Parser parser;
    BOOST_CHECK_EQUAL(parser.rootCommand().name(), "");

    auto result = parser.parse({});
    BOOST_CHECK(result.isValid());
    BOOST_REQUIRE(result.command() != nullptr);
    BOOST_CHECK(!result.rawValue(0).has_value());
    BOOST_CHECK(result.rawValues(0).empty());
    BOOST_CHECK(!result.option("-f").has_value());
    BOOST_CHECK(!result.valueForOption("-f").has_value());
    BOOST_CHECK(!result.isRoleSet(Option::Help));
    // NoRole is never set, whatever is in the tree, or every option would answer to it.
    BOOST_CHECK(!result.isRoleSet(Option::NoRole));
    BOOST_CHECK_EQUAL(result.invoke(-1), -1);
    // Nothing to say, so nothing said. A block with no contents is not printed, and a nameless
    // command with no arguments, options or subcommands leaves every block with no contents,
    // down to the usage line. It used to print a bare "Usage:" and the name that was not there.
    BOOST_CHECK(result.helpText().empty());
    BOOST_CHECK(result.helpBlocks().empty());
}

BOOST_AUTO_TEST_CASE(test_a_command_with_no_name) {
    // Nothing forbids it, so it has to come out the other side.
    Parser parser(Command("").addArgument(Argument("path")));
    auto result = ok(parser, {"x"});
    BOOST_CHECK_EQUAL(must(result.value(0)), "x");
    BOOST_CHECK(has(result.helpText(), "Usage:"));
}

// ---------------------------------------------------------------------------------------------
// What a whole program does, from argv to a handler
// ---------------------------------------------------------------------------------------------

// The library declares these two roles, gives them their spellings and holds the version
// string, so it answers them. Leaving that to the caller meant a program written the obvious
// way ran the command for "prog copy --help" rather than describing it, and did whatever that
// command does. On a destructive command, --help was destructive.
BOOST_AUTO_TEST_CASE(test_invoke_answers_help_and_version_before_the_handler) {
    int ran = 0;
    const auto &tree = [&ran] {
        Parser parser(Command("prog", "What it is for")
                          .addVersionOption("1.2.3")
                          .addHelpOption(false, true)
                          .addCommand(Command("copy", "Copy things")
                                          .addArgument(Argument("src"))
                                          .setHandler([&ran](const ParseResult &) {
                                              ran++;
                                              return 7;
                                          })));
        parser.setTextWidth(80);
        return parser;
    };

    // The handler runs when nothing was asked for.
    {
        auto parser = tree();
        BOOST_CHECK_EQUAL(parser.invoke(argv({"copy", "x"})), 7);
        BOOST_CHECK_EQUAL(ran, 1);
    }

    // And does not when help was, which is the whole point.
    {
        ran = 0;
        auto parser = tree();
        int code = 0;
        auto printed = capturedStdout([&] { code = parser.invoke(argv({"copy", "--help"})); });
        BOOST_CHECK_EQUAL(code, 0);
        BOOST_CHECK_EQUAL(ran, 0);
        // The help of the command that was reached, not the root's.
        BOOST_CHECK(has(printed, "Usage:\n    prog copy"));
        BOOST_CHECK(has(printed, "Copy things"));
    }

    // The version, and no handler either.
    {
        ran = 0;
        auto parser = tree();
        int code = 0;
        auto printed = capturedStdout([&] { code = parser.invoke(argv({"--version"})); });
        BOOST_CHECK_EQUAL(code, 0);
        BOOST_CHECK_EQUAL(ran, 0);
        BOOST_CHECK_EQUAL(printed, "1.2.3\n");
    }

    // addVersionOption() takes no global flag where addHelpOption() does, so the version option
    // is the root's alone unless a program says otherwise, and a subcommand does not answer it.
    {
        auto parser = tree();
        BOOST_CHECK(!parser.parse(argv({"copy", "x", "--version"})).isValid());
    }

    // Asked for both, help answers. It is the one that says what the other is.
    {
        auto parser = tree();
        auto printed = capturedStdout([&] { parser.invoke(argv({"--help", "--version"})); });
        BOOST_CHECK(has(printed, "Usage:"));
        BOOST_CHECK(!has(printed, "1.2.3\n"));
    }

    // A parse that failed is reported rather than left for the caller to notice, since the
    // return value of this is what main returns and there is nowhere else for it to be said.
    {
        ran = 0;
        auto parser = tree();
        int code = 0;
        auto complaint = capturedStderr([&] { code = parser.invoke(argv({"copy"})); });
        BOOST_CHECK_EQUAL(code, -1);
        BOOST_CHECK_EQUAL(ran, 0);
        BOOST_CHECK(has(complaint, "needs a value"));
        BOOST_CHECK(has(complaint, "Try \"prog copy --help\""));
    }

    // A command with no handler still answers what it was asked.
    {
        Parser bare(Command("prog", "What it is for").addHelpOption());
        bare.setTextWidth(80);
        BOOST_CHECK_EQUAL(bare.invoke(argv({})), -1);
        int code = 0;
        auto printed = capturedStdout([&] { code = bare.invoke(argv({"--help"})); });
        BOOST_CHECK_EQUAL(code, 0);
        BOOST_CHECK(has(printed, "Usage:"));
    }

    // A version option with nothing to print is not an answer, so the handler runs as usual.
    {
        ran = 0;
        Parser silent(Command("prog")
                          .addOption(Option(Option::Version))
                          .setHandler([&ran](const ParseResult &) {
                              ran++;
                              return 4;
                          }));
        BOOST_CHECK_EQUAL(silent.invoke(argv({"--version"})), 4);
        BOOST_CHECK_EQUAL(ran, 1);
    }
}

// The innermost command on the path that was given one.
BOOST_AUTO_TEST_CASE(test_which_version_a_result_answers_with) {
    Parser parser(Command("prog")
                      .setVersion("1.0")
                      .addCommand(Command("build").setVersion("2.0").addCommand(Command("deep")))
                      .addCommand(Command("clean")));

    BOOST_CHECK_EQUAL(parser.parse(argv({})).versionText(), "1.0");
    // Its own beats the one above it.
    BOOST_CHECK_EQUAL(parser.parse(argv({"build"})).versionText(), "2.0");
    // And is passed on down, since a command with none of its own says what its parent says.
    BOOST_CHECK_EQUAL(parser.parse(argv({"build", "deep"})).versionText(), "2.0");
    BOOST_CHECK_EQUAL(parser.parse(argv({"clean"})).versionText(), "1.0");

    // A tree that was never given one says nothing rather than making something up.
    BOOST_CHECK(Parser(Command("prog")).parse(argv({})).versionText().empty());
}

// ---------------------------------------------------------------------------------------------
// When it goes wrong: corrections and what is printed
// ---------------------------------------------------------------------------------------------

// A name spelled wrong is worth answering with the declared names it is close to. Without it a
// mistyped subcommand only ever says that it is unknown, which is the least useful true thing.
BOOST_AUTO_TEST_CASE(test_a_mistyped_name_is_answered_with_the_ones_it_is_near) {
    // a subcommand
    {
        Parser parser(Command("prog")
                          .addCommand(Command("copy"))
                          .addCommand(Command("move"))
                          .addCommand(Command("remove")));
        auto text = bad(parser, {"copyy"}, ParseResult::UnknownCommand).correctionText();
        BOOST_CHECK(has(text, "\"copyy\" is not matched"));
        BOOST_CHECK(has(text, "\n    copy"));
        BOOST_CHECK(!has(text, "\n  move"));
        BOOST_CHECK(!has(text, "\n  remove"));
    }

    // an option, matched against every spelling in scope rather than the first
    {
        Parser parser(Command("prog").addOptions({
            Option({"-v", "--verbose"}, "Say more"),
            Option({"--version"}, "Say which"),
        }));
        auto text = bad(parser, {"--verbse"}, ParseResult::UnknownOption).correctionText();
        BOOST_CHECK(has(text, "\n    --verbose"));
        BOOST_CHECK(has(text, "\n    --version"));
    }

    // one of the few words an argument accepts
    {
        Parser parser(
            Command("prog").addArgument(Argument("mode").expect({"fast", "slow", "careful"})));
        auto text = bad(parser, {"fest"}, ParseResult::InvalidArgumentValue).correctionText();
        BOOST_CHECK(has(text, "\n    fast"));
        BOOST_CHECK(!has(text, "\n  careful"));
    }

    // Nothing near it is answered with nothing, rather than with the whole list.
    {
        Parser parser(Command("prog").addCommand(Command("copy")));
        auto text = bad(parser, {"zzzzzzzz"}, ParseResult::UnknownCommand).correctionText();
        BOOST_CHECK(text.empty());
    }

    // A failure that is not a name spelled wrong has nothing to offer.
    {
        Parser parser(Command("prog").addArgument(Argument("needed")));
        auto text = bad(parser, {}, ParseResult::MissingCommandArgument).correctionText();
        BOOST_CHECK(text.empty());
    }

    // A clean parse likewise.
    {
        Parser parser(Command("prog").addCommand(Command("copy")));
        BOOST_CHECK(ok(parser, {"copy"}).correctionText().empty());
    }
}

// What showError() puts on stderr, since that is the whole point of measuring the distance.
BOOST_AUTO_TEST_CASE(test_show_error_offers_the_correction) {
    Parser parser(Command("prog")
                      .addOption(Option(Option::Help))
                      .addCommand(Command("copy"))
                      .addCommand(Command("move")));

    auto result = bad(parser, {"copyy"}, ParseResult::UnknownCommand);
    auto printed = capturedStderr([&] { result.showError(); });
    BOOST_CHECK(has(printed, "is not a command"));
    BOOST_CHECK(has(printed, "Do you mean"));
    BOOST_CHECK(has(printed, "copy"));
    BOOST_CHECK(has(printed, "Try \"prog --help\""));

    // Turned off, the error is still said and only the offer goes away.
    parser.setDisplayOptions(Parser::SkipCorrection);
    auto quiet = bad(parser, {"copyy"}, ParseResult::UnknownCommand);
    auto printed_quiet = capturedStderr([&] { quiet.showError(); });
    BOOST_CHECK(has(printed_quiet, "is not a command"));
    BOOST_CHECK(!has(printed_quiet, "Do you mean"));
    BOOST_CHECK(has(printed_quiet, "Try \"prog --help\""));
}

// The line that points at help names what this program calls it, rather than what most programs
// call it. It used to say --help whatever the tree declared, and a tree declaring none at all
// still got told to try one.
BOOST_AUTO_TEST_CASE(test_the_error_points_at_the_help_this_program_has) {
    const auto &printedFor = [](Command root) {
        Parser parser(std::move(root));
        auto result = parser.parse(argv({"nope"}));
        BOOST_REQUIRE(!result.isValid());
        return capturedStderr([&] { result.showError(); });
    };

    // The long spelling where there is one, since that is the one worth reading.
    BOOST_CHECK(has(printedFor(Command("prog").addOption(Option(Option::Help))),
                    "Try \"prog --help\" for more information."));

    // Whatever it is spelled instead.
    BOOST_CHECK(has(printedFor(Command("prog").addOption(
                        Option(Option::Help, {"-?", "--usage"}, "Say how to use this"))),
                    "Try \"prog --usage\" for more information."));
    BOOST_CHECK(has(
        printedFor(Command("prog").addOption(Option(Option::Help, {"-h"}, "Say how to use this"))),
        "Try \"prog -h\" for more information."));

    // A tree with none is told to try nothing.
    BOOST_CHECK(!has(printedFor(Command("prog")), "Try "));

    // An option is not the help option merely by being spelled like one.
    BOOST_CHECK(
        !has(printedFor(Command("prog").addOption(Option({"--help"}, "Not the role"))), "Try "));

    // A subcommand names itself and the option it inherited.
    Parser parser(Command("prog")
                      .addOption(Option(Option::Help).recursive())
                      .addCommand(Command("build").addArgument(Argument("target"))));
    auto result = parser.parse(argv({"build"}));
    BOOST_REQUIRE(!result.isValid());
    BOOST_CHECK(has(capturedStderr([&] { result.showError(); }),
                    "Try \"prog build --help\" for more information."));
}

// The overload that takes what main was handed, rather than making every caller build the
// vector for itself.
BOOST_AUTO_TEST_CASE(test_parsing_from_argc_and_argv) {
    char arg0[] = "prog";
    char arg1[] = "-f";
    char arg2[] = "file.txt";
    char *args[] = {arg0, arg1, arg2};

    {
        Parser parser(
            Command("prog").addArgument(Argument("path")).addOption(Option({"-f"}, "Force")));
        auto result = parser.parse(3, args);
        BOOST_REQUIRE_MESSAGE(result.isValid(), result.errorText());
        BOOST_CHECK(result.option("-f").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "file.txt");
    }

    // And through invoke, which is the one a main actually writes.
    {
        std::string seen;
        Parser parser(Command("prog")
                          .addArgument(Argument("path"))
                          .addOption(Option({"-f"}, "Force"))
                          .setHandler([&seen](const ParseResult &result) {
                              seen = must(result.value(0));
                              return 7;
                          }));
        BOOST_CHECK_EQUAL(parser.invoke(3, args), 7);
        BOOST_CHECK_EQUAL(seen, "file.txt");
    }
}

namespace {

    // The lines of the help text that carry \a needle's description, the first one and every
    // continuation under it, with the leading blanks kept so alignment can be checked.
    std::vector<std::string> entryLines(const std::string &text, const std::string &needle) {
        std::vector<std::string> all;
        for (size_t start = 0; start <= text.size();) {
            auto end = text.find('\n', start);
            all.push_back(text.substr(start, end == std::string::npos ? end : end - start));
            if (end == std::string::npos) {
                break;
            }
            start = end + 1;
        }

        std::vector<std::string> res;
        for (size_t i = 0; i < all.size(); ++i) {
            if (all[i].find(needle) == std::string::npos) {
                continue;
            }
            res.push_back(all[i]);
            // A continuation is a line that is nothing but the description, so it starts past
            // where the left column ends.
            for (size_t j = i + 1; j < all.size(); ++j) {
                auto first = all[j].find_first_not_of(' ');
                if (first == std::string::npos || first <= all[i].find_first_not_of(' ')) {
                    break;
                }
                res.push_back(all[j]);
            }
            break;
        }
        return res;
    }

}

// ---------------------------------------------------------------------------------------------
// Wrapping, and the width to wrap to
// ---------------------------------------------------------------------------------------------

// A description longer than the terminal is wrapped rather than run off the side, and what it
// wraps to is measured in columns.
BOOST_AUTO_TEST_CASE(test_a_long_description_is_wrapped) {
    const std::string sentence = "Overwrite whatever is already there, without asking first, "
                                 "which is what a script wants and a person rarely does";

    const auto &help = [&sentence](int width) {
        Parser parser(Command("prog").addOption(Option({"-f", "--force"}, sentence)));
        parser.setTextWidth(width);
        return parser.parse({"prog"}).helpText();
    };

    // Wide enough for the whole thing, so there is nothing to break.
    {
        auto lines = entryLines(help(200), "--force");
        BOOST_REQUIRE_EQUAL(lines.size(), 1u);
        BOOST_CHECK(has(lines[0], sentence));
    }

    // Narrow enough that it has to break, and no line may exceed the width.
    {
        auto lines = entryLines(help(60), "--force");
        BOOST_REQUIRE_GT(lines.size(), 1u);
        for (const auto &line : lines) {
            BOOST_CHECK_MESSAGE(stdc::console::display_width(line) <= 60,
                                "line runs past the width: [" + line + "]");
        }
    }

    // Narrower still gives more lines, which is the property that says the width is being read
    // rather than a constant standing in for it.
    BOOST_CHECK_GT(entryLines(help(40), "--force").size(), entryLines(help(60), "--force").size());

    // The continuation lines start under the description, not under the option.
    {
        auto lines = entryLines(help(60), "--force");
        BOOST_REQUIRE_GT(lines.size(), 1u);
        auto column = lines[0].find("Overwrite");
        BOOST_REQUIRE(column != std::string::npos);
        for (size_t i = 1; i < lines.size(); ++i) {
            BOOST_CHECK_EQUAL(lines[i].find_first_not_of(' '), column);
        }
    }

    // Words are kept whole, so no line ends mid-word where a space was available.
    {
        auto lines = entryLines(help(60), "--force");
        std::string rejoined;
        for (const auto &line : lines) {
            auto first = line.find_first_not_of(' ');
            rejoined += (rejoined.empty() ? "" : " ") + line.substr(first);
        }
        BOOST_CHECK(has(rejoined, sentence));
    }
}

// What wrapping has to get right beyond the ordinary case.
BOOST_AUTO_TEST_CASE(test_wrapping_edges) {
    const auto &help = [](const std::string &description, int width) {
        Parser parser(Command("prog").addOption(Option({"-x"}, description)));
        parser.setTextWidth(width);
        return parser.parse({"prog"}).helpText();
    };

    // A single word wider than the column has no space to break at, so it is broken where it
    // reached the edge rather than left to run over.
    {
        std::string word(120, 'w');
        auto lines = entryLines(help(word, 50), "-x");
        BOOST_REQUIRE_GT(lines.size(), 1u);
        for (const auto &line : lines) {
            BOOST_CHECK(stdc::console::display_width(line) <= 50);
        }
    }

    // Newlines a caller wrote are theirs, and are kept.
    {
        auto lines = entryLines(help("first\nsecond\nthird", 200), "-x");
        BOOST_REQUIRE_EQUAL(lines.size(), 3u);
        BOOST_CHECK(has(lines[0], "first"));
        BOOST_CHECK(has(lines[1], "second"));
        BOOST_CHECK(has(lines[2], "third"));
    }

    // A width narrower than the left column leaves nothing to subtract, and the answer is a
    // readable column anyway rather than one character per line. It still wraps: giving up and
    // writing one long line would be the other way to survive this, and is not what is wanted.
    {
        auto lines =
            entryLines(help("a description of some length here that will not fit", 4), "-x");
        BOOST_REQUIRE_GT(lines.size(), 1u);
        for (const auto &line : lines) {
            auto first = line.find_first_not_of(' ');
            BOOST_CHECK_GT(line.size() - first, 1u);
        }
    }

    // Nothing to wrap.
    {
        auto lines = entryLines(help("", 60), "-x");
        BOOST_REQUIRE_EQUAL(lines.size(), 1u);
    }
}

// Text that is not ASCII is measured in the columns it occupies, not in the bytes it takes.
BOOST_AUTO_TEST_CASE(test_wrapping_counts_columns_not_bytes) {
    // Twenty CJK characters: sixty bytes, forty columns.
    std::string cjk;
    for (int i = 0; i < 20; i++) {
        cjk += "\xe4\xb8\xad";
    }
    BOOST_REQUIRE_EQUAL(cjk.size(), 60u);
    BOOST_REQUIRE_EQUAL(stdc::console::display_width(cjk), 40);

    Parser parser(Command("prog").addOption(Option({"-x"}, cjk)));
    parser.setTextWidth(40);
    auto lines = entryLines(parser.parse({"prog"}).helpText(), "-x");

    BOOST_REQUIRE_GT(lines.size(), 1u);
    for (const auto &line : lines) {
        // Measured by column. Counting bytes would have let each line hold three times as much
        // as it can show.
        BOOST_CHECK_MESSAGE(stdc::console::display_width(line) <= 40,
                            "line is " + std::to_string(stdc::console::display_width(line)) +
                                " columns wide");
        // And never split through the middle of a character, which would leave a broken byte
        // sequence in the output.
        BOOST_CHECK_EQUAL((line.size() - line.find_first_not_of(' ')) % 3, 0u);
    }
}

// ---------------------------------------------------------------------------------------------
// A subcommand, and what it inherited
// ---------------------------------------------------------------------------------------------

// A subcommand is handed the globals of every command above it, and it will be refused for
// leaving out a required one, so its help text has to say what they are. It used to list only
// what the command declared itself, which left "option \"-C\" is required" naming something the
// reader had just been told to look for in a help text that never mentioned it.
BOOST_AUTO_TEST_CASE(test_a_subcommand_lists_what_it_inherited) {
    const auto &tree = [] {
        Parser parser(Command("prog")
                          .addOptions({
                              Option({"-v", "--verbose"}, "Say more").recursive(),
                              Option({"-C"}, "Work here").arg("dir").recursive().required(),
                              Option({"--local"}, "Root only"),
                          })
                          .addCommand(Command("build", "Build it")
                                          .addArgument(Argument("target"))
                                          .addOption(Option({"-j"}, "Jobs").arg("n"))));
        parser.setTextWidth(80);
        return parser;
    };

    auto parser = tree();
    auto text = parser.parse(argv({"build", "x"})).helpText();

    // Under a heading of their own, since they belong to the program rather than here.
    BOOST_CHECK(has(text, "Global options:"));
    BOOST_CHECK(at(text, "Options:") < at(text, "Global options:"));
    BOOST_CHECK(has(text, "-v, --verbose"));
    BOOST_CHECK(has(text, "-C <dir>"));

    // The command's own stay where they were.
    BOOST_CHECK(has(text, "-j <n>"));

    // An option the root kept to itself is not in scope here and is not listed.
    BOOST_CHECK(!has(text, "--local"));

    // The required one is on the usage line, the same as a required option of its own.
    BOOST_CHECK(has(text, "Usage:\n    prog build -C <dir> [options] <target>"));

    // What the help says and what the parser does have to be the same thing.
    auto refused = parser.parse(argv({"build", "x"}));
    BOOST_REQUIRE(!refused.isValid());
    BOOST_CHECK(has(refused.errorText(), "-C"));
    // Written after the command that was reached, which is where every option is written.
    BOOST_CHECK(ok(parser, {"build", "-C", "somewhere", "x"}).option("-C").has_value());

    // The root has nothing above it, so it has no such section.
    BOOST_CHECK(!has(parser.parse(argv({})).helpText(), "Global options:"));
}

// A global written wherever it is in scope, on a line that walks down through three commands and
// picks one up at each. Every command below where it was declared can be written before, and the
// ones above have nothing to say about it.
BOOST_AUTO_TEST_CASE(test_recursive_options_are_written_after_the_command_that_was_reached) {
    const auto &tree = [] {
        Parser parser(
            Command("prog")
                .addOption(Option({"--root-wide"}, "From the top").recursive())
                .addCommand(Command("remote")
                                .addOption(Option({"--mid"}, "From the middle").recursive())
                                .addCommand(Command("add")
                                                .addOption(Option({"--leaf"}, "Here"))
                                                .addArgument(Argument("name")))));
        parser.setTextWidth(80);
        return parser;
    };

    // Every one of them after the command that was reached, which is the only place any option
    // is written. Two levels of recursive and the leaf's own, side by side.
    auto parser = tree();
    auto trailing = ok(parser, {"remote", "add", "--root-wide", "--mid", "--leaf", "x"});
    BOOST_CHECK(trailing.commandPath() == std::vector<std::string>({"prog", "remote", "add"}));
    BOOST_CHECK(trailing.option("--root-wide").has_value());
    BOOST_CHECK(trailing.option("--mid").has_value());
    BOOST_CHECK(trailing.option("--leaf").has_value());
    BOOST_CHECK_EQUAL(must(trailing.value(0)), "x");

    // In any order among themselves, since where an option sits after the command says nothing.
    for (const auto &line : {
             std::vector<std::string>{"remote", "add", "--mid",  "--leaf",      "--root-wide", "x"     },
             std::vector<std::string>{"remote", "add", "--leaf", "x",           "--root-wide", "--mid" },
             std::vector<std::string>{"remote", "add", "x",      "--root-wide", "--mid",       "--leaf"},
    }) {
        std::vector<std::string> args{"prog"};
        args.insert(args.end(), line.begin(), line.end());
        auto result = parser.parse(args);
        BOOST_REQUIRE_MESSAGE(result.isValid(), result.errorText());
        BOOST_CHECK(result.option("--root-wide").has_value());
        BOOST_CHECK(result.option("--mid").has_value());
        BOOST_CHECK(result.option("--leaf").has_value());
        BOOST_CHECK_EQUAL(must(result.value(0)), "x");
    }

    // The path is a run of names and nothing between them. An option ends it, whoever declared
    // that option, so what follows is no longer a command and is said to be too late.
    bad(parser, {"--root-wide", "remote", "add", "--leaf", "x"}, ParseResult::UnknownCommand);
    bad(parser, {"remote", "--mid", "add", "--leaf", "x"}, ParseResult::UnknownCommand);

    // Written above where it was declared it is nobody's option, which is the rule that lets a
    // subcommand name one thing what its parent names another.
    bad(parser, {"--mid", "remote", "add", "x"}, ParseResult::UnknownOption);
    bad(parser, {"remote", "--leaf", "add", "x"}, ParseResult::UnknownOption);

    // Twice is once too many unless it said otherwise. Being recursive buys it no extra turns.
    bad(parser, {"remote", "add", "--root-wide", "--root-wide", "x"},
        ParseResult::OptionOccurTooMuch);

    // Having said otherwise, both are counted.
    Parser repeatable(Command("prog")
                          .addOption(Option({"-v"}, "Say more").recursive().multi())
                          .addCommand(Command("remote").addCommand(
                              Command("add").addArgument(Argument("name")))));
    auto twice = ok(repeatable, {"remote", "add", "-v", "-v", "x"});
    BOOST_REQUIRE(twice.option("-v").has_value());
    BOOST_CHECK_EQUAL(twice.option("-v")->count(), 2);

    // Two levels of them are both listed, under the heading that says they came from above.
    auto text = parser.parse(argv({"remote", "add", "x"})).helpText();
    BOOST_CHECK(has(text, "Global options:"));
    BOOST_CHECK(has(text, "--root-wide"));
    BOOST_CHECK(has(text, "--mid"));
    BOOST_CHECK(has(text, "Usage:\n    prog remote add"));
    // Its own stays where its own goes.
    BOOST_CHECK(at(text, "Options:") < at(text, "Global options:"));
    BOOST_CHECK(has(text, "--leaf"));
}

// A response file is expanded before the command is looked for, so it may name one.
BOOST_AUTO_TEST_CASE(test_a_response_file_may_name_a_subcommand) {
    auto path = std::filesystem::temp_directory_path() / "stdc_cli_response_nested.txt";
    {
        std::ofstream file(path, std::ios::binary);
        file << "build\n-j\n4\ntarget\n";
    }

    Parser parser(Command("prog").addCommand(Command("build")
                                                 .addArgument(Argument("target"))
                                                 .addOption(Option({"-j"}, "Jobs").arg("n"))));
    auto result = ok(parser, {"@" + path.string()}, Parser::EnableResponseFile);
    BOOST_CHECK(result.commandPath() == std::vector<std::string>({"prog", "build"}));
    BOOST_CHECK_EQUAL(must(result.value(0)), "target");
    BOOST_CHECK_EQUAL(must(result.valueForOption<int>("-j")), 4);

    std::filesystem::remove(path);
}

// Inheritance is from every command above, not only the one directly above.
BOOST_AUTO_TEST_CASE(test_globals_reach_a_grandchild) {
    Parser parser(
        Command("prog")
            .addOption(Option({"--root-wide"}, "From the top").recursive())
            .addCommand(Command("remote", "Remotes")
                            .addOption(Option({"--mid"}, "From the middle").recursive())
                            .addOption(Option({"--mid-local"}, "Not inherited"))
                            .addCommand(Command("add", "Add one").addArgument(Argument("name")))));
    parser.setTextWidth(80);

    auto text = parser.parse(argv({"remote", "add", "x"})).helpText();
    BOOST_CHECK(has(text, "Global options:"));
    BOOST_CHECK(has(text, "--root-wide"));
    BOOST_CHECK(has(text, "--mid"));
    BOOST_CHECK(!has(text, "--mid-local"));

    // And the middle command sees the root's but not its own child's.
    auto middle = parser.parse(argv({"remote"})).helpText();
    BOOST_CHECK(has(middle, "--root-wide"));
    BOOST_CHECK(has(middle, "--mid-local"));
}

// The usage line is wrapped like everything else, and every line of it sits at the indent its
// heading gives it rather than drifting back to the margin.
BOOST_AUTO_TEST_CASE(test_the_usage_line_is_wrapped) {
    const auto &usageLines = [](int width) {
        Parser parser(Command("program")
                          .addOption(Option({"--output"}, "Out").arg("file").required())
                          .addOption(Option({"--config"}, "Config").arg("path").required())
                          .addOption(Option({"--target"}, "Target").arg("triple").required())
                          .addOption(Option({"-v"}, "Loud"))
                          .addArguments({Argument("source"), Argument("destination")}));
        parser.setTextWidth(width);
        auto text = parser.parse({"program"}).helpText();

        // The body under the heading, which is every line indented under it.
        std::vector<std::string> res;
        auto heading = text.find("Usage:\n");
        for (size_t start = heading == std::string::npos ? heading : heading + 7;
             start != std::string::npos && text.compare(start, 4, "    ") == 0;) {
            auto end = text.find('\n', start);
            res.push_back(text.substr(start, end == std::string::npos ? end : end - start));
            if (end == std::string::npos) {
                break;
            }
            start = end + 1;
        }
        return res;
    };

    // Wide enough for all of it.
    {
        auto lines = usageLines(200);
        BOOST_REQUIRE_EQUAL(lines.size(), 1u);
        BOOST_CHECK(has(lines[0], "--output <file>"));
        BOOST_CHECK(has(lines[0], "<destination>"));
    }

    // Not wide enough, so it breaks and nothing runs past the edge.
    {
        auto lines = usageLines(50);
        BOOST_REQUIRE_GT(lines.size(), 1u);
        for (const auto &line : lines) {
            BOOST_CHECK_MESSAGE(stdc::console::display_width(line) <= 50,
                                "usage line runs past the width: [" + line + "]");
        }

        // At the indent, all of them, which is what makes the block read as one thing.
        for (const auto &line : lines) {
            BOOST_CHECK_EQUAL(line.find_first_not_of(' '), 4u);
        }
    }

    // An option and the value it takes are one piece, so a break never falls between them.
    // Checked across a range of widths, since any single width only puts the break in one place
    // and the pieces would sit together by luck at most of them.
    for (int width = 28; width <= 70; width++) {
        for (const auto &line : usageLines(width)) {
            for (const auto &pair : {std::make_pair("--output", "--output <file>"),
                                     std::make_pair("--config", "--config <path>"),
                                     std::make_pair("--target", "--target <triple>")}) {
                if (line.find(pair.first) == std::string::npos) {
                    continue;
                }
                BOOST_CHECK_MESSAGE(has(line, pair.second),
                                    std::string(pair.first) + " was split at width " +
                                        std::to_string(width) + ": [" + line + "]");
            }
        }
    }

    // Every piece survives however it is broken up.
    {
        std::string joined;
        for (const auto &line : usageLines(40)) {
            auto first = line.find_first_not_of(' ');
            joined += (joined.empty() ? "" : " ") + line.substr(first);
        }
        for (const auto *piece : {"--output <file>", "--config <path>", "--target <triple>",
                                  "[options]", "<source>", "<destination>"}) {
            BOOST_CHECK_MESSAGE(has(joined, piece), std::string("lost ") + piece);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The layout: which blocks, in what order
// ---------------------------------------------------------------------------------------------

// The description is a section like every other, so it carries a heading and its body is set in
// under it. Without one it ran on from the prologue with nothing to say which was which.
BOOST_AUTO_TEST_CASE(test_the_description_is_a_section_of_its_own) {
    Parser parser(Command("prog", "What the program is for"));
    parser.setPrologue("A prologue line");
    parser.setTextWidth(80);
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "Description:\n    What the program is for\n"));
    // The prologue is not a section and keeps the margin, since a banner belongs where it was
    // written rather than under a heading nobody asked for.
    BOOST_CHECK(has(text, "A prologue line\n"));
    BOOST_CHECK(!has(text, "    A prologue line"));

    // A command with no description contributes no heading either.
    Parser bare(Command("prog"));
    BOOST_CHECK(!has(bare.parse(argv({})).helpText(), "Description:"));
}

// How far a section body is set in, and how far the two columns of a list stand apart, are the
// program's to choose. A downstream that has always indented by four keeps doing so, and one
// that wants it tighter can have that.
BOOST_AUTO_TEST_CASE(test_the_indent_and_the_spacing_can_be_changed) {
    const auto &helpAt = [](int indent, int spacing, int width) {
        Parser parser(Command("prog", "What the program is for")
                          .addOption(Option({"-v"}, "Say more"))
                          .addOption(Option({"--output"}, "Where to write it, at whatever length "
                                                          "it takes to say so")
                                         .arg("file")));
        parser.setTextWidth(width);
        parser.setIndent(indent);
        parser.setSpacing(spacing);
        return parser.parse(argv({})).helpText();
    };

    // The widest name in the block, which is what the descriptions line up after.
    const size_t widest = std::string("--output <file>").size();

    // Four and four, which is what a parser starts with.
    {
        auto text = helpAt(4, 4, 80);
        BOOST_CHECK(has(text, "\n    What the program is for\n"));
        BOOST_CHECK(has(text, "\n    -v "));
        BOOST_CHECK_EQUAL(descriptionColumn(text, "-v"), 4u + widest + 4u);
    }

    // Both moved, and both move what they are meant to.
    {
        auto text = helpAt(2, 1, 80);
        BOOST_CHECK(has(text, "\n  What the program is for\n"));
        BOOST_CHECK(has(text, "\n  -v "));
        BOOST_CHECK_EQUAL(descriptionColumn(text, "-v"), 2u + widest + 1u);
    }

    // One moved and the other left alone, so that neither is standing in for the other.
    BOOST_CHECK_EQUAL(descriptionColumn(helpAt(8, 4, 80), "-v"), 8u + widest + 4u);
    BOOST_CHECK_EQUAL(descriptionColumn(helpAt(4, 9, 80), "-v"), 4u + widest + 9u);

    // A wrapped description carries on at the column it started at, wherever that is.
    {
        auto text = helpAt(6, 3, 60);
        auto start = text.find("Where to write it");
        BOOST_REQUIRE(start != std::string::npos);
        auto next = text.find('\n', start) + 1;
        BOOST_REQUIRE(next != 0u);
        BOOST_CHECK_EQUAL(text.find_first_not_of(' ', next) - next, 6u + widest + 3u);
    }
}

// Which blocks the help text is made of, and in what order, is the layout's business.
BOOST_AUTO_TEST_CASE(test_a_layout_says_which_blocks_and_in_what_order) {
    auto parser = helpTree();

    // The order they are added is the order they print.
    parser.setHelpLayout(
        HelpLayout().add(HelpBlock::Options).add(HelpBlock::Usage).add(HelpBlock::Description));
    auto text = parser.parse(argv({})).helpText();
    BOOST_CHECK(at(text, "Options:") < at(text, "Usage:"));
    BOOST_CHECK(at(text, "Usage:") < at(text, "Description:"));

    // What it does not ask for is not printed, which is how a program drops a block it has no
    // use for rather than emptying what feeds it.
    BOOST_CHECK(!has(text, "A prologue line"));
    BOOST_CHECK(!has(text, "An epilogue line"));
    BOOST_CHECK(!has(text, "Filesystem Commands:"));

    // What it asks for twice prints twice.
    parser.setHelpLayout(HelpLayout().add(HelpBlock::Description).add(HelpBlock::Description));
    auto twice = parser.parse(argv({})).helpText();
    size_t count = 0;
    for (size_t at_ = twice.find("Description:"); at_ != std::string::npos;
         at_ = twice.find("Description:", at_ + 1)) {
        count++;
    }
    BOOST_CHECK_EQUAL(count, 2u);

    // A layout with nothing in it says nothing.
    parser.setHelpLayout(HelpLayout());
    BOOST_CHECK(parser.parse(argv({})).helpText().empty());
}

// A block the program wrote itself goes through the same layout as the rest, which is the whole
// point of it being a block rather than something the program prints after the help text.
BOOST_AUTO_TEST_CASE(test_a_layout_carries_blocks_of_the_programs_own) {
    Parser parser(Command("prog").addOption(Option({"--output"}, "Where to write").arg("file")));
    parser.setTextWidth(80);

    HelpBlock examples;
    examples.title = "Examples";
    examples.text = "prog --output out.txt";

    HelpBlock environment;
    environment.title = "Environment";
    environment.entries = {
        {"PROG_HOME", "Where it looks for its data"}
    };

    parser.setHelpLayout(HelpLayout().add(HelpBlock::Options).add(environment).add(examples));
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "Environment:\n    PROG_HOME    Where it looks for its data\n"));
    BOOST_CHECK(has(text, "Examples:\n    prog --output out.txt\n"));
    BOOST_CHECK(at(text, "Options:") < at(text, "Environment:"));

    // Measured with the rest when the catalogues are aligned, since it is one of the lists.
    parser.setDisplayOptions(Parser::AlignAllCatalogues);
    auto aligned = parser.parse(argv({})).helpText();
    BOOST_CHECK_EQUAL(descriptionColumn(aligned, "--output <file>"),
                      descriptionColumn(aligned, "PROG_HOME"));

    // An empty one is dropped like any other, so a block filled in from something that turned
    // out to have nothing in it leaves no heading behind.
    parser.setHelpLayout(HelpLayout().add(HelpBlock()).add(HelpBlock::Options));
    BOOST_CHECK(!has(parser.parse(argv({})).helpText(), "::"));
}

// What the help text is made of, before it is laid out. A program that wants something the
// layout cannot say asks for these and prints them itself.
BOOST_AUTO_TEST_CASE(test_help_blocks_are_what_the_text_is_made_of) {
    auto blocks = helpTree().parse(argv({})).helpBlocks();
    BOOST_REQUIRE(!blocks.empty());

    const auto &find = [&blocks](HelpBlock::Role role,
                                 const std::string &title) -> const HelpBlock * {
        for (const auto &block : blocks) {
            if (block.role == role && block.title == title) {
                return &block;
            }
        }
        return nullptr;
    };

    // In the layout's order, prologue and epilogue at the ends and neither carrying a heading.
    BOOST_CHECK(blocks.front().role == HelpBlock::Prologue);
    BOOST_CHECK_EQUAL(blocks.front().title, "");
    BOOST_CHECK_EQUAL(blocks.front().text, "A prologue line");
    BOOST_CHECK(blocks.back().role == HelpBlock::Epilogue);
    BOOST_CHECK_EQUAL(blocks.back().text, "An epilogue line");

    // The usage line, already broken to the width but with none of the indent on it.
    auto usage = find(HelpBlock::Usage, "Usage");
    BOOST_REQUIRE(usage != nullptr);
    BOOST_CHECK_EQUAL(usage->text, "prog [commands] [options]");
    BOOST_CHECK(usage->entries.empty());

    // A catalogue's groups are blocks of their own, each carrying the role it came from.
    BOOST_CHECK(find(HelpBlock::Commands, "Filesystem Commands") != nullptr);
    BOOST_CHECK(find(HelpBlock::Commands, "Buildsystem Commands") != nullptr);
    BOOST_CHECK(find(HelpBlock::Commands, "Commands") != nullptr);

    // The root takes no positional arguments, so nothing says it takes any.
    BOOST_CHECK(find(HelpBlock::Arguments, "Arguments") == nullptr);

    // The two columns as they are, with none of the padding that lines them up.
    auto options = find(HelpBlock::Options, "Options");
    BOOST_REQUIRE(options != nullptr);
    BOOST_REQUIRE(!options->entries.empty());
    BOOST_CHECK(options->text.empty());
    BOOST_CHECK_EQUAL(options->entries.front().left, "-h, --help");
}

// A style says how a block is printed, not what it says. helpText() answers with the text and
// showHelp() puts the escapes around it.
BOOST_AUTO_TEST_CASE(test_styling_is_in_what_is_printed_and_not_in_the_text) {
    Parser parser(Command("prog", "What the program is for").addOption(Option({"-v"}, "Say more")));
    parser.setEpilogue("An epilogue line");
    parser.setTextWidth(80);

    auto plain = parser.parse(argv({})).helpText();

    auto layout = HelpLayout::defaultLayout();
    layout.setTitleStyle({stdc::console::bold});
    layout.setEntryStyle({stdc::console::nostyle, stdc::console::cyan});
    layout.setBodyStyle(HelpBlock::Epilogue, {stdc::console::bold, stdc::console::yellow});
    parser.setHelpLayout(layout);

    // Not a character of difference, since none of it is text.
    BOOST_CHECK_EQUAL(parser.parse(argv({})).helpText(), plain);

    // Printed, it is there. Forced, since the capture writes to a file and a file is never a
    // terminal, so deciding per target would rightly leave it plain.
    auto saved = stdc::console::get_color_mode();
    stdc::console::set_color_mode(stdc::console::vt);
    auto printed = capturedStdout([&] { parser.parse(argv({})).showHelp(); });
    stdc::console::set_color_mode(saved);

    BOOST_CHECK(has(printed, "\033[1mOptions:\033[0m"));
    BOOST_CHECK(has(printed, "\033[36m-v\033[0m"));
    BOOST_CHECK(has(printed, "\033[33;1mAn epilogue line\033[0m"));

    // A heading's newline is outside its styling, so nothing an escape turned on is still on at
    // the start of the next line. A background color painted to the edge is what shows this up.
    BOOST_CHECK(!has(printed, ":\n\033[0m"));

    // Strip the escapes and what is left is the text, so the styling moved nothing.
    std::string stripped;
    for (size_t i = 0; i < printed.size(); ++i) {
        if (printed[i] == '\033') {
            i = printed.find('m', i);
            BOOST_REQUIRE(i != std::string::npos);
            continue;
        }
        stripped += printed[i];
    }
    BOOST_CHECK_EQUAL(stripped, plain);
}

namespace {

    /// A tree with one of everything the rungs below touch, so that a case can say which of
    /// them moved and which did not.
    Parser formatterTree() {
        Parser parser(
            Command("prog", "What the program is for")
                .addArgument(Argument("path", "Where to work"))
                .addOption(Option({"-o", "--output"}, "Where to write").arg("file").required())
                .addOption(Option({"-v"}, "Say more")));
        parser.setEpilogue("An epilogue line");
        parser.setTextWidth(80);
        return parser;
    }

    /// Rung 1: how a metavar is spelled, which both the usage line and every list ask for.
    struct Braces : HelpFormatter {
        std::string displayed(const Argument &argument) const override {
            return "{" + argument.displayName() + "}";
        }
    };

}

// ---------------------------------------------------------------------------------------------
// The formatter: overriding a rung of the ladder
// ---------------------------------------------------------------------------------------------

// Overriding the bottom rung alone reaches everywhere a name is written, including through the
// option rung, which asks for its arguments through this rather than straight to the base.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_change_how_a_name_is_spelled) {
    auto parser = formatterTree();
    parser.setHelpFormatter(std::make_shared<Braces>());
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "Usage:\n    prog -o {file} [options] {path}"));
    BOOST_CHECK(has(text, "-o, --output {file}"));
    BOOST_CHECK(has(text, "{path}    Where to work"));
    BOOST_CHECK(!has(text, "<"));

    // The rung above it is untouched, so the spellings are still listed the way they were.
    BOOST_CHECK(has(text, "-o, --output"));
}

// The rung above, overridden on top of the base rather than instead of it.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_change_how_an_option_is_written) {
    struct Joined : HelpFormatter {
        std::string displayed(const Option &option, bool allSpellings) const override {
            auto res = HelpFormatter::displayed(option, allSpellings);
            auto at = res.find(" <");
            if (at != std::string::npos) {
                res.replace(at, 1, "=");
            }
            return res;
        }
    };

    auto parser = formatterTree();
    parser.setHelpFormatter(std::make_shared<Joined>());
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "-o, --output=<file>"));
    BOOST_CHECK(has(text, "Usage:\n    prog -o=<file> [options] <path>"));
    // A positional argument is not an option and is written the way it was.
    BOOST_CHECK(has(text, "<path>    Where to work"));
}

// The middle rung: what the text is made of. Everything CLI11 needs eight overridables for is
// this one hook, since what comes back is data rather than eight pieces of finished text.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_change_what_the_blocks_hold) {
    struct Shouty : HelpFormatter {
        std::vector<HelpBlock> blocks(const ParseResult &result,
                                      const HelpSizes &sizes) const override {
            auto res = HelpFormatter::blocks(result, sizes);
            for (auto &block : res) {
                for (auto &c : block.title) {
                    c = c >= 'a' && c <= 'z' ? char(c - 'a' + 'A') : c;
                }
            }
            HelpBlock seeAlso;
            seeAlso.title = "SEE ALSO";
            seeAlso.text = "prog(1)";
            res.push_back(std::move(seeAlso));
            return res;
        }
    };

    auto parser = formatterTree();
    parser.setHelpFormatter(std::make_shared<Shouty>());
    auto result = parser.parse(argv({}));
    auto text = result.helpText();

    BOOST_CHECK(has(text, "OPTIONS:"));
    BOOST_CHECK(!has(text, "Options:"));
    BOOST_CHECK(has(text, "SEE ALSO:\n    prog(1)\n"));
    // Laid out like any other block, which is the point of adding one here rather than printing
    // it after the help text.
    BOOST_CHECK(has(text, "An epilogue line\n\nSEE ALSO:"));

    // helpBlocks() answers with what the formatter made rather than with what the layout asked
    // for, so the two ways of reaching the blocks agree.
    BOOST_CHECK_EQUAL(result.helpBlocks().back().title, "SEE ALSO");
}

// One block laid out differently and the rest left alone, which is what the base being callable
// per block is for.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_lay_one_block_out_differently) {
    struct BareOptions : HelpFormatter {
        std::vector<Run> renderBlock(const HelpBlock &block, const HelpSizes &sizes,
                                     size_t widest) const override {
            if (block.role != HelpBlock::Options) {
                return HelpFormatter::renderBlock(block, sizes, widest);
            }
            std::vector<Run> res;
            for (const auto &entry : block.entries) {
                res.push_back({block.entryStyle, entry.left + ";"});
            }
            res.push_back({{}, "\n"});
            return res;
        }
    };

    auto parser = formatterTree();
    parser.setHelpFormatter(std::make_shared<BareOptions>());
    auto text = parser.parse(argv({})).helpText();

    BOOST_CHECK(has(text, "-o, --output <file>;-v;\n"));
    BOOST_CHECK(!has(text, "Options:"));
    // Everything that is not that block is as it was, heading, indent and all.
    BOOST_CHECK(has(text, "Description:\n    What the program is for\n"));
    BOOST_CHECK(has(text, "Usage:\n    prog -o <file> [options] <path>\n"));
    BOOST_CHECK(has(text, "Arguments:\n    <path>    Where to work\n"));
}

// The top rung, which is the whole page and reuses none of it.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_lay_the_whole_page_out) {
    struct Terse : HelpFormatter {
        std::vector<Run> render(const std::vector<HelpBlock> &blocks,
                                const HelpSizes &) const override {
            std::vector<Run> res;
            for (const auto &block : blocks) {
                res.push_back({{},
                               std::to_string(int(block.role)) + ":" +
                                   std::to_string(block.entries.size()) + " "});
            }
            return res;
        }
    };

    auto parser = formatterTree();
    parser.setHelpFormatter(std::make_shared<Terse>());
    // Description, usage, arguments, options, epilogue, with the counts each holds.
    BOOST_CHECK_EQUAL(parser.parse(argv({})).helpText(), "1:0 2:0 3:1 4:2 7:0 ");
}

// The usage line on its own, and what it is handed. The command answers for its own options and
// for its arguments and subcommands, so the only thing passed alongside is what the commands
// above left in scope, which nothing reachable from the command could say.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_change_the_usage_line) {
    struct Synopsis : HelpFormatter {
        mutable std::vector<std::string> inherited;
        std::string usageText(const Command &command, const std::vector<std::string> &path,
                              const std::vector<Option> &from_above,
                              const HelpSizes &sizes) const override {
            inherited.clear();
            for (const auto &option : from_above) {
                inherited.push_back(option.token());
            }
            return "SYNOPSIS " + std::to_string(path.size()) + "\n" +
                   HelpFormatter::usageText(command, path, from_above, sizes);
        }
    };

    auto formatter = std::make_shared<Synopsis>();
    auto parser = helpTree();
    parser.setHelpFormatter(formatter);

    // At the root the path is the program alone and nothing is inherited.
    auto text = parser.parse(argv({})).helpText();
    BOOST_CHECK(has(text, "SYNOPSIS 1\n"));
    // Both lines went through the base and both carry the block's indent.
    BOOST_CHECK(has(text, "prog [commands] [options]"));
    BOOST_CHECK(formatter->inherited.empty());

    // A level down the path is two words, and the global the root declared is in scope. It is
    // still written on the usage line, which is what says the base was reached through the
    // override rather than instead of it.
    text = parser.parse(argv({"copy", "a", "b"})).helpText();
    BOOST_CHECK(has(text, "SYNOPSIS 2\n"));
    BOOST_CHECK(has(text, "prog copy [options]"));
    BOOST_REQUIRE_EQUAL(formatter->inherited.size(), 1u);
    BOOST_CHECK_EQUAL(formatter->inherited[0], "-V");
}

// The row rung, all three of it, and the name rung for a subcommand. Their defaults are what
// every help text goes through and nothing had ever overridden one, which is the shape that
// matters for a class promising each rung can be replaced on its own.
BOOST_AUTO_TEST_CASE(test_a_formatter_can_change_a_row) {
    struct Rows : HelpFormatter {
        std::string displayed(const Command &command) const override {
            return "/" + HelpFormatter::displayed(command);
        }
        HelpBlock::Entry entry(const Argument &argument, const HelpSizes &sizes) const override {
            auto res = HelpFormatter::entry(argument, sizes);
            res.right = "arg: " + res.right;
            return res;
        }
        HelpBlock::Entry entry(const Option &option, const HelpSizes &sizes) const override {
            auto res = HelpFormatter::entry(option, sizes);
            res.right = "opt: " + res.right;
            return res;
        }
        HelpBlock::Entry entry(const Command &command, const HelpSizes &sizes) const override {
            auto res = HelpFormatter::entry(command, sizes);
            res.right = "cmd: " + res.right;
            return res;
        }
    };

    auto parser = helpTree();
    parser.setHelpFormatter(std::make_shared<Rows>());
    auto text = parser.parse(argv({})).helpText();

    // The command row reaches the name rung through the base, so overriding either shows here.
    BOOST_CHECK(has(text, "/copy"));
    BOOST_CHECK(has(text, "cmd: Copy things"));
    BOOST_CHECK(has(text, "opt: Show this help and exit"));
    // The usage line writes the path rather than a name, so it is not touched by either.
    BOOST_CHECK(!has(text, "/prog"));

    // Arguments are a level down, the root having none.
    text = parser.parse(argv({"copy", "a", "b"})).helpText();
    BOOST_CHECK(has(text, "arg: Where from"));
    BOOST_CHECK(has(text, "opt: Overwrite"));
}

// ---------------------------------------------------------------------------------------------
// Whether a tree may be built that way at all
// ---------------------------------------------------------------------------------------------

// The pieces retain an invalid tree intact so that one validator can diagnose it once it is
// complete. These helpers are private implementation shared by that validator and these tests.
BOOST_AUTO_TEST_CASE(test_what_an_argument_may_follow) {
    const std::vector<Argument> none;
    BOOST_CHECK(detail::arguments_can_follow(none, Argument("path")));

    // A name to be known by, and one nobody else has.
    BOOST_CHECK(!detail::arguments_can_follow(none, Argument("")));
    BOOST_CHECK(!detail::arguments_can_follow({Argument("path")}, Argument("path")));
    BOOST_CHECK(detail::arguments_can_follow({Argument("path")}, Argument("dest")));

    // Nothing that has to be given after one that may be left out, or a single token could be
    // meant for either.
    BOOST_CHECK(!detail::arguments_can_follow({Argument("a").optional()}, Argument("b")));
    BOOST_CHECK(detail::arguments_can_follow({Argument("a").optional()}, Argument("b").optional()));
    BOOST_CHECK(detail::arguments_can_follow({Argument("a")}, Argument("b").optional()));

    // A greedy one leaves a token for each required argument after it, so a required one may
    // follow and nothing else may. This is copy <src>... <dest>.
    BOOST_CHECK(detail::arguments_can_follow({Argument("src").multi()}, Argument("dest")));
    BOOST_CHECK(
        !detail::arguments_can_follow({Argument("src").multi()}, Argument("dest").optional()));
    BOOST_CHECK(!detail::arguments_can_follow({Argument("src").multi()}, Argument("dest").multi()));

    // One that takes everything leaves nothing to follow it with.
    BOOST_CHECK(!detail::arguments_can_follow({Argument("rest").nargs(Argument::Remainder)},
                                              Argument("dest")));

    // The same rules wherever arguments are held, so an option's own list obeys them.
    BOOST_CHECK(!detail::arguments_can_follow({Argument("a").optional()}, Argument("b")));
}

BOOST_AUTO_TEST_CASE(test_what_an_option_may_join) {
    const std::vector<Option> none;
    BOOST_CHECK(detail::options_can_join(none, Option({"-f", "--force"}, "Force")));

    // Something to type, and something that could not be taken for a value.
    BOOST_CHECK(!detail::options_can_join(none, Option()));
    BOOST_CHECK(!detail::options_can_join(none, Option({""}, "Nameless")));
    BOOST_CHECK(!detail::options_can_join(none, Option({"force"}, "No dash")));
    BOOST_CHECK(!detail::options_can_join(none, Option({"-"}, "Just a dash")));
    BOOST_CHECK(detail::options_can_join(none, Option({"/f"}, "The DOS spelling")));

    // -- is a spelling like any other, since the parser keeps no word of its own. A program
    // that wants the usual one declares it, and one that wants another declares that.
    BOOST_CHECK(detail::options_can_join(none, Option({"--"}, "The rest")));
    BOOST_CHECK(detail::options_can_join(none, Option({"--force"}, "An ordinary long one")));

    // No spelling that one already there answers to, whichever of its spellings it is.
    const std::vector<Option> taken = {Option({"-f", "--force"}, "Force")};
    BOOST_CHECK(!detail::options_can_join(taken, Option({"-f"}, "Again")));
    BOOST_CHECK(
        !detail::options_can_join(taken, Option({"-x", "--force"}, "Again by its long name")));
    BOOST_CHECK(detail::options_can_join(taken, Option({"-x", "--other"}, "Neither")));

    // One that stands in for an empty command line is written by nobody, so there is nothing to
    // require and nothing to give it.
    BOOST_CHECK(
        detail::options_can_join(none, Option({"-h"}, "Help").prior(Option::AutoSetWhenNoSymbols)));
    BOOST_CHECK(!detail::options_can_join(
        none, Option({"-h"}, "Help").prior(Option::AutoSetWhenNoSymbols).required()));
    BOOST_CHECK(!detail::options_can_join(
        none, Option({"-h"}, "Help").prior(Option::AutoSetWhenNoSymbols).arg("topic")));
}

// A collision the pieces cannot see as they are added, since a command knows nothing about the
// ancestors it will end up under. Asked of the whole tree once it is one.
BOOST_AUTO_TEST_CASE(test_a_recursive_option_and_a_local_one_may_not_share_a_spelling) {
    const auto &tree = [](bool recursive, const char *below) {
        return Command("prog")
            .addOption(Option({"-o"}, "The root's").arg("root").recursive(recursive))
            .addCommand(Command("sub").addOption(Option({below}, "The subcommand's").arg("sub")));
    };

    // Both in scope at sub, both answering to -o, and a result is asked for one by spelling.
    BOOST_CHECK(!detail::tree_can_be_parsed(tree(true, "-o")));

    // The same two where the root keeps its own, since then only one of them is ever in scope.
    BOOST_CHECK(detail::tree_can_be_parsed(tree(false, "-o")));

    // And where the spellings differ, which is the ordinary case.
    BOOST_CHECK(detail::tree_can_be_parsed(tree(true, "-p")));

    // Two levels up counts the same as one.
    BOOST_CHECK(!detail::tree_can_be_parsed(
        Command("prog")
            .addOption(Option({"-v"}, "The root's").recursive())
            .addCommand(Command("mid").addCommand(
                Command("leaf").addOption(Option({"-v"}, "The leaf's"))))));

    // Two recursive ones from different levels reach the same command together.
    BOOST_CHECK(!detail::tree_can_be_parsed(
        Command("prog")
            .addOption(Option({"-v"}, "The root's").recursive())
            .addCommand(Command("mid")
                            .addOption(Option({"-v"}, "The middle's").recursive())
                            .addCommand(Command("leaf")))));
}

// The same question, asked with the options the line will be read with. Two spellings that
// differ only in case are one spelling under those, and nothing before the parse knows which
// way it will be read.
BOOST_AUTO_TEST_CASE(test_names_that_are_one_name_only_under_a_matching_rule) {
    auto options = Command("prog").addOptions(
        {Option({"--output"}, "One"), Option({"--OUTPUT"}, "The other")});
    BOOST_CHECK(detail::tree_can_be_parsed(options));
    BOOST_CHECK(!detail::tree_can_be_parsed(options, true, false));
    // The rule for commands does not decide the one for options.
    BOOST_CHECK(detail::tree_can_be_parsed(options, false, true));

    auto commands =
        Command("prog").addCommands({Command("build"), Command("BUILD", "The other one")});
    BOOST_CHECK(detail::tree_can_be_parsed(commands));
    BOOST_CHECK(!detail::tree_can_be_parsed(commands, false, true));
    BOOST_CHECK(detail::tree_can_be_parsed(commands, true, false));

    // A recursive option and a local one that differ only in case, which needs both the rule
    // and the whole tree to see.
    auto mixed = Command("prog")
                     .addOption(Option({"--force"}, "The root's").recursive())
                     .addCommand(Command("sub").addOption(Option({"--FORCE"}, "The sub's")));
    BOOST_CHECK(detail::tree_can_be_parsed(mixed));
    BOOST_CHECK(!detail::tree_can_be_parsed(mixed, true, false));
}

// A Remainder takes the rest of the line, so every option has to be written before it. An
// option whose own argument is greedy reads on until something stops it. One command cannot
// have both: the option written first eats the arguments, the arguments written first turn the
// option into one of their values, and only a third option between them saves it.
BOOST_AUTO_TEST_CASE(test_a_remainder_and_a_greedy_option_cannot_share_a_command) {
    const auto &tree = [](Argument::Arity arity) {
        return Command("prog")
            .addArgument(Argument("script"))
            .addArgument(Argument("args").nargs(arity).optional())
            .addOption(Option({"-f"}, "Files").arg(Argument("file").multi()));
    };
    BOOST_CHECK(!detail::tree_can_be_parsed(tree(Argument::Remainder)));
    // A greedy argument is not the same thing: it leaves room, so an order that works exists.
    BOOST_CHECK(detail::tree_can_be_parsed(tree(Argument::Multiple)));

    // A plain option beside a Remainder is fine, having an end of its own.
    BOOST_CHECK(detail::tree_can_be_parsed(
        Command("prog")
            .addArgument(Argument("args").nargs(Argument::Remainder).optional())
            .addOption(Option({"-o"}, "Out").arg("dir"))));

    // The greedy one may come from above, where the command it reaches cannot see it.
    BOOST_CHECK(!detail::tree_can_be_parsed(
        Command("prog")
            .addOption(Option({"-f"}, "Files").arg(Argument("file").multi()).recursive())
            .addCommand(Command("sub").addArgument(
                Argument("args").nargs(Argument::Remainder).optional()))));
}

// A Remainder starts where the argument before it was filled. Where it is the first argument
// there is none, so it starts at the first token that is not written as an option, which is how
// a wrapper takes options of its own and hands the rest on: sudo -u root ls -l.
BOOST_AUTO_TEST_CASE(test_a_leading_remainder_starts_at_the_first_token_that_is_not_an_option) {
    Parser parser(Command("run")
                      .addArgument(Argument("rest").nargs(Argument::Remainder).optional())
                      .addOption(Option({"-v"}, "Verbose"))
                      .addOption(Option({"-u"}, "As user").arg("who")));

    auto wrapped = ok(parser, {"-u", "root", "ls", "-v", "-u", "x"});
    BOOST_CHECK_EQUAL(wrapped.valueForOption("-u").value_or(""), "root");
    BOOST_CHECK(!wrapped.option("-v").has_value());
    BOOST_CHECK(wrapped.values(0) == std::vector<std::string>({"ls", "-v", "-u", "x"}));

    // Nothing of its own, so the whole line is the tail.
    BOOST_CHECK(ok(parser, {"ls", "-l"}).values(0) == std::vector<std::string>({"ls", "-l"}));
    // Nothing but its own, and the tail is empty.
    auto bare = ok(parser, {"-v"});
    BOOST_CHECK(bare.option("-v").has_value());
    BOOST_CHECK(bare.values(0) == std::vector<std::string>());

    // A token written as an option and not declared is reported rather than passed on, since a
    // wrapper is not improved by taking its own misspelt flags for payload.
    bad(parser, {"-w", "ls"}, ParseResult::UnknownOption);

    // Where an argument comes first it is that argument being filled that ends the options, so
    // an option written after it is the tail's whether it is declared or not.
    Parser named(Command("run")
                     .addArgument(Argument("cmd"))
                     .addArgument(Argument("rest").nargs(Argument::Remainder).optional())
                     .addOption(Option({"-v"}, "Verbose")));
    auto after = ok(named, {"-v", "ls", "-v"});
    BOOST_CHECK(after.option("-v").has_value());
    BOOST_CHECK_EQUAL(after.option("-v")->count(), 1);
    BOOST_CHECK_EQUAL(after.value(0).value_or(""), "ls");
    BOOST_CHECK(after.values(1) == std::vector<std::string>({"-v"}));
}

BOOST_AUTO_TEST_CASE(test_what_a_subcommand_may_join_and_what_a_catalogue_may_group) {
    const std::vector<Command> none;
    BOOST_CHECK(detail::commands_can_join(none, Command("copy")));
    BOOST_CHECK(!detail::commands_can_join(none, Command("")));
    BOOST_CHECK(!detail::commands_can_join({Command("copy")}, Command("copy")));
    BOOST_CHECK(detail::commands_can_join({Command("copy")}, Command("move")));

    // A name in two groups would be listed under the first that claims it and missing from the
    // other, which reads as the catalogue having been ignored.
    const std::vector<CommandCatalogue::Group> none_yet;
    BOOST_CHECK(detail::catalogue_can_add_group(none_yet, {"copy", "move"}));
    BOOST_CHECK(!detail::catalogue_can_add_group(none_yet, {"copy", "copy"}));

    const std::vector<CommandCatalogue::Group> filesystem = {
        {"Filesystem", {"copy", "move"}}
    };
    BOOST_CHECK(!detail::catalogue_can_add_group(filesystem, {"build", "copy"}));
    BOOST_CHECK(detail::catalogue_can_add_group(filesystem, {"build", "configure"}));
}

BOOST_AUTO_TEST_CASE(test_a_parser_can_validate_a_complete_tree_on_request) {
    Parser valid(Command("prog")
                     .addArgument(Argument("source"))
                     .addOption(Option({"-f", "--force"}, "Force"))
                     .addCommand(Command("copy")));
    BOOST_CHECK(!valid.validate().has_value());

    // The invalid pieces all made it into the tree. No constructor or builder had to know
    // whether the caller was finished with it yet.
    Parser badArguments(Command("prog")
                            .addArgument(Argument("source").optional())
                            .addArgument(Argument("destination")));
    BOOST_REQUIRE(badArguments.validate().has_value());
    BOOST_CHECK(has(*badArguments.validate(), "argument sequence"));

    Parser badOptions(Command("prog")
                          .addOption(Option({"-f", "-f"}, "Force"))
                          .addOption(Option({"-n"}, "Count").multi(-1)));
    BOOST_REQUIRE(badOptions.validate().has_value());
    BOOST_CHECK(has(*badOptions.validate(), "option spelling"));

    Parser badOccurrence(Command("prog").addOption(Option({"-n"}, "Count").multi(-1)));
    BOOST_REQUIRE(badOccurrence.validate().has_value());
    BOOST_CHECK(has(*badOccurrence.validate(), "negative occurrence"));

    Parser badOptionArguments(Command("prog").addOption(
        Option({"-o"}, "Output").arg(Argument("format").optional()).arg(Argument("path"))));
    BOOST_REQUIRE(badOptionArguments.validate().has_value());
    BOOST_CHECK(has(*badOptionArguments.validate(), "argument sequence"));

    Parser badAutomatic(Command("prog").addOption(
        Option({"-h"}, "Help").required().prior(Option::AutoSetWhenNoSymbols)));
    BOOST_REQUIRE(badAutomatic.validate().has_value());
    BOOST_CHECK(has(*badAutomatic.validate(), "automatic option"));

    Parser badCommands(Command("prog").addCommand(Command("copy")).addCommand(Command("copy")));
    BOOST_REQUIRE(badCommands.validate().has_value());
    BOOST_CHECK(has(*badCommands.validate(), "subcommand name"));
}

BOOST_AUTO_TEST_CASE(test_validation_checks_argument_defaults_and_catalogue_references) {
    Parser badDefault(
        Command("prog").addArgument(Argument("count").optional().type<int>().defaultValue("many")));
    BOOST_REQUIRE(badDefault.validate().has_value());
    BOOST_CHECK(has(*badDefault.validate(), "default value"));

    Parser badExpected(Command("prog").addArgument(Argument("count").type<int>().expect({"many"})));
    BOOST_REQUIRE(badExpected.validate().has_value());
    BOOST_CHECK(has(*badExpected.validate(), "expected value"));

    Parser requiredDefault(Command("prog").addArgument(Argument("count").defaultValue("1")));
    BOOST_REQUIRE(requiredDefault.validate().has_value());
    BOOST_CHECK(has(*requiredDefault.validate(), "required"));

    Parser unexpectedDefault(Command("prog").addArgument(
        Argument("color").optional().expect({"red", "blue"}).defaultValue("green")));
    BOOST_REQUIRE(unexpectedDefault.validate().has_value());
    BOOST_CHECK(has(*unexpectedDefault.validate(), "outside its expected values"));

    Parser refusedDefault(
        Command("prog").addArgument(Argument("count").optional().defaultValue("0").validate(
            [](std::string_view, std::string *error) {
                *error = "zero is reserved";
                return false;
            })));
    BOOST_REQUIRE(refusedDefault.validate().has_value());
    BOOST_CHECK(has(*refusedDefault.validate(), "zero is reserved"));

    CommandCatalogue catalogue;
    catalogue.addOptions("Common", {"--missing"});
    Parser badCatalogue(Command("prog").addOption(Option({"-f"}, "Force")).setCatalogue(catalogue));
    BOOST_REQUIRE(badCatalogue.validate().has_value());
    BOOST_CHECK(has(*badCatalogue.validate(), "unknown member"));

    CommandCatalogue duplicateCatalogue;
    duplicateCatalogue.addOptions("Common", {"-f"}).addOptions("Other", {"-f"});
    Parser duplicateGroup(
        Command("prog").addOption(Option({"-f"}, "Force")).setCatalogue(duplicateCatalogue));
    BOOST_REQUIRE(duplicateGroup.validate().has_value());
    BOOST_CHECK(has(*duplicateGroup.validate(), "more than one group"));
}

BOOST_AUTO_TEST_CASE(test_validation_uses_the_requested_matching_rules) {
    Parser parser(Command("prog")
                      .addOption(Option({"--force"}, "Force"))
                      .addOption(Option({"--FORCE"}, "Also force"))
                      .addCommand(Command("copy"))
                      .addCommand(Command("COPY")));

    BOOST_CHECK(!parser.validate().has_value());
    BOOST_CHECK(parser.validate(Parser::IgnoreOptionCase).has_value());
    BOOST_CHECK(parser.validate(Parser::IgnoreCommandCase).has_value());
}

BOOST_AUTO_TEST_CASE(test_a_tree_is_checked_only_on_request_or_by_a_debug_parse) {
    // Deliberately stateful instrumentation, not an example of a validator to write. It makes
    // the otherwise invisible release guarantee measurable.
    int calls = 0;
    const auto &tree = [&calls] {
        return Command("prog").addArgument(Argument("count").optional().defaultValue("1").validate(
            [&calls](std::string_view, std::string *) {
                ++calls;
                return true;
            }));
    };

    Parser parser(tree());
    BOOST_CHECK_EQUAL(calls, 0);
    parser.setRootCommand(tree());
    BOOST_CHECK_EQUAL(calls, 0);

    BOOST_CHECK(!parser.validate().has_value());
    BOOST_CHECK_EQUAL(calls, 1);

    calls = 0;
    BOOST_CHECK(ok(parser, {}).isValid());
#ifdef NDEBUG
    BOOST_CHECK_EQUAL(calls, 0);
#else
    BOOST_CHECK_EQUAL(calls, 1);
#endif
}

// ---------------------------------------------------------------------------------------------
// Reuse, ownership and what outlives what
// ---------------------------------------------------------------------------------------------

// A parser is not spent by parsing, and the tree under it can be replaced afterwards. What was
// handed out goes on reading the tree it was parsed against, since a result holds that tree
// rather than the parser, and setRootCommand puts a new pointer there rather than assigning
// through the old one.
BOOST_AUTO_TEST_CASE(test_a_parser_is_reusable_and_its_tree_can_be_replaced) {
    Parser parser(Command("prog", "The first tree")
                      .addArgument(Argument("path"))
                      .addOption(Option({"-f"}, "Force")));
    parser.setTextWidth(80);

    // Two results from one parser, neither reading the other's values.
    auto first = parser.parse(argv({"-f", "one"}));
    auto second = parser.parse(argv({"two"}));
    BOOST_CHECK(first.option("-f").has_value());
    BOOST_CHECK(!second.option("-f").has_value());
    BOOST_CHECK_EQUAL(must(first.value(0)), "one");
    BOOST_CHECK_EQUAL(must(second.value(0)), "two");

    parser.setRootCommand(Command("other", "The second tree").addArgument(Argument("target")));

    // Both go on reading what they were parsed against, values and help text alike.
    BOOST_CHECK_EQUAL(must(first.value(0)), "one");
    BOOST_CHECK(first.option("-f").has_value());
    BOOST_CHECK_EQUAL(must(second.value(0)), "two");
    BOOST_CHECK(has(first.helpText(), "Usage:\n    prog"));
    BOOST_CHECK(has(first.helpText(), "<path>"));
    BOOST_CHECK(has(first.helpText(), "The first tree"));
    BOOST_CHECK(!has(first.helpText(), "other"));

    // And the next parse is against the new one.
    auto third = parser.parse(argv({"x"}));
    BOOST_CHECK(has(third.helpText(), "Usage:\n    other"));
    BOOST_CHECK(has(third.helpText(), "<target>"));
    BOOST_CHECK(!third.option("-f").has_value());
    BOOST_CHECK_EQUAL(must(third.value(0)), "x");
}

// One command line, parsed once, one owner of the answer. It used to copy, and the copy aliased
// rather than duplicated, which is a thing to be able to do by accident and never to want.
BOOST_AUTO_TEST_CASE(test_a_result_has_one_owner) {
    static_assert(!std::is_copy_constructible_v<ParseResult>, "a result is not copied");
    static_assert(!std::is_copy_assignable_v<ParseResult>, "a result is not copied");
    // Noexcept, or a vector of them copies where it means to move, and there is no copy.
    static_assert(std::is_nothrow_move_constructible_v<ParseResult>, "a result moves");
    static_assert(std::is_nothrow_move_assignable_v<ParseResult>, "a result moves");

    auto parser = formatterTree();
    auto first = parser.parse(argv({"-o", "out.txt", "in.txt"}));
    BOOST_REQUIRE(first.isValid());

    // Moved, and everything it hands out points into where it went.
    auto second = std::move(first);
    BOOST_CHECK_EQUAL(must(second.value(0)), "in.txt");
    BOOST_CHECK_EQUAL(must(second.valueForOption("-o")), "out.txt");
    BOOST_CHECK(has(second.helpText(), "Usage:"));

    // Which is what a container of them needs.
    std::vector<ParseResult> results;
    results.push_back(std::move(second));
    results.push_back(parser.parse(argv({"-o", "b", "a"})));
    BOOST_CHECK_EQUAL(must(results.front().value(0)), "in.txt");
    BOOST_CHECK_EQUAL(must(results.back().value(0)), "a");
}

// A formatter is handed over rather than owned, since a ParseResult prints its own help without
// being given the parser that made it and has to keep whatever made that help alive.
BOOST_AUTO_TEST_CASE(test_a_formatter_outlives_the_parser_that_used_it) {
    auto formatter = std::make_shared<Braces>();
    ParseResult result;
    {
        auto parser = formatterTree();
        parser.setHelpFormatter(formatter);
        result = parser.parse(argv({}));
    }
    BOOST_CHECK(has(result.helpText(), "{path}"));

    // Nothing is kept in one between calls, so the same formatter answers for two parsers.
    auto one = formatterTree();
    auto two = formatterTree();
    one.setHelpFormatter(formatter);
    two.setHelpFormatter(formatter);
    BOOST_CHECK_EQUAL(one.parse(argv({})).helpText(), two.parse(argv({})).helpText());
}

// Null is how a program stops using one, rather than leaving a parser that cannot answer for
// its own help text.
BOOST_AUTO_TEST_CASE(test_no_formatter_means_the_plain_one) {
    auto parser = formatterTree();
    BOOST_CHECK(parser.helpFormatter() != nullptr);

    parser.setHelpFormatter(std::make_shared<Braces>());
    BOOST_CHECK(has(parser.parse(argv({})).helpText(), "{path}"));

    parser.setHelpFormatter(nullptr);
    BOOST_CHECK(parser.helpFormatter() != nullptr);
    BOOST_CHECK(has(parser.parse(argv({})).helpText(), "<path>"));
}

// What a formatter is handed to work from, which is the same thing the default works from.
BOOST_AUTO_TEST_CASE(test_a_result_answers_for_what_its_help_is_made_from) {
    auto parser = helpTree();
    auto root = parser.parse(argv({}));

    BOOST_CHECK_EQUAL(root.prologue(), "A prologue line");
    BOOST_CHECK_EQUAL(root.epilogue(), "An epilogue line");
    BOOST_CHECK(!root.helpLayout().isEmpty());
    // The root has nothing above it, so it inherits nothing.
    BOOST_CHECK(root.inheritedOptions().empty());

    auto sub = parser.parse(argv({"copy", "a", "b"}));
    BOOST_REQUIRE_EQUAL(sub.inheritedOptions().size(), 1u);
    BOOST_CHECK(sub.inheritedOptions().front()->isRecursive());
}

// The measuring a formatter needs to lay a block out itself, lent out rather than written again.
BOOST_AUTO_TEST_CASE(test_the_formatter_lends_out_what_it_measures_with) {
    auto lines = HelpFormatter::wrapped("one two three four", 9);
    BOOST_REQUIRE_EQUAL(lines.size(), 3u);
    BOOST_CHECK_EQUAL(lines[0], "one two");
    BOOST_CHECK_EQUAL(lines[2], "four");

    HelpBlock block;
    block.entries = {
        {"-v",        "Say more"},
        {"--verbose", "The same"}
    };
    BOOST_CHECK_EQUAL(HelpFormatter::widestOf(block), 9u);

    HelpBlock wider;
    wider.entries = {
        {"--configuration", ""}
    };
    BOOST_CHECK_EQUAL(HelpFormatter::widestOf(std::vector<HelpBlock>{block, wider}), 15u);
}

// The left column is measured in columns too. A metavar written in a script that is not ASCII
// is longer in bytes than it is wide, and counting bytes pushes every description in the block
// further right than it belongs.
BOOST_AUTO_TEST_CASE(test_alignment_counts_columns_not_bytes) {
    // <妯″紡>: eight bytes, six columns. <path> is six of each.
    const std::string metavar = "\xe6\xa8\xa1\xe5\xbc\x8f";
    BOOST_REQUIRE_EQUAL(stdc::console::display_width("<" + metavar + ">"), 6);
    BOOST_REQUIRE_EQUAL(("<" + metavar + ">").size(), 8u);

    Parser parser(Command("prog")
                      .addArgument(Argument("path", "Where to write"))
                      .addArgument(Argument("mode", "How to write it").metavar(metavar)));
    parser.setTextWidth(80);
    auto text = parser.parse({"prog", "a", "b"}).helpText();

    // The widest entry in the block is followed by exactly the gap, and here both are as wide
    // as each other, so both are. Counting bytes gives the wider-in-bytes one a padding it does
    // not need and moves the whole column.
    // Found by description, since the usage line above holds the metavars too.
    for (const auto &pair : {std::make_pair(std::string("<path>"), std::string("Where to write")),
                             std::make_pair("<" + metavar + ">", std::string("How to write it"))}) {
        auto lines = entryLines(text, pair.second);
        BOOST_REQUIRE_MESSAGE(!lines.empty(), "no row for " + pair.second);
        auto at = lines[0].find(pair.second);
        BOOST_REQUIRE(at != std::string::npos);

        auto left = lines[0].substr(0, at);
        BOOST_CHECK_MESSAGE(has(left, pair.first),
                            "[" + left + "] is not the row for " + pair.first);
        auto spaces = left.size() - left.find_last_not_of(' ') - 1;
        BOOST_CHECK_MESSAGE(spaces == 4, pair.first + " is followed by " + std::to_string(spaces) +
                                             " spaces, not 4");
    }
}

// A width of zero, the default, means ask rather than assume. Off a terminal that answer comes
// from COLUMNS, and from 80 columns when even that is unset.
BOOST_AUTO_TEST_CASE(test_the_default_width_is_asked_for) {
    Parser parser(Command("prog").addOption(
        Option({"-x"}, "A description long enough that it has to be broken somewhere along the "
                       "way, wherever that turns out to be")));
    BOOST_CHECK_EQUAL(parser.textWidth(), 0);

    const char *saved = std::getenv("COLUMNS");
    std::string keep = saved ? saved : std::string();
    const auto &setColumns = [](const char *value) {
#ifdef _WIN32
        _putenv_s("COLUMNS", value ? value : "");
#else
        if (value) {
            setenv("COLUMNS", value, 1);
        } else {
            unsetenv("COLUMNS");
        }
#endif
    };

    setColumns(nullptr);
    auto wide = entryLines(parser.parse({"prog"}).helpText(), "-x");

    setColumns("40");
    auto narrow = entryLines(parser.parse({"prog"}).helpText(), "-x");

    setColumns(saved ? keep.c_str() : nullptr);

    BOOST_CHECK_GT(narrow.size(), wide.size());

    // And an explicit width ignores the environment entirely.
    setColumns("40");
    parser.setTextWidth(200);
    BOOST_CHECK_EQUAL(entryLines(parser.parse({"prog"}).helpText(), "-x").size(), 1u);
    setColumns(saved ? keep.c_str() : nullptr);
}

// Reading gives back something that owns what it holds, so it survives the result it came from.
//
// A view is the cheaper default and the wrong one. Everything a result hands back as a view
// points into the result's own storage, and the shape below is what a caller writes without
// thinking about it. With a view for a default it read freed storage, which the address
// sanitizer says outright and an ordinary build says by printing whatever was there.
// The other half of the split OptionResult warns about: the handle borrows from the result, and
// what is read through it owns. So a value taken while the result is alive is still good after
// both are gone, and only the handle itself is what must not outlive anything.
BOOST_AUTO_TEST_CASE(test_a_read_through_an_option_handle_owns_what_it_answers) {
    Parser parser(Command("prog").addOption(Option({"-j"}, "Jobs").arg("n")));

    std::optional<int> jobs;
    std::optional<std::string> raw;
    std::vector<std::string> all;
    {
        auto result = parser.parse(argv({"-j", "8"}));
        auto handle = result.option("-j");
        BOOST_REQUIRE(handle);
        BOOST_CHECK_EQUAL(handle->count(), 1);

        // The declaration behind the handle, which is what a program reads to find out what it
        // was that matched. It points into the tree the result holds alive, not into the handle.
        BOOST_REQUIRE(handle->option() != nullptr);
        BOOST_CHECK_EQUAL(handle->option()->token(), "-j");
        BOOST_CHECK_EQUAL(handle->option()->description(), "Jobs");

        jobs = handle->value<int>();
        raw = handle->value<std::string>();
        auto values = handle->values<std::string>();
        BOOST_REQUIRE(values);
        all = *values;
    }

    BOOST_CHECK(jobs == 8);
    BOOST_CHECK(raw == std::string("8"));
    BOOST_REQUIRE_EQUAL(all.size(), 1u);
    BOOST_CHECK_EQUAL(all[0], "8");
}

BOOST_AUTO_TEST_CASE(test_a_read_outlives_the_result_it_came_from) {
    Parser parser(Command("prog")
                      .addArgument(Argument("source"))
                      .addOption(Option({"-f"}, "File").arg("path")));

    auto positional = parser.parse(argv({"-f", "some/path.txt", "the-source"})).value(0);
    auto from_option =
        parser.parse(argv({"-f", "some/path.txt", "the-source"})).valueForOption("-f");
    auto several = parser.parse(argv({"-f", "some/path.txt", "the-source"})).values(0);

    static_assert(std::is_same_v<decltype(positional), std::optional<std::string>>,
                  "the default read has to own what it holds");
    static_assert(std::is_same_v<decltype(from_option), std::optional<std::string>>,
                  "the default read has to own what it holds");
    static_assert(std::is_same_v<decltype(several), std::optional<std::vector<std::string>>>,
                  "the default read has to own what it holds");

    BOOST_CHECK_EQUAL(must(positional), "the-source");
    BOOST_CHECK_EQUAL(must(from_option), "some/path.txt");
    BOOST_REQUIRE_EQUAL(must(several).size(), 1u);
    BOOST_CHECK_EQUAL(must(several)[0], "the-source");

    // A view is still there for a caller who asks for one, and is still theirs to keep alive.
    auto result = parser.parse(argv({"-f", "some/path.txt", "the-source"}));
    static_assert(std::is_same_v<decltype(result.value<std::string_view>(0)),
                                 std::optional<std::string_view>>,
                  "asking for a view still gives a view");
    BOOST_CHECK_EQUAL(must(result.value<std::string_view>(0)), "the-source");
    BOOST_CHECK_EQUAL(must(result.rawValue(0)), "the-source");
}

BOOST_AUTO_TEST_CASE(test_reading_a_result_that_failed) {
    // A caller that forgets to check isValid still gets answers rather than a walk off an end.
    Parser parser(Command("prog").addArgument(Argument("needed")));
    auto result = parser.parse(argv({}));
    BOOST_REQUIRE(!result.isValid());

    BOOST_CHECK(!result.rawValue(0).has_value());
    BOOST_CHECK(result.command() != nullptr);
    BOOST_CHECK_EQUAL(capturedStderr([&] { BOOST_CHECK_EQUAL(result.invoke(-3), -3); }).empty(),
                      false);
    BOOST_CHECK(!result.errorText().empty());
    // Help still renders, which is what a program prints when it says what went wrong.
    BOOST_CHECK(has(result.helpText(), "Usage:"));
}

BOOST_AUTO_TEST_SUITE_END()

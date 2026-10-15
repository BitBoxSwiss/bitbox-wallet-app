// SPDX-License-Identifier: MIT

/// \file commandline.h
///
/// Declaring what a program takes on its command line, and reading back what it was given.
///
/// The shape of the API comes from SysCmdLine, https://github.com/SineStriker/syscmdline, which
/// this replaces. Everything it declares is in the \ref cli module, which carries the prose.

#ifndef STDCORELIB_COMMANDLINE_H
#define STDCORELIB_COMMANDLINE_H

#include <algorithm>
#include <cassert>
#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <type_traits>
#include <vector>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/console.h>
#include <stdcorelib/str.h>
#include <stdcorelib/flags.h>
#include <stdcorelib/adt/array_view.h>

/// \defgroup cli Command line
///
/// Declaring what a program takes on its command line, and reading back what it was given. Replaces
/// SysCmdLine, https://github.com/SineStriker/syscmdline.
///
/// A tree of stdc::cli::Command, each carrying its stdc::cli::Argument and stdc::cli::Option, is
/// handed to a stdc::cli::Parser. What comes back is a stdc::cli::ParseResult, and everything read
/// out of one answers with \c std::optional, so a value that is not there and a value that is empty
/// are different answers.
///
/// \code
///     using namespace stdc;
///
///     cli::Parser parser(cli::Command("prog", "What it is for")
///                            .addArgument(cli::Argument("path", "Where to work"))
///                            .addOption(cli::Option({"-j", "--jobs"}, "How many at once")
///                                           .arg(cli::Argument("n").type<int>()))
///                            .addHelpOption(true)
///                            .addVersionOption("1.0.0"));
///
///     return parser.invoke(system::command_line_arguments());
/// \endcode
///
/// \c invoke() reports a parse that failed, answers \c --help and a \c --version with text to
/// print, and otherwise runs the handler of the command that was reached. Its return value is
/// what \c main returns.
///
/// \section cli_shape What a command line looks like
///
/// \verbatim
///     prog  remote add   --force file.txt -j 4
///           \________/   \_____________________/
///            the path      everything it takes, in any order among themselves
/// \endverbatim
///
/// The names come first and nothing goes between them. A command line names the command it
/// wants by naming each one down to it, and the first token that is not one of those names ends
/// the path and settles what was reached. Everything after belongs to that command: its own
/// options, the ones marked Option::recursive() by the commands above it, and its arguments,
/// with no order among them beyond what a greedy argument forces.
///
/// So \c prog \c --plain \c sub is an error rather than a way to reach \c sub, even where the
/// root declares \c --plain. This is SysCmdLine's rule and it is not git's, whose root options
/// go before the subcommand name. Option::recursive() is how an option of one command is
/// written on a line that reached another.
///
/// \subsection cli_shape_lines What parses and what does not
///
/// \code
///   cli::Command("prog")
///       .addOption(cli::Option({"--plain"}, "The root's own"))
///       .addOption(cli::Option({"--wide"}, "The root's, recursive").recursive())
///       .addCommand(cli::Command("sub")
///                       .addArgument(cli::Argument("path"))
///                       .addOption(cli::Option({"-f"}, "The subcommand's")));
/// \endcode
///
/// \verbatim
///   prog --plain                 the root was reached, and --plain is the root's own
///   prog sub -f a                sub was reached, -f is its own, a is its argument
///   prog sub --wide -f a         --wide came down from the root, being recursive
///   prog sub a -f --wide         no order among options and arguments once the path is over
///
///   prog --plain sub             no: an option ends the path, so sub is written too late
///   prog --wide sub              no: the same. Recursive says where an option may be
///                                written, not that the path stops coming first
///   prog sub --plain             no: --plain is the root's and was not marked recursive
///   prog -f sub                  no: -f is sub's, and the root is what --f was written after
/// \endverbatim
///
/// \subsection cli_shape_greedy Arguments that take more than one
///
/// Argument::Multiple leaves a token for each required argument after it, so
/// \c copy \c \<src\>... \c \<dest\> works wherever arguments are declared. Argument::Remainder
/// leaves nothing and stops option reading where it starts, which is how a program says what its
/// own terminator is spelled. Nothing is reserved for \c -- : a program that wants the usual word
/// declares it.
///
/// \code
///   cli::Command("copy")
///       .addArgument(cli::Argument("src").multi())
///       .addArgument(cli::Argument("dest"))
///       .addOption(cli::Option({"-f"}, "Read the names from")
///                      .arg(cli::Argument("list").multi()))
///       .addOption(cli::Option({"--"}, "The rest")
///                      .arg(cli::Argument("rest").nargs(cli::Argument::Remainder).optional()));
/// \endcode
///
/// \verbatim
///   copy a b c                   src took a and b, dest the one reserved for it
///   copy a b c -f x y            the arguments first, then -f to the end of the line
///   copy a b c -f x -- y         -f's run ended at --, that being a declared option
///   copy a b c -- -f x           -- reads no options, so -f is one of its values
///
///   copy -f x y a b c            no: -f took all five and left <src> and <dest> nothing
/// \endverbatim
///
/// A greedy run ends at the next declared option, so a command that has arguments of its own and
/// an option that is greedy wants the arguments written first, or the option takes them.
///
/// A Remainder starts where the argument before it was filled. Where it is a command's first
/// argument there is none, so it starts at the first token not written as an option, which is
/// what lets a wrapper take options of its own and hand the rest on:
///
/// \code
///   cli::Command("run")
///       .addArgument(cli::Argument("rest").nargs(cli::Argument::Remainder).optional())
///       .addOption(cli::Option({"-u"}, "As user").arg("who"));
/// \endcode
///
/// \verbatim
///   run -u root ls -u x          -u root is run's, ls -u x is the tail's, one spelling twice
///   run ls -u x                  nothing of run's was written, so all of it is the tail
///
///   run -w ls                    no: written as an option and not declared, so not passed on
/// \endverbatim
///
/// A value may be written against its option, \c --opt=v or \c -Ov, and it is the first value
/// of the option's first argument rather than the whole of it, so \c --opt=a \c b reads as
/// \c --opt \c a \c b wherever that argument takes more than one. The joined spelling
/// Option::shortMatch() allows is the exception: one token carries one value, so it is offered
/// only where the option's one argument takes exactly one.
///
/// \subsection cli_shape_trees What a tree should not be
///
/// These are mistakes in the program rather than in what a user typed. parse() asserts that the
/// whole tree is valid in a debug build. A program that builds one dynamically may call
/// Parser::validate() and report the reason itself.
///
/// An argument should not
/// \li have no name, or share a name with another argument beside it, a command's own and an
///     option's being two lists
/// \li be required where one before it may be left out, since one token could be meant for
///     either
/// \li follow an Argument::Remainder, which leaves nothing to follow it with
/// \li follow an Argument::Multiple unless it is a required Argument::Single, that being the one
///     thing the reservation rule leaves room for
/// \li expect() a value its own type() cannot read
/// \li carry a defaultValue() that its type(), its expect() or its validate() turns down, or
///     carry one at all while being required, a default being what stands in where nothing was
///     given
///
/// An option should not
/// \li have no spelling, or one shorter than two characters, or one starting with neither \c -
///     nor \c /
/// \li repeat one of its own spellings
/// \li share a spelling with another option of the same command
/// \li be required or take arguments where its prior() is Option::AutoSetWhenNoSymbols, since
///     nobody writes one of those and there is nothing to give it
/// \li be told by multi() that it may be given a negative number of times
///
/// A command should not
/// \li hold a subcommand with no name, or two subcommands sharing one
/// \li hold an Argument::Remainder and an option whose argument is greedy, both wanting the rest
///     of the line where only one of them can be written first
///
/// A CommandCatalogue should not name something its command does not contain, or name one thing
/// twice, in one group or across two of the same kind.
///
/// And a tree should not, which is only visible once it is one
/// \li have two options in scope at one command answering to one spelling, the recursive ones of
///     every command above it included
/// \li have two names in one scope that differ only in case, where the parse ignores case
/// \li have two spellings a value may be stuck to where one is the start of the other, \c -D and
///     \c -Da against \c -Dabc, which no rule can settle
///
/// \section cli_help Changing the help text
///
/// Five rungs, and a program climbs only as far as it needs to. Each one is written in terms of
/// the one below it, so nothing is reimplemented to change one thing.
///
/// \verbatim
///   1  how much room it has          parser.setIndent(2)
///                                    parser.setSpacing(1)
///                                    parser.setTextWidth(100)
///
///   2  how it is printed             layout.setTitleStyle({console::bold})
///                                    layout.setBodyStyle(HelpBlock::Epilogue, {...})
///
///   3  which blocks, in what order   HelpLayout().add(HelpBlock::Usage)
///                                                .add(HelpBlock::Options)
///                                                .add(myOwnBlock)
///
///   4  how a block is made or laid   struct Mine : HelpFormatter {
///      out, one rung at a time           std::vector<HelpBlock> blocks(...) const override {
///                                            auto res = HelpFormatter::blocks(...);
///                                            ...
///                                        }
///                                    };
///
///   5  none of the above             for (auto &block : result.helpBlocks()) { ... }
/// \endverbatim
///
/// Rungs 1 to 3 are settings on the Parser and need no type of your own. Rung 4 is
/// HelpFormatter, which is a ladder of its own and carries the diagram of it. Rung 5 hands the
/// blocks over and gets out of the way.

namespace stdc::cli {

    /// \addtogroup cli
    /// @{

    /// How a token is turned into a \c T, and what to call \c T in the help text.
    ///
    /// A command line is text, so everything here is stored as text and converted when it is
    /// read. Specialize this to accept a type of your own:
    ///
    /// \code
    ///   template <>
    ///   struct stdc::cli::value_traits<fs::path> {
    ///       static bool parse(std::string_view token, fs::path *out) {
    ///           *out = token;
    ///           return true;
    ///       }
    ///       static const char *type_name() {
    ///           return "path";
    ///       }
    ///   };
    /// \endcode
    ///
    /// \c parse returns false for a token the type cannot represent, which is what turns
    /// \c --count=x into a diagnostic rather than a zero.
    template <class T, class Enable = void>
    struct value_traits;

    namespace detail {

        /// A type's check and its name, as function pointers, so that Argument can hold a
        /// type without being a template.
        struct value_type_info {
            /// Whether the token is a \c T. Null means anything goes, which is the default.
            bool (*check)(std::string_view) = nullptr;
            /// The name used in diagnostics and in the help text. Must be a literal, since
            /// it is held rather than copied.
            const char *name = nullptr;
        };

        template <class T>
        bool check_value(std::string_view token) {
            T out{};
            return value_traits<T>::parse(token, &out);
        }

        template <class T>
        value_type_info type_info_for() {
            return {&check_value<T>, value_traits<T>::type_name()};
        }

        /// What a ParseResult holds.
        class parse_data;

        STDC_EXPORT bool parse_signed(std::string_view token, int64_t *out, int64_t min,
                                      int64_t max);
        STDC_EXPORT bool parse_unsigned(std::string_view token, uint64_t *out, uint64_t max);
        STDC_EXPORT bool parse_floating(std::string_view token, float *out);
        STDC_EXPORT bool parse_floating(std::string_view token, double *out);
        STDC_EXPORT bool parse_floating(std::string_view token, long double *out);
        STDC_EXPORT bool parse_boolean(std::string_view token, bool *out);

    }

    /// Text, which is what a command line already is.
    template <>
    struct value_traits<std::string> {
        static inline bool parse(std::string_view token, std::string *out) {
            out->assign(token);
            return true;
        }
        static inline const char *type_name() {
            return "string";
        }
    };

    /// A view into the result's own storage, which outlives the read.
    template <>
    struct value_traits<std::string_view> {
        static inline bool parse(std::string_view token, std::string_view *out) {
            *out = token;
            return true;
        }
        static inline const char *type_name() {
            return "string";
        }
    };

    /// \c true, \c false, \c yes, \c no, \c on, \c off, \c 1 and \c 0, in any case.
    template <>
    struct value_traits<bool> {
        static inline bool parse(std::string_view token, bool *out) {
            return detail::parse_boolean(token, out);
        }
        static inline const char *type_name() {
            return "bool";
        }
    };

    /// Every integer type except \c bool, which has its own above. The range of the target
    /// type is part of the check, so \c 300 is not a \c uint8_t.
    template <class T>
    struct value_traits<T, std::enable_if_t<std::is_integral_v<T> && !std::is_same_v<T, bool>>> {
        static inline bool parse(std::string_view token, T *out) {
            if constexpr (std::is_signed_v<T>) {
                int64_t v;
                if (!detail::parse_signed(token, &v, int64_t(std::numeric_limits<T>::min()),
                                          int64_t(std::numeric_limits<T>::max()))) {
                    return false;
                }
                *out = T(v);
            } else {
                uint64_t v;
                if (!detail::parse_unsigned(token, &v, uint64_t(std::numeric_limits<T>::max()))) {
                    return false;
                }
                *out = T(v);
            }
            return true;
        }
        static inline const char *type_name() {
            return std::is_signed_v<T> ? "int" : "uint";
        }
    };

    /// \c float, \c double and \c long double. Uses the matching function from the \c strto*
    /// family rather than \c from_chars, which libc++ did not implement for floating point for
    /// a long time.
    template <class T>
    struct value_traits<T, std::enable_if_t<std::is_floating_point_v<T>>> {
        static inline bool parse(std::string_view token, T *out) {
            return detail::parse_floating(token, out);
        }
        static inline const char *type_name() {
            return "number";
        }
    };

    class ParseResult;
    class HelpFormatter;

    /// One positional value a command or an option takes.
    class Argument {
    public:
        /// How many tokens it takes.
        enum Arity {
            /// Exactly one.
            Single,
            /// One or more, also called greedy. Leaves enough tokens for the required arguments
            /// after it, so \c copy \c \<src\>... \c \<dest\> works.
            Multiple,
            /// Everything left, options included, which is why nothing may follow one. Where it
            /// starts is where option reading stops, so this is how a program spells its own
            /// terminator.
            ///
            /// Where it starts is where the argument before it was filled. Where it is the
            /// first argument there is none, so it starts at the first token not written as
            /// an option, which is what lets a wrapper take options of its own:
            /// \c run \c -u \c root \c ls \c -l gives \c -u to \c run and \c -l to \c ls.
            ///
            /// \note Required like any other argument, so an empty tail wants optional().
            Remainder,
        };

        /// Answers whether \a token is acceptable, and says why in \a error when it is not.
        ///
        /// It may be called repeatedly with the same token, including while the command tree is
        /// validated. It should have no observable side effects and should give the same answer
        /// without depending on how many times it has been called or on mutable external state.
        using Validator = std::function<bool(std::string_view token, std::string *error)>;

        Argument() = default;

        inline Argument(std::string name, std::string desc = {}, bool required = true)
            : _name(std::move(name)), _desc(std::move(desc)), _required(required) {
        }

        /// The name to show in the help text, when it should differ from name().
        inline Argument &metavar(std::string displayName) {
            _displayName = std::move(displayName);
            return *this;
        }
        inline Argument &required(bool on = true) {
            _required = on;
            return *this;
        }
        inline Argument &optional(bool on = true) {
            _required = !on;
            return *this;
        }
        /// The value the result gives when the argument was not given. Stored as text and
        /// converted when read.
        ///
        /// \pre It is readable as whatever type<T>() declared, and is one of the values
        ///      expect() allows, if either was given.
        inline Argument &defaultValue(std::string value) {
            _default = std::move(value);
            _hasDefault = true;
            return *this;
        }
        /// The only values this accepts, for an argument that is a choice between a few
        /// words.
        ///
        /// \pre Every one of them is readable as whatever type<T>() declared.
        inline Argument &expect(std::vector<std::string> values) {
            _expected = std::move(values);
            return *this;
        }
        /// What this argument accepts beyond being readable as its type.
        ///
        /// \pre It accepts defaultValue(), where there is one. Only what a command line wrote is
        ///      put past it while parsing, so a default it refuses would be handed back without
        ///      ever being asked about.
        inline Argument &validate(Validator validator) {
            _validator = std::move(validator);
            return *this;
        }
        inline Argument &nargs(Arity arity) {
            _arity = arity;
            return *this;
        }
        inline Argument &multi(bool on = true) {
            _arity = on ? Multiple : Single;
            return *this;
        }
        /// Declares the type. Tokens are checked against it while parsing, and its name
        /// appears in the help text. Without it any token is accepted.
        ///
        /// \pre Whatever expect() was given, if anything, is readable as a \c T.
        template <class T>
        inline Argument &type() {
            _type = detail::type_info_for<T>();
            return *this;
        }

        inline const std::string &name() const {
            return _name;
        }
        inline const std::string &description() const {
            return _desc;
        }
        /// The metavar if one was given, and the name otherwise.
        inline const std::string &displayName() const {
            return _displayName.empty() ? _name : _displayName;
        }
        inline bool isRequired() const {
            return _required;
        }
        inline bool hasDefaultValue() const {
            return _hasDefault;
        }
        inline const std::string &defaultValue() const {
            return _default;
        }
        inline const std::vector<std::string> &expectedValues() const {
            return _expected;
        }
        inline const Validator &validator() const {
            return _validator;
        }
        inline Arity arity() const {
            return _arity;
        }
        inline const detail::value_type_info &typeInfo() const {
            return _type;
        }

    private:
        std::string _name;
        std::string _desc;
        std::string _displayName;
        std::string _default;
        std::vector<std::string> _expected;
        Validator _validator;
        detail::value_type_info _type;
        Arity _arity = Single;
        bool _required = true;
        bool _hasDefault = false;
    };

    /// A named switch, with any number of arguments of its own.
    class Option {
    public:
        /// What the option means, for the two the library answers by itself. A role brings the
        /// usual spellings and description, and lets a caller ask by role rather than by
        /// spelling.
        ///
        /// The set is closed, and it is these two because these two are what the library does
        /// something with. A role for a switch it only carries the spelling of would be a
        /// second way of writing Option({"-V", "--verbose"}, "Print more information").
        ///
        /// \note A role says nothing about scope, which is recursive(), nor about where an option
        ///       sits in the help text, which is where it was declared.
        enum Role {
            NoRole,
            Version,
            Help,
        };

        /// How much of a short token the parser may take for this option, so that \c -O2 or
        /// \c -DKEY=VALUE can be one token rather than two.
        enum ShortMatch {
            /// \c -D and its value are separate tokens.
            NoShortMatch,
            /// A single letter may be followed by the value, as in \c -O2.
            ShortMatchSingleLetter,
            /// A single character, letter or not.
            ShortMatchSingleChar,
            /// The whole token after the option's own, as in \c -DKEY=VALUE.
            ShortMatchAll,
        };

        /// The highest level among the options given decides. This is what lets \c --help be
        /// answered on a command line that is missing everything it requires.
        ///
        /// ###QUESTION: Should automatic activation and exclusivity be split from missing-value
        /// priority? This enum prevents combining those policies and orders unrelated values.
        enum Prior {
            NoPrior,
            /// Its own missing arguments are not an error.
            IgnoreMissingArguments,
            /// Nothing missing anywhere is an error.
            IgnoreMissingSymbols,
            /// Set it when nothing else was given at all.
            AutoSetWhenNoSymbols,
            /// Giving it means no arguments may be given.
            ExclusiveToArguments,
            /// Giving it means no other options may be given.
            ExclusiveToOptions,
            /// Giving it means nothing else may be given.
            ExclusiveToAll,
        };

        Option() = default;

        inline Option(std::vector<std::string> tokens, std::string desc = {})
            : _tokens(std::move(tokens)), _desc(std::move(desc)) {
        }
        inline Option(std::initializer_list<std::string> tokens, std::string desc = {})
            : Option(std::vector<std::string>(tokens), std::move(desc)) {
        }
        inline Option(std::string token, std::string desc = {})
            : Option(std::vector<std::string>{std::move(token)}, std::move(desc)) {
        }
        /// Deliberately not explicit, so that \c addOptions({Option::Help}) reads the way it
        /// does. Empty tokens take the usual spelling for the role.
        inline Option(Role role, std::vector<std::string> tokens = {}, std::string desc = {})
            : _tokens(tokens.empty() ? defaultTokens(role) : std::move(tokens)),
              _desc(desc.empty() ? defaultDescription(role) : std::move(desc)), _role(role) {
        }

        /// Adds an argument. An option's argument needs no description of its own.
        inline Option &arg(std::string name, bool required = true) {
            return arg(Argument(std::move(name), {}, required));
        }
        inline Option &arg(Argument argument) {
            _args.emplace_back(std::move(argument));
            return *this;
        }
        inline Option &required(bool on = true) {
            _required = on;
            return *this;
        }
        /// Whether a value may be stuck to the spelling, \c -Dfoo rather than \c -D \c foo.
        ///
        /// \note A permission rather than a promise. One token carries one value, so an option
        ///       that takes no argument, takes an optional one, takes more than one, or whose
        ///       one argument is greedy is never matched this way whatever is set here. Written
        ///       out with a space they all work.
        inline Option &shortMatch(ShortMatch rule) {
            _shortMatch = rule;
            return *this;
        }
        inline Option &prior(Prior level) {
            _prior = level;
            return *this;
        }
        /// In scope for every command below this one as well as for this one.
        ///
        /// Without it an option can be given only where the command declaring it is the one that
        /// was reached, since every option is written after its own command.
        inline Option &recursive(bool on = true) {
            _recursive = on;
            return *this;
        }
        /// How many times the option may be given, zero meaning without limit.
        ///
        /// What repeats is the whole occurrence: every time the option is written it reads its
        /// arguments again, into a set of its own that OptionResult::at() hands back. How many
        /// values one argument takes within one occurrence is a different question, and
        /// Argument::multi() is where it is asked.
        /// \pre \a maxOccurrence is not negative. A negative is not a smaller limit, it is one
        ///      the count can never reach, which reads back as no limit at all.
        inline Option &multi(int maxOccurrence = 0) {
            _maxOccurrence = maxOccurrence;
            return *this;
        }

        inline const std::vector<std::string> &tokens() const {
            return _tokens;
        }
        /// The first spelling, which is the one the help text and diagnostics use.
        inline const std::string &token() const {
            assert(!_tokens.empty() && "an option with no spelling has no token");
            return _tokens.front();
        }
        inline const std::string &description() const {
            return _desc;
        }
        inline const std::vector<Argument> &arguments() const {
            return _args;
        }
        inline bool isRequired() const {
            return _required;
        }
        inline bool isRecursive() const {
            return _recursive;
        }
        inline Role role() const {
            return _role;
        }
        inline ShortMatch shortMatch() const {
            return _shortMatch;
        }
        inline Prior prior() const {
            return _prior;
        }
        inline int maxOccurrence() const {
            return _maxOccurrence;
        }

        /// What a role says about itself in the help text when nothing else was given.
        static inline std::string defaultDescription(Role role) {
            switch (role) {
                case Help:
                    return "Show this help and exit";
                case Version:
                    return "Show the version and exit";
                default:
                    return {};
            }
        }

        /// The spellings a role answers to when none were given.
        static inline std::vector<std::string> defaultTokens(Role role) {
            switch (role) {
                case Help:
                    return {"-h", "--help"};
                case Version:
                    return {"-v", "--version"};
                default:
                    return {};
            }
        }

    private:
        std::vector<std::string> _tokens;
        std::string _desc;
        std::vector<Argument> _args;
        Role _role = NoRole;
        ShortMatch _shortMatch = NoShortMatch;
        Prior _prior = NoPrior;
        int _maxOccurrence = 1;
        bool _required = false;
        bool _recursive = false;
    };

    /// Which heading each name is listed under in the help text. Anything not named here goes
    /// under the default heading, so a catalogue only has to mention what it wants to move.
    class CommandCatalogue {
    public:
        struct Group {
            std::string name;
            std::vector<std::string> members;
        };

        inline CommandCatalogue &addCommands(std::string group, std::vector<std::string> names) {
            _commands.push_back({std::move(group), std::move(names)});
            return *this;
        }
        inline CommandCatalogue &addOptions(std::string group, std::vector<std::string> names) {
            _options.push_back({std::move(group), std::move(names)});
            return *this;
        }
        inline CommandCatalogue &addArguments(std::string group, std::vector<std::string> names) {
            _arguments.push_back({std::move(group), std::move(names)});
            return *this;
        }

        inline const std::vector<Group> &commandGroups() const {
            return _commands;
        }
        inline const std::vector<Group> &optionGroups() const {
            return _options;
        }
        inline const std::vector<Group> &argumentGroups() const {
            return _arguments;
        }
        inline bool isEmpty() const {
            return _commands.empty() && _options.empty() && _arguments.empty();
        }

    private:
        std::vector<Group> _commands;
        std::vector<Group> _options;
        std::vector<Group> _arguments;
    };

    /// A command, its arguments, its options and whatever subcommands it has.
    class Command {
    public:
        /// What to run once this command is the one that was named. Its return value is the
        /// program's.
        using Handler = std::function<int(const ParseResult &)>;

        Command() = default;

        inline Command(std::string name, std::string desc = {})
            : _name(std::move(name)), _desc(std::move(desc)) {
        }

        inline Command &addArgument(Argument argument) {
            _args.emplace_back(std::move(argument));
            return *this;
        }
        inline Command &addArguments(std::vector<Argument> arguments) {
            for (auto &item : arguments) {
                addArgument(std::move(item));
            }
            return *this;
        }
        inline Command &addOption(Option option) {
            _options.emplace_back(std::move(option));
            return *this;
        }
        inline Command &addOptions(std::vector<Option> options) {
            for (auto &item : options) {
                addOption(std::move(item));
            }
            return *this;
        }
        inline Command &addCommand(Command command) {
            _commands.emplace_back(std::move(command));
            return *this;
        }
        inline Command &addCommands(std::vector<Command> commands) {
            for (auto &item : commands) {
                addCommand(std::move(item));
            }
            return *this;
        }

        inline Command &setHandler(Handler handler) {
            _handler = std::move(handler);
            return *this;
        }
        inline Command &setCatalogue(CommandCatalogue catalogue) {
            _catalogue = std::move(catalogue);
            return *this;
        }
        /// What a Version option prints.
        inline Command &setVersion(std::string version) {
            _version = std::move(version);
            return *this;
        }

        /// The version option, with the level that lets it be answered on a command line that is
        /// otherwise missing everything it needs.
        ///
        /// The switch is this command's and the string cascades, so a subcommand adds its own
        /// switch and says a version of its own or does not. An empty \a version is the second
        /// of those: the switch answers here with whatever the nearest command above it said.
        /// Where the whole path is empty, invoke() leaves the Version role for the handler.
        /// \sa ParseResult::versionText()
        ///
        /// \code
        ///   root.addVersionOption("1.0");
        ///   root.findCommand("sub")->addVersionOption("");   // prog sub --version prints 1.0
        /// \endcode
        inline Command &addVersionOption(std::string version, std::vector<std::string> tokens = {},
                                         std::string desc = {}) {
            _version = std::move(version);
            return addOption(Option(Option::Version, std::move(tokens), std::move(desc))
                                 .prior(Option::IgnoreMissingSymbols));
        }

        /// The help option, likewise.
        ///
        /// \param showIfNoArguments Answer a command line with nothing on it at all, so that a
        ///        bare program name prints its help.
        /// \param recursive Keep it in scope for the subcommands as well.
        /// \param tokens The spellings, or the usual ones when empty.
        /// \param desc The description, or the usual one when empty.
        inline Command &addHelpOption(bool showIfNoArguments = false, bool recursive = false,
                                      std::vector<std::string> tokens = {}, std::string desc = {}) {
            return addOption(Option(Option::Help, std::move(tokens), std::move(desc))
                                 .prior(showIfNoArguments ? Option::AutoSetWhenNoSymbols
                                                          : Option::IgnoreMissingSymbols)
                                 .recursive(recursive));
        }
        inline Command &setDescription(std::string desc) {
            _desc = std::move(desc);
            return *this;
        }

        inline const std::string &name() const {
            return _name;
        }
        inline const std::string &description() const {
            return _desc;
        }
        inline const std::string &version() const {
            return _version;
        }
        inline const std::vector<Argument> &arguments() const {
            return _args;
        }
        inline const std::vector<Option> &options() const {
            return _options;
        }
        inline const std::vector<Command> &commands() const {
            return _commands;
        }
        inline const Handler &handler() const {
            return _handler;
        }
        inline const CommandCatalogue &catalogue() const {
            return _catalogue;
        }

        /// The subcommand named \a name, or null. Only one level down.
        inline const Command *findCommand(std::string_view name) const {
            for (const auto &item : _commands) {
                if (item._name == name) {
                    return &item;
                }
            }
            return nullptr;
        }

        /// The option answering to \a token, or null. A token is any of an option's spellings,
        /// not only the first.
        inline const Option *findOption(std::string_view token) const {
            for (const auto &item : _options) {
                for (const auto &spelling : item.tokens()) {
                    if (spelling == token) {
                        return &item;
                    }
                }
            }
            return nullptr;
        }

    private:
        std::string _name;
        std::string _desc;
        std::string _version;
        std::vector<Argument> _args;
        std::vector<Option> _options;
        std::vector<Command> _commands;
        Handler _handler;
        CommandCatalogue _catalogue;
    };

    /// What one option was given.
    ///
    /// A view onto the ParseResult it came from, the way \c std::string_view is a view onto a
    /// string. It owns nothing and keeps nothing alive. One exists only where the option was
    /// given, so there is no such thing as an empty one and nothing here has to ask.
    ///
    /// \warning Do not outlive that result. \c parser.parse(args).option("-f") reads freed
    ///          storage at the semicolon, since the result it was taken from was a temporary.
    /// \sa ParseResult::option()
    class STDC_EXPORT OptionResult {
    public:
        /// One appearance of the option, read the way a ParseResult is read.
        ///
        /// A command is given once and an option may be given many times, which is the whole
        /// of the difference between them. So this is what a ParseResult is for a command,
        /// with the same four questions asked of it in the same four words, and OptionResult
        /// is these in a row.
        ///
        /// \warning A view onto a view, so it lasts as long as the ParseResult and not a line
        ///          longer. One always stands for an occurrence that happened, which is what
        ///          OptionResult::at()'s precondition is for.
        class STDC_EXPORT Occurrence {
        public:
            /// The \a index'th argument's first value, as text, or the default value where
            /// there is one, or nothing when there is neither.
            ///
            /// An option given an empty value, \c --prefix= , has one, and it is the empty
            /// string. That is why this answers with an optional rather than with empty text:
            /// whether a token is there and whether the token is empty are different questions.
            ///
            /// \warning Points into the ParseResult and lasts exactly as long as it does. Ask
            ///          value<T>() for something that owns what it holds.
            std::optional<std::string_view> rawValue(int index = 0) const;

            /// Every value the \a index'th argument took here, which is more than one only
            /// where the argument said it accepts more than one.
            ///
            /// \warning The same. These point into the ParseResult.
            std::vector<std::string_view> rawValues(int index = 0) const;

            /// Converted, or nothing when there is nothing to convert.
            template <class T = std::string>
            std::optional<T> value(int index = 0) const {
                auto raw = rawValue(index);
                if (!raw) {
                    return std::nullopt;
                }
                T out{};
                if (!value_traits<T>::parse(*raw, &out)) {
                    return std::nullopt;
                }
                return out;
            }

            /// Every value the \a index'th argument took here, converted, or nothing when one
            /// of them is not a \c T.
            template <class T = std::string>
            std::optional<std::vector<T>> values(int index = 0) const {
                std::vector<T> out;
                for (auto raw : rawValues(index)) {
                    T item{};
                    if (!value_traits<T>::parse(raw, &item)) {
                        return std::nullopt;
                    }
                    out.push_back(std::move(item));
                }
                return out;
            }

        private:
            friend class OptionResult;
            inline Occurrence(const void *data, int n) : _data(data), _n(n) {
            }
            const void *_data;
            int _n;
        };

        /// How many times the option was given, which is at least once.
        int count() const;

        /// The option itself.
        const Option *option() const;

        /// The \a n'th time it was given, counting from zero.
        ///
        /// \code
        ///   for (int n = 0; n < given.count(); ++n) {
        ///       take(given.at(n).values());
        ///   }
        /// \endcode
        ///
        /// \pre \a n is at least zero and less than count(). Anything else is undefined, and
        ///      is asserted in a debug build. An Occurrence is a view onto one that happened,
        ///      so there is no such thing as an empty one to hand back and nothing on it to
        ///      ask, which is the same reason ParseResult::option() answers with an optional
        ///      and OptionResult does not.
        Occurrence at(int n) const;

        /// The four below are the first occurrence's four, said shorter. An option given once
        /// is what nearly every option is, and there is nothing else it could mean.
        ///
        /// What an option has that a command has not is that it may be given again, and that
        /// is at() and the two all-prefixed below. Neither is folded into these: an option
        /// read without saying which occurrence reads the first.
        inline std::optional<std::string_view> rawValue(int index = 0) const {
            return at(0).rawValue(index);
        }
        inline std::vector<std::string_view> rawValues(int index = 0) const {
            return at(0).rawValues(index);
        }
        /// \code
        ///   int jobs = default_jobs();
        ///   if (auto given = result.option("-j")) {
        ///       jobs = given->value<int>().value_or(jobs);
        ///   }
        /// \endcode
        template <class T = std::string>
        std::optional<T> value(int index = 0) const {
            return at(0).value<T>(index);
        }
        template <class T = std::string>
        std::optional<std::vector<T>> values(int index = 0) const {
            return at(0).values<T>(index);
        }

        /// Every value the \a index'th argument took, in every occurrence, in the order they
        /// were written.
        ///
        /// This is what a repeated option is usually asked, \c -I \c a \c -I \c b answering
        /// with both, and the reason it is spelled apart from the four above is that they
        /// would otherwise mean one thing for an option given once and another for the same
        /// option given twice.
        ///
        /// \warning Points into the ParseResult and lasts exactly as long as it does. Ask
        ///          allValues<T>() for something that owns what it holds.
        std::vector<std::string_view> allRawValues(int index = 0) const;

        /// The same, converted, or nothing when one of them is not a \c T. An empty vector
        /// means there were none to convert.
        template <class T = std::string>
        std::optional<std::vector<T>> allValues(int index = 0) const {
            std::vector<T> out;
            for (auto raw : allRawValues(index)) {
                T item{};
                if (!value_traits<T>::parse(raw, &item)) {
                    return std::nullopt;
                }
                out.push_back(std::move(item));
            }
            return out;
        }

    private:
        friend class ParseResult;
        inline OptionResult(const void *data) : _data(data) {
        }
        const void *_data;
    };

    /// How a run of help text is printed.
    ///
    /// Ignored by ParseResult::helpText(), which answers with plain text, and applied by
    /// ParseResult::showHelp(), which prints.
    struct TextStyle {
        /// A bitwise or of console::style values.
        int style = console::nostyle;
        /// One console::color value rather than a bitwise or of several.
        int foreground = console::nocolor;
        int background = console::nocolor;
    };

    inline bool operator==(const TextStyle &a, const TextStyle &b) {
        return a.style == b.style && a.foreground == b.foreground && a.background == b.background;
    }

    inline bool operator!=(const TextStyle &a, const TextStyle &b) {
        return !(a == b);
    }

    /// One block of the help text: a heading, and under it either a paragraph or a two column
    /// list.
    ///
    /// This is what the help text is made of before it is laid out. A program that wants
    /// something HelpLayout cannot say asks ParseResult::helpBlocks() for these and prints them
    /// itself.
    class HelpBlock {
    public:
        /// One row of a list: what it is called on the left, what it does on the right.
        struct Entry {
            std::string left;
            std::string right;
        };

        /// Which part of the help text this is.
        ///
        /// \note One role becomes zero or more blocks. A command with no options contributes no
        ///       Options block, and a CommandCatalogue splits the options it does have across a
        ///       block per group.
        enum Role {
            /// The text above everything, printed without a heading.
            Prologue,
            Description,
            Usage,
            Arguments,
            Options,
            /// What the commands above this one declared recursive and it therefore has.
            ///
            /// Titled "Global options" in the text, that being the word a reader of a
            /// help page knows for an option that is not this command's own.
            InheritedOptions,
            Commands,
            /// The text below everything, printed without a heading.
            Epilogue,
            /// A block the program wrote itself.
            Custom,
        };

        Role role = Custom;
        /// The heading, written without its colon, which the layout adds. An empty title means
        /// the block has no heading and its body sits at the margin.
        std::string title;
        /// The body of a block that is prose. Newlines already in it are kept.
        std::string text;
        /// The rows of a block that is a list. A block is prose or a list, never both.
        std::vector<Entry> entries;

        TextStyle titleStyle;
        /// The prose of a paragraph, and the right hand column of a list.
        TextStyle bodyStyle;
        /// The left hand column of a list, where the names are worth setting apart from what
        /// they do.
        TextStyle entryStyle;

        inline bool isEmpty() const {
            return text.empty() && entries.empty();
        }
    };

    /// Which blocks the help text is made of, in what order, and how each is printed.
    ///
    /// A plain value. Start from defaultLayout() and change what is worth changing:
    ///
    /// \code
    ///   auto layout = cli::HelpLayout::defaultLayout();
    ///   layout.setTitleStyle({console::bold});
    ///   layout.setBodyStyle(cli::HelpBlock::Epilogue, {console::bold, console::yellow});
    ///   parser.setHelpLayout(layout);
    /// \endcode
    class HelpLayout {
    public:
        /// Every role once, in the order the help text has always printed them.
        static inline HelpLayout defaultLayout() {
            HelpLayout res;
            for (auto role : {HelpBlock::Prologue, HelpBlock::Description, HelpBlock::Usage,
                              HelpBlock::Arguments, HelpBlock::Options, HelpBlock::InheritedOptions,
                              HelpBlock::Commands, HelpBlock::Epilogue}) {
                res.add(role);
            }
            return res;
        }

        /// Appends the standard block for \a role. A role added twice prints its contents twice.
        inline HelpLayout &add(HelpBlock::Role role) {
            HelpBlock block;
            block.role = role;
            _blocks.push_back(std::move(block));
            return *this;
        }

        /// Appends a block of the program's own, laid out and aligned like the rest.
        inline HelpLayout &add(HelpBlock block) {
            _blocks.push_back(std::move(block));
            return *this;
        }

        /// \name Styling
        ///
        /// The overloads without a role reach every block the layout holds at the time of the
        /// call, so add whatever blocks of your own you have before calling one.
        /// @{
        inline HelpLayout &setTitleStyle(TextStyle style) {
            for (auto &block : _blocks) {
                block.titleStyle = style;
            }
            return *this;
        }
        inline HelpLayout &setTitleStyle(HelpBlock::Role role, TextStyle style) {
            for (auto &block : _blocks) {
                if (block.role == role) {
                    block.titleStyle = style;
                }
            }
            return *this;
        }
        inline HelpLayout &setBodyStyle(TextStyle style) {
            for (auto &block : _blocks) {
                block.bodyStyle = style;
            }
            return *this;
        }
        inline HelpLayout &setBodyStyle(HelpBlock::Role role, TextStyle style) {
            for (auto &block : _blocks) {
                if (block.role == role) {
                    block.bodyStyle = style;
                }
            }
            return *this;
        }
        inline HelpLayout &setEntryStyle(TextStyle style) {
            for (auto &block : _blocks) {
                block.entryStyle = style;
            }
            return *this;
        }
        inline HelpLayout &setEntryStyle(HelpBlock::Role role, TextStyle style) {
            for (auto &block : _blocks) {
                if (block.role == role) {
                    block.entryStyle = style;
                }
            }
            return *this;
        }
        /// @}

        /// The slots, in order. A standard role carries no contents here, only the styles its
        /// blocks are made with.
        inline const std::vector<HelpBlock> &blocks() const {
            return _blocks;
        }

        inline bool isEmpty() const {
            return _blocks.empty();
        }

    private:
        std::vector<HelpBlock> _blocks;
    };

    /// What a command line turned out to mean, or why it did not.
    class STDC_EXPORT ParseResult {
    public:
        enum Error {
            NoError,
            UnknownOption,
            UnknownCommand,
            MissingOptionArgument,
            MissingCommandArgument,
            TooManyArguments,
            InvalidArgumentValue,
            MissingRequiredOption,
            OptionOccurTooMuch,
            ArgumentTypeMismatch,
            ArgumentValidateFailed,
            PriorOptionWithArguments,
            PriorOptionWithOptions,
            ErrorReadingResponseFile,
        };

        ParseResult();

        /// Move only: one command line, parsed once, one owner of the answer.
        ParseResult(const ParseResult &RHS) = delete;
        ParseResult &operator=(const ParseResult &RHS) = delete;
        ParseResult(ParseResult &&RHS) noexcept;
        ParseResult &operator=(ParseResult &&RHS) noexcept;
        ~ParseResult();

        inline bool isValid() const {
            return error() == NoError;
        }
        Error error() const;
        /// What went wrong, ready to be printed.
        const std::string &errorText() const;
        /// The declared names close enough to what was typed to be worth offering, ready to be
        /// printed. Empty when nothing is close, and when the failure was not a mistyped name.
        std::string correctionText() const;

        /// The command that was reached, which is the root when no subcommand was named.
        const Command *command() const;
        /// The names from the root down to it, the root first.
        const std::vector<std::string> &commandPath() const;

        /// What a Version option prints: the innermost command on the path that was given one,
        /// so a root that says a version passes it to everything under it.
        /// \sa Command::setVersion(), Command::addVersionOption()
        std::string versionText() const;

        /// Everything a \c main does with a command line, and its return value is what \c main
        /// returns.
        ///
        /// \li a parse that failed is reported, and \a errorCode comes back
        /// \li a Help option, or a Version option with nonempty versionText(), is answered and
        ///     0 comes back without the handler running. That is what keeps \c prog \c copy
        ///     \c --help from doing whatever copy does.
        /// \li otherwise the handler of the command that was reached runs, and \a errorCode
        ///     comes back where there is none. This includes a Version option for which the
        ///     command path supplies no text, so the handler may answer it itself.
        ///
        /// A program that wants to answer any of this itself calls parse() and does so. There
        /// is nothing left over for a caller of this to have to finish.
        inline int invoke(int errorCode = -1) const {
            if (!isValid()) {
                showError();
                return errorCode;
            }
            if (isRoleSet(Option::Help)) {
                showHelp();
                return 0;
            }
            if (isRoleSet(Option::Version)) {
                auto version = versionText();
                if (!version.empty()) {
                    console::u8puts(version);
                    return 0;
                }
            }
            const Command *target = command();
            if (!target || !target->handler()) {
                return errorCode;
            }
            return target->handler()(*this);
        }

        /// Whether an option carrying \a role was given, whatever it was spelled as.
        bool isRoleSet(Option::Role role) const;

        /// What \a token was given, or nothing when it was not given at all, which covers an
        /// option nobody declared as well as one nobody wrote.
        ///
        /// \code
        ///   if (auto force = result.option("-f")) { ... }
        /// \endcode
        ///
        /// \note What comes back reads out of this result rather than copying, so it is good only
        ///       while this one is. What that rules out is on OptionResult.
        /// \sa OptionResult
        std::optional<OptionResult> option(std::string_view token) const;

        /// The \a index'th positional argument of the command that was reached, as text, or
        /// the default value where there is one, or nothing when there is neither.
        ///
        /// An argument given an empty string has one, and it is the empty string. That is why
        /// this answers with an optional rather than with empty text.
        ///
        /// \warning Points into this result and lasts exactly as long as it does. Ask value<T>()
        ///          for something that owns what it holds.
        std::optional<std::string_view> rawValue(int index = 0) const;
        /// Every token the \a index'th positional argument took.
        ///
        /// \warning The same. These point into this result.
        std::vector<std::string_view> rawValues(int index = 0) const;

        /// Converted, or nothing when there is nothing to convert.
        ///
        /// Nothing means one of two things: no token is there and no default value stands in
        /// for it, or a token is there that is not a \c T. Declaring the type on the Argument
        /// turns the second into a diagnostic while parsing, which leaves this meaning only the
        /// first.
        ///
        /// \code
        ///   int jobs = result.value<int>(0).value_or(default_jobs());
        /// \endcode
        template <class T = std::string>
        std::optional<T> value(int index = 0) const {
            auto raw = rawValue(index);
            if (!raw) {
                return std::nullopt;
            }
            T out{};
            if (!value_traits<T>::parse(*raw, &out)) {
                return std::nullopt;
            }
            return out;
        }
        /// Every token the \a index'th argument took, converted, or nothing when one of them
        /// is not a \c T. An empty vector means there were none to convert.
        template <class T = std::string>
        std::optional<std::vector<T>> values(int index = 0) const {
            std::vector<T> out;
            for (auto raw : rawValues(index)) {
                T item{};
                if (!value_traits<T>::parse(raw, &item)) {
                    return std::nullopt;
                }
                out.push_back(std::move(item));
            }
            return out;
        }

        /// The first argument of \a token's first occurrence.
        template <class T = std::string>
        std::optional<T> valueForOption(std::string_view token) const {
            auto given = option(token);
            return given ? given->value<T>() : std::nullopt;
        }

        /// Printed above and below the help text, as the parser was told.
        const std::string &prologue() const;
        const std::string &epilogue() const;
        /// Which blocks the help text is made of, in what order, and how each is printed.
        const HelpLayout &helpLayout() const;
        /// What the commands above the one that was reached declared recursive, which is in
        /// scope here and is demanded here, gathered by the walk the parser made.
        ///
        /// \warning These point into the command tree and last as long as it does.
        std::vector<const Option *> inheritedOptions() const;

        /// The help text for the command that was reached, as the blocks it is made of, in the
        /// order the layout asks for and with the groups a catalogue asks for already split.
        ///
        /// This is what helpText() lays out. Ask for these where neither HelpLayout nor a
        /// HelpFormatter can say what the program wants, and print them however it likes.
        std::vector<HelpBlock> helpBlocks() const;

        /// The help text for the command that was reached, prologue and epilogue included.
        std::string helpText() const;
        /// Writes helpText() to stdout, with whatever styling the layout asks for.
        void showHelp() const;
        /// Writes what went wrong to stderr, with a line saying how to ask for help. Does
        /// nothing when the parse succeeded.
        void showError() const;

    private:
        friend class Parser;

        using Impl = detail::parse_data;
        std::unique_ptr<Impl> _impl;
    };

    /// Turns arguments into a ParseResult against a command tree.
    ///
    /// \li Subcommands form the first contiguous part of the line. Once an option or argument
    ///     is read, no later token can name a subcommand. Thus \c prog \c copy \c -f \c x can
    ///     reach \c copy, while \c prog \c -V \c copy \c x cannot.
    /// \li Positional tokens a command cannot take are an error.
    /// \li An option that needs a value will not take a token that is a declared option of the
    ///     same command. Anything else beginning with a dash is a value as it is there.
    class STDC_EXPORT Parser {
    public:
        /// What the tokenizer will accept beyond the usual.
        enum ParseOption {
            Standard = 0,
            /// Subcommand names match without regard to case.
            IgnoreCommandCase = 0x1,
            /// Option tokens match without regard to case.
            IgnoreOptionCase = 0x2,
            /// \c -abc means \c -a \c -b \c -c.
            AllowUnixGroupFlags = 0x4,
            /// \c /f is another way of writing \c -f.
            AllowDosShortOptions = 0x8,
            /// A single dash starts nothing.
            DontAllowUnixShortOptions = 0x10,
            /// \c \@file is replaced by the lines of that file.
            EnableResponseFile = 0x20,
        };
        STDC_DECLARE_FLAGS(ParseOptions, ParseOption)

        /// What the help text says beyond the necessary. Which blocks it is made of and in what
        /// order is HelpLayout's business rather than this one's.
        enum DisplayOption {
            Normal = 0,
            /// Say what an argument falls back to when it is not given.
            ShowArgumentDefaultValue = 0x1,
            /// List the words an argument accepts, where it accepts only a few.
            ShowArgumentExpectedValues = 0x2,
            /// Mark the options that have to be given.
            ShowOptionIsRequired = 0x4,
            /// Line the descriptions of every group up with each other, so that a catalogue
            /// reads as one table.
            AlignAllCatalogues = 0x8,
            /// Keep showError() from offering the names close to what was typed.
            SkipCorrection = 0x10,
        };
        STDC_DECLARE_FLAGS(DisplayOptions, DisplayOption)

        Parser();
        explicit Parser(Command root);
        ~Parser();

        Parser(const Parser &RHS) = delete;
        Parser &operator=(const Parser &RHS) = delete;

        /// Movable, so that a parser can be built and returned by a function of its own.
        Parser(Parser &&RHS) noexcept;
        Parser &operator=(Parser &&RHS) noexcept;

        /// Sets a new root command, replacing the one given to the constructor or the one the
        /// last parse() ran against.
        void setRootCommand(Command root);
        const Command &rootCommand() const;

        /// Printed above and below the help text.
        void setPrologue(std::string text);
        const std::string &prologue() const;
        void setEpilogue(std::string text);
        const std::string &epilogue() const;

        void setDisplayOptions(DisplayOptions options);
        DisplayOptions displayOptions() const;

        /// How many columns the help text may use, which is what its descriptions are wrapped
        /// to.
        ///
        /// \param width the column count, or 0 to ask the terminal each time the text is made
        /// \note 0 is the default. Where there is no terminal to ask, as when the output is a
        ///       pipe, that comes out as 80 columns, so a program's help reads the same however
        ///       it is captured.
        /// \sa console::width()
        void setTextWidth(int width);
        int textWidth() const;

        /// How far the body of a section is indented from the margin.
        /// \note Four columns is the default.
        void setIndent(int columns);
        int indent() const;

        /// How many columns separate the two columns of a list.
        /// \note Four columns is the default.
        void setSpacing(int columns);
        int spacing() const;

        /// Which blocks the help text is made of, in what order, and how each is printed.
        /// \note HelpLayout::defaultLayout() is what a parser starts with.
        void setHelpLayout(HelpLayout layout);
        const HelpLayout &helpLayout() const;

        /// How those blocks are made and laid out, for a program that wants something no
        /// arrangement of the above can say.
        ///
        /// \note A plain HelpFormatter is what a parser starts with, and null puts that back.
        ///       Nothing is kept in one between calls, so a formatter may be shared.
        /// \sa HelpFormatter, which is a ladder rather than one method
        void setHelpFormatter(std::shared_ptr<HelpFormatter> formatter);
        const std::shared_ptr<HelpFormatter> &helpFormatter() const;

        /// Checks whether the command tree can be parsed under \a parseOptions.
        ///
        /// \return nothing when it is valid, or a description of the first problem found
        /// \note parse() performs this check only through an assertion. A program that accepts
        ///       a command tree from somewhere else should call this explicitly before parsing.
        std::optional<std::string> validate(ParseOptions parseOptions = Standard) const;

        /// What \a args means against the command tree.
        ///
        /// \pre validate() returns nothing. This is asserted in a debug build. A release build
        ///      does not walk the tree before parsing.
        /// \note A program whose command tree is built dynamically, such as from plugins,
        ///       should call validate() explicitly before this even in a release build.
        inline ParseResult parse(array_view<std::string> args,
                                 ParseOptions parseOptions = Standard) const {
            assert(!validate(parseOptions).has_value() && "the command tree is invalid");
            return parseImpl(args, parseOptions);
        }
        /// Parses and does everything a \c main does with the answer, reporting a failure and
        /// answering a Help or Version option before any handler runs. \sa ParseResult::invoke()
        inline int invoke(array_view<std::string> args, int errorCode = -1,
                          ParseOptions parseOptions = Standard) const {
            return parse(args, parseOptions).invoke(errorCode);
        }

        /// The same, taking what \c main was handed.
        ///
        /// \warning Not on Windows. What \c main is given there is in the system code page,
        ///          while everything here is UTF-8, so a non-ASCII argument arrives wrong.
        ///          system::command_line_arguments() gives the same list already converted, on
        ///          every platform.
        inline ParseResult parse(int argc, char **argv,
                                 ParseOptions parseOptions = Standard) const {
            return parse(std::vector<std::string>(argv, argv + argc), parseOptions);
        }
        inline int invoke(int argc, char **argv, int errorCode = -1,
                          ParseOptions parseOptions = Standard) const {
            return parse(argc, argv, parseOptions).invoke(errorCode);
        }

    private:
        ParseResult parseImpl(array_view<std::string> args, ParseOptions parseOptions) const;

        class Impl;
        std::unique_ptr<Impl> _impl;
    };

    STDC_DECLARE_OPERATORS_FOR_FLAGS(Parser::ParseOptions)
    STDC_DECLARE_OPERATORS_FOR_FLAGS(Parser::DisplayOptions)

    /// How much room the help text has, and what it says beyond the necessary.
    struct HelpSizes {
        /// How far the body of a section is set in from the margin.
        int indent = 4;
        /// How many columns separate the two columns of a list.
        int spacing = 4;
        /// How many columns the whole text may use.
        int textWidth = 80;
        Parser::DisplayOptions displayOptions;
    };

    /// How the help text is made, from a command tree at the top to printable runs at the
    /// bottom. Rung 4 of \ref cli_help.
    ///
    /// \verbatim
    ///     the command that was reached, and ParseResult::helpLayout()
    ///                    |
    ///                    v
    ///    +---- blocks(result, sizes) ---------- what the text is made of: which blocks
    ///    |               |                      there are, what each is called, what goes
    ///    |               |                      in its two columns
    ///    |               v
    ///    |      displayed(Option, bool) ------- how one name is spelled, before there is
    ///    |               |                      any block to put it in
    ///    |               v                        "-o, --output <file>"
    ///    |      displayed(Argument) -----------   "<file>", "[<file>]", "<file>..."
    ///    |
    ///    +--> std::vector<HelpBlock> ---------> ParseResult::helpBlocks() stops here and
    ///                    |                      hands these over
    ///                    v
    ///    +---- render(blocks, sizes) ---------- the whole page: measures every list, puts a
    ///    |               |                      blank line between one block and the next
    ///    |               v
    ///    |      renderBlock(block, sizes, widest)
    ///    |                                      one block: its heading, its columns lined
    ///    |                                      up to widest, its descriptions wrapped
    ///    |
    ///    +--> std::vector<Run>
    ///                    |
    ///          +---------+---------+
    ///          v                   v
    ///   ParseResult::        ParseResult::
    ///     helpText()           showHelp()
    ///   joins them and       prints them and
    ///   drops the styles     applies the styles
    /// \endverbatim
    ///
    /// Subclass and override the rung that says what wants changing. <b>Every default is public
    /// and callable</b>, which is what keeps "the same as before except for this" down to a call
    /// to the base rather than a renderer written again:
    ///
    /// \code
    ///   struct Shouty : cli::HelpFormatter {
    ///       std::vector<cli::HelpBlock> blocks(const cli::ParseResult &result,
    ///                                          const cli::HelpSizes &sizes) const override {
    ///           auto res = HelpFormatter::blocks(result, sizes);
    ///           for (auto &block : res) {
    ///               block.title = stdc::str::to_upper(block.title);
    ///           }
    ///           return res;
    ///       }
    ///   };
    ///   parser.setHelpFormatter(std::make_shared<Shouty>());
    /// \endcode
    ///
    /// A rung reaches the ones under it through \c this, so overriding
    /// displayed(const Argument &) alone changes every metavar in the usage line and in every
    /// list, without touching anything else.
    ///
    /// Nothing is kept here between calls, so one of these can be shared by every parser in a
    /// program. What there is to keep is HelpSizes, which the parser owns and hands over.
    class STDC_EXPORT HelpFormatter {
    public:
        /// One run of help text and how it is printed. ParseResult::helpText() joins these and
        /// drops the styles, ParseResult::showHelp() prints them and applies them.
        struct Run {
            TextStyle style;
            std::string text;
        };

        HelpFormatter();
        virtual ~HelpFormatter();

        /// How an argument is written where it is named. \c \<file\>, or \c [\<file\>] where it
        /// may be left out, with an ellipsis where it repeats.
        virtual std::string displayed(const Argument &argument) const;

        /// How an option is written, with whatever it takes after it. Every spelling of it in a
        /// list, and the first one alone on the usage line.
        ///
        /// \note The arguments it takes are asked of displayed(const Argument &), so overriding
        ///       that one reaches here too.
        virtual std::string displayed(const Option &option, bool allSpellings) const;

        /// How a subcommand is written where it is named, which is its name.
        virtual std::string displayed(const Command &command) const;

        /// One row of a two column list: what displayed() writes on the left, and on the right
        /// the description together with whatever the display options add to it, a default value
        /// or the set of values expected or a mark that it has to be given.
        ///
        /// \note The left column is asked of displayed(), so overriding that one reaches here
        ///       too. Override this where the right column is what should differ.
        virtual HelpBlock::Entry entry(const Argument &argument, const HelpSizes &sizes) const;

        /// \overload
        virtual HelpBlock::Entry entry(const Option &option, const HelpSizes &sizes) const;

        /// \overload
        virtual HelpBlock::Entry entry(const Command &command, const HelpSizes &sizes) const;

        /// The usage line, already broken across as many lines as it needs.
        ///
        /// \param command the one that was reached, which is where its own options come from
        /// \param path how it was reached, \c args[0] first
        /// \param inherited the options in scope from the commands above it, which is the
        ///        one thing here that \a command cannot answer for
        /// \param sizes the indent and the width to break the line against
        /// \note Each piece stays whole, since an option and the value it takes read as two
        ///       separate things once a line break comes between them.
        virtual std::string usageText(const Command &command, const std::vector<std::string> &path,
                                      const std::vector<Option> &inherited,
                                      const HelpSizes &sizes) const;

        /// What the help text is made of, in the order ParseResult::helpLayout() asks for and
        /// with the groups a CommandCatalogue asks for already split.
        ///
        /// \note \a sizes is not what \a result was given, and is not to be worked out again
        ///       from it. A text width of zero means ask, and this is the answer, settled once
        ///       and handed to render() as well, so that a terminal resized in between cannot
        ///       lay the usage line out to one width and the descriptions to another.
        virtual std::vector<HelpBlock> blocks(const ParseResult &result,
                                              const HelpSizes &sizes) const;

        /// One block laid out, its heading over it and its columns lined up to \a widest.
        ///
        /// The blank line that separates one block from the next is render()'s, not this one's,
        /// so what comes back is the block and nothing around it.
        virtual std::vector<Run> renderBlock(const HelpBlock &block, const HelpSizes &sizes,
                                             size_t widest) const;

        /// The whole page. Measures the lists, then asks renderBlock() for each block and puts
        /// a blank line between them.
        virtual std::vector<Run> render(const std::vector<HelpBlock> &blocks,
                                        const HelpSizes &sizes) const;

        /// How wide the left column of \a block is.
        ///
        /// In columns rather than in bytes, or a metavar written in a script that is not ASCII
        /// pushes its own row out of line with every other.
        static inline size_t widestOf(const HelpBlock &block) {
            size_t res = 0;
            for (const auto &entry : block.entries) {
                res = std::max(res, size_t(console::display_width(entry.left)));
            }
            return res;
        }

        /// The widest across all of them, which is what AlignAllCatalogues lines up to.
        static inline size_t widestOf(const std::vector<HelpBlock> &blocks) {
            size_t res = 0;
            for (const auto &block : blocks) {
                res = std::max(res, widestOf(block));
            }
            return res;
        }

        /// \a text broken into lines of at most \a columns columns, at spaces where there are
        /// any and between characters where there are none. Newlines already in it are kept.
        static std::vector<std::string> wrapped(const std::string &text, int columns);
    };

    /// @}
}

#endif // STDCORELIB_COMMANDLINE_H

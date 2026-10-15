// SPDX-License-Identifier: MIT

#include "commandline.h"
#include "commandline_p.h"

#include <cerrno>
#include <cstdio>
#include <charconv>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <fstream>
#include <unordered_map>

#include "console.h"
#include "path.h"
#include "utf.h"
#include "pimpl.h"

namespace stdc::cli {

    namespace detail {

        namespace {

            /// Whether \a token is entirely made of what \c from_chars consumed. A number that
            /// stops short of the end of the token, \c 12abc, is not a number.
            bool consumed_all(std::string_view token, const char *end) {
                return end == token.data() + token.size();
            }

            /// \c from_chars refuses a leading plus, which a command line will hand over anyway.
            std::string_view drop_leading_plus(std::string_view token) {
                if (token.size() > 1 && token.front() == '+') {
                    token.remove_prefix(1);
                }
                return token;
            }

            template <class T>
            bool parse_floating_with(std::string_view token, T *out,
                                     T (*convert)(const char *, char **)) {
                if (token.empty()) {
                    return false;
                }
                std::string buf(token);
                errno = 0;
                char *end = nullptr;
                T value = convert(buf.c_str(), &end);
                if (end != buf.c_str() + buf.size() || end == buf.c_str() || errno == ERANGE) {
                    return false;
                }
                *out = value;
                return true;
            }

        }

        bool parse_signed(std::string_view token, int64_t *out, int64_t min, int64_t max) {
            token = drop_leading_plus(token);
            if (token.empty()) {
                return false;
            }
            int64_t v = 0;
            auto res = std::from_chars(token.data(), token.data() + token.size(), v);
            if (res.ec != std::errc{} || !consumed_all(token, res.ptr)) {
                return false;
            }
            if (v < min || v > max) {
                return false;
            }
            *out = v;
            return true;
        }

        bool parse_unsigned(std::string_view token, uint64_t *out, uint64_t max) {
            token = drop_leading_plus(token);
            if (token.empty()) {
                return false;
            }
            // No sign to refuse by hand: from_chars into an unsigned rejects a minus outright.
            // Checked on all three of MSVC, libstdc++ and libc++, each answering invalid_argument
            // and leaving the output alone. The test says so too, since it is their promise this
            // relies on rather than ours.
            uint64_t v = 0;
            auto res = std::from_chars(token.data(), token.data() + token.size(), v);
            if (res.ec != std::errc{} || !consumed_all(token, res.ptr)) {
                return false;
            }
            if (v > max) {
                return false;
            }
            *out = v;
            return true;
        }

        bool parse_floating(std::string_view token, float *out) {
            return parse_floating_with(token, out, std::strtof);
        }

        bool parse_floating(std::string_view token, double *out) {
            return parse_floating_with(token, out, std::strtod);
        }

        bool parse_floating(std::string_view token, long double *out) {
            return parse_floating_with(token, out, std::strtold);
        }

        bool parse_boolean(std::string_view token, bool *out) {
            static const std::string_view yes[] = {"true", "yes", "on", "1"};
            static const std::string_view no[] = {"false", "no", "off", "0"};
            for (auto word : yes) {
                if (str::equals_insensitive(token, word)) {
                    *out = true;
                    return true;
                }
            }
            for (auto word : no) {
                if (str::equals_insensitive(token, word)) {
                    *out = false;
                    return true;
                }
            }
            return false;
        }

    }

    // ---------------------------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------------------------

    namespace {

        /// The tokens one declared argument took. More than one only where the argument said it
        /// accepts more than one.
        using ArgumentValues = std::vector<std::string>;

        /// One appearance of an option, holding a slot per argument it declares.
        /// Named for what it holds rather than for what it is one of, OptionResult::Occurrence
        /// being the public thing that reads it.
        using ArgumentSlots = std::vector<ArgumentValues>;

        struct OptionData {
            const Option *option = nullptr;
            std::vector<ArgumentSlots> occurrences;
        };

        /// Which option a token names, and what the token itself said.
        struct OptionMatch {
            OptionData *data = nullptr;
            /// What was written against the spelling, by an equals sign or by being stuck to
            /// it. Absent where the token was the spelling and nothing else, which is not the
            /// same as present and empty: \c --prefix= sets an empty string.
            std::string_view value;
            /// The spelling as it was written, so that a complaint about the option names it
            /// the way the reader typed it rather than the way it was declared.
            std::string_view spelling;

            explicit operator bool() const {
                return data != nullptr;
            }
        };

        /// How many of \a available tokens the \a index'th of \a declared may take, given
        /// whether it \a has_one already.
        ///
        /// One each for the required arguments still to come, since a greedy one that took the
        /// lot would leave \c copy \c \<src\>... \c \<dest\> with nothing for the destination.
        /// The rule is the same whether the arguments belong to a command or to an option, so it
        /// is written once and both ask.
        ///
        /// Where there are not enough to go round, a greedy argument still takes one, since one
        /// or more is what it promised and the argument that goes without says so itself. That
        /// is the one thing \a has_one changes: a value written against the option has already
        /// kept the promise, so there is nothing left to force and the reservation stands.
        size_t take_for(const std::vector<Argument> &declared, size_t index, size_t available,
                        bool has_one = false) {
            const auto &argument = declared[index];
            if (argument.arity() == Argument::Single) {
                return 1;
            }
            if (argument.arity() == Argument::Remainder) {
                return available;
            }
            size_t reserved = 0;
            for (size_t j = index + 1; j < declared.size(); ++j) {
                if (declared[j].isRequired()) {
                    ++reserved;
                }
            }
            if (available > reserved) {
                return available - reserved;
            }
            return has_one ? 0 : 1;
        }

        bool same_token(std::string_view a, std::string_view b, bool ignore_case) {
            if (!ignore_case) {
                return a == b;
            }
            return str::equals_insensitive(a, b);
        }

    }

    class detail::parse_data {
    public:
        /// Shared with the parser rather than copied, so that the pointers below stay good and
        /// the tree is walked once.
        std::shared_ptr<const Command> root;
        const Command *target = nullptr;
        std::vector<std::string> path;

        /// Per positional argument of the command that was reached.
        std::vector<ArgumentValues> arguments;
        /// Every option in scope, its own and whatever was inherited.
        std::vector<OptionData> options;
        std::unordered_map<std::string, size_t> by_token;

        /// Copied from the parser, so that a result can print its own help without being handed
        /// the parser that made it.
        std::string prologue;
        std::string epilogue;
        HelpLayout help_layout = HelpLayout::defaultLayout();
        /// Shared with the parser rather than copied, since the parser goes on using it for the
        /// next parse while this may outlive it. The same reason root is shared, and the reason
        /// it is not a unique_ptr: there is no one owner to give it to.
        std::shared_ptr<HelpFormatter> formatter;
        Parser::DisplayOptions display_options;
        int text_width = 0;
        int indent = 4;
        int spacing = 4;

        ParseResult::Error error = ParseResult::NoError;
        std::string error_text;

        /// What was typed where a declared name belongs, and the names it might have meant.
        /// Kept rather than measured here, so a program that never prints a correction does not
        /// pay for one.
        std::string error_token;
        std::vector<std::string> error_candidates;

        const OptionData *find(std::string_view token) const {
            auto it = by_token.find(std::string(token));
            return it == by_token.end() ? nullptr : &options[it->second];
        }

        /// The same, for the parser, which fills these in. Writing it out beats a const_cast
        /// admitting the const above was never true of this data.
        OptionData *findForWriting(std::string_view token) {
            auto it = by_token.find(std::string(token));
            return it == by_token.end() ? nullptr : &options[it->second];
        }
    };

    // ---------------------------------------------------------------------------------------
    // OptionResult
    // ---------------------------------------------------------------------------------------

    // Everything here reaches through _data without checking it. ParseResult::option() is the
    // only thing that makes one of these, and it makes one only where there is data to point at.
    int OptionResult::count() const {
        return int(static_cast<const OptionData *>(_data)->occurrences.size());
    }

    const Option *OptionResult::option() const {
        return static_cast<const OptionData *>(_data)->option;
    }

    OptionResult::Occurrence OptionResult::at(int n) const {
        assert(n >= 0 && n < count() && "there was no such occurrence of this option");
        return {_data, n};
    }

    namespace {

        /// The slots of one occurrence. Which occurrence is at()'s precondition, so there is
        /// nothing left to check here and nothing to answer with where there is no such one.
        const ArgumentSlots &slots_of(const void *data, int n) {
            const auto &occurrences = static_cast<const OptionData *>(data)->occurrences;
            assert(n >= 0 && size_t(n) < occurrences.size());
            return occurrences[size_t(n)];
        }

    }

    // The slot is a vector of the tokens that argument took. Whether that vector is empty and
    // whether the token in it is empty are different questions, which is why nothing here is
    // reported as empty text.
    std::optional<std::string_view> OptionResult::Occurrence::rawValue(int index) const {
        const auto &slots = slots_of(_data, _n);
        if (index < 0 || size_t(index) >= slots.size() || slots[size_t(index)].empty()) {
            return std::nullopt;
        }
        return std::string_view(slots[size_t(index)].front());
    }

    std::vector<std::string_view> OptionResult::Occurrence::rawValues(int index) const {
        std::vector<std::string_view> res;
        const auto &slots = slots_of(_data, _n);
        if (index < 0 || size_t(index) >= slots.size()) {
            return res;
        }
        for (const auto &item : slots[size_t(index)]) {
            res.emplace_back(item);
        }
        return res;
    }

    std::vector<std::string_view> OptionResult::allRawValues(int index) const {
        std::vector<std::string_view> res;
        if (index < 0) {
            return res;
        }
        auto data = static_cast<const OptionData *>(_data);
        for (const auto &slots : data->occurrences) {
            if (size_t(index) >= slots.size()) {
                continue;
            }
            for (const auto &item : slots[size_t(index)]) {
                res.emplace_back(item);
            }
        }
        return res;
    }

    // ---------------------------------------------------------------------------------------
    // ParseResult
    // ---------------------------------------------------------------------------------------

    ParseResult::ParseResult() : _impl(std::make_unique<detail::parse_data>()) {
    }

    ParseResult::ParseResult(ParseResult &&RHS) noexcept = default;
    ParseResult &ParseResult::operator=(ParseResult &&RHS) noexcept = default;
    ParseResult::~ParseResult() = default;

    ParseResult::Error ParseResult::error() const {
        stdc_impl_t;
        return impl.error;
    }

    const std::string &ParseResult::errorText() const {
        stdc_impl_t;
        return impl.error_text;
    }

    namespace {

        /// How many single character insertions, deletions and substitutions it takes to turn
        /// one into the other. Two rows rather than the whole table, since only the previous one
        /// is ever read.
        size_t edit_distance(const std::string &a, const std::string &b) {
            std::vector<size_t> row(b.size() + 1);
            for (size_t j = 0; j <= b.size(); ++j) {
                row[j] = j;
            }
            for (size_t i = 1; i <= a.size(); ++i) {
                size_t diagonal = row[0];
                row[0] = i;
                for (size_t j = 1; j <= b.size(); ++j) {
                    size_t above = row[j];
                    row[j] = std::min(
                        {row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] == b[j - 1] ? 0 : 1)});
                    diagonal = above;
                }
            }
            return row[b.size()];
        }

    }

    std::string ParseResult::correctionText() const {
        stdc_impl_t;
        const auto &input = impl.error_token;
        if (input.empty() || impl.error_candidates.empty()) {
            return {};
        }

        // Half of what was typed. Looser than that and every short name is a candidate for every
        // short typo, which is worse than saying nothing.
        const size_t threshold = input.size() / 2;

        // Set in as far as the help text sets a section body in, since this is a list under a
        // line that introduces it and reads as one.
        const std::string margin(size_t(impl.indent < 0 ? 0 : impl.indent), ' ');
        std::string suggestions;
        for (const auto &item : impl.error_candidates) {
            if (edit_distance(input, item) <= threshold) {
                suggestions += "\n" + margin + item;
            }
        }
        if (suggestions.empty()) {
            return {};
        }
        return "\"" + input + "\" is not matched. Do you mean one of the following?" + suggestions;
    }

    const Command *ParseResult::command() const {
        stdc_impl_t;
        return impl.target;
    }

    const std::vector<std::string> &ParseResult::commandPath() const {
        stdc_impl_t;
        return impl.path;
    }

    // The innermost command on the path that was given one, so a subcommand may say a version of
    // its own and everything under a root that says one inherits it.
    std::string ParseResult::versionText() const {
        stdc_impl_t;
        std::string res;
        const Command *at = impl.root.get();
        for (size_t i = 0; at; ++i) {
            if (!at->version().empty()) {
                res = at->version();
            }
            at = i + 1 < impl.path.size() ? at->findCommand(impl.path[i + 1]) : nullptr;
        }
        return res;
    }


    bool ParseResult::isRoleSet(Option::Role role) const {
        if (role == Option::NoRole) {
            return false;
        }
        stdc_impl_t;
        for (const auto &item : impl.options) {
            if (item.option->role() == role && !item.occurrences.empty()) {
                return true;
            }
        }
        return false;
    }

    // Nothing rather than an empty result, so that there is one way to ask whether an option
    // was given and one kind of OptionResult to hold.
    std::optional<OptionResult> ParseResult::option(std::string_view token) const {
        stdc_impl_t;
        auto data = impl.find(token);
        if (!data || data->occurrences.empty()) {
            return std::nullopt;
        }
        return OptionResult(data);
    }

    std::optional<std::string_view> ParseResult::rawValue(int index) const {
        stdc_impl_t;
        if (index < 0 || size_t(index) >= impl.arguments.size() ||
            impl.arguments[size_t(index)].empty()) {
            return std::nullopt;
        }
        return std::string_view(impl.arguments[size_t(index)].front());
    }

    std::vector<std::string_view> ParseResult::rawValues(int index) const {
        stdc_impl_t;
        std::vector<std::string_view> res;
        if (index < 0 || size_t(index) >= impl.arguments.size()) {
            return res;
        }
        for (const auto &item : impl.arguments[size_t(index)]) {
            res.emplace_back(item);
        }
        return res;
    }

    const std::string &ParseResult::prologue() const {
        stdc_impl_t;
        return impl.prologue;
    }

    const std::string &ParseResult::epilogue() const {
        stdc_impl_t;
        return impl.epilogue;
    }

    const HelpLayout &ParseResult::helpLayout() const {
        stdc_impl_t;
        return impl.help_layout;
    }

    // Gathered by walking down the path the way the parser did. What it gathered on the way is
    // what it demands at the end, so this is where the help text has to agree with it.
    std::vector<const Option *> ParseResult::inheritedOptions() const {
        stdc_impl_t;
        std::vector<const Option *> res;
        if (!impl.root || impl.path.size() <= 1) {
            return res;
        }
        const Command *at = impl.root.get();
        for (size_t i = 1; i < impl.path.size() && at; ++i) {
            for (const auto &option : at->options()) {
                if (option.isRecursive()) {
                    res.push_back(&option);
                }
            }
            at = at->findCommand(impl.path[i]);
        }
        return res;
    }

    namespace {

        HelpSizes sizesOf(const detail::parse_data *data) {
            HelpSizes res;
            res.indent = data->indent;
            res.spacing = data->spacing;
            // Zero means ask, and the answer is whatever stdout is: a terminal's width, or 80
            // columns for a pipe or a file, so help captured into one reads the same everywhere.
            res.textWidth = data->text_width > 0 ? data->text_width : console::width(stdout);
            res.displayOptions = data->display_options;
            return res;
        }

        /// The whole help text, laid out but not yet joined. The sizes are worked out once and
        /// used for both halves, so a terminal resized between them cannot lay the usage line
        /// out to one width and the descriptions to another.
        std::vector<HelpFormatter::Run> helpRuns(const ParseResult &result,
                                                 const detail::parse_data *data) {
            if (!data->target || !data->formatter) {
                return {};
            }
            HelpSizes sizes = sizesOf(data);
            return data->formatter->render(data->formatter->blocks(result, sizes), sizes);
        }

    }

    std::vector<HelpBlock> ParseResult::helpBlocks() const {
        stdc_impl_t;
        if (!impl.target || !impl.formatter) {
            return {};
        }
        return impl.formatter->blocks(*this, sizesOf(&impl));
    }

    std::string ParseResult::helpText() const {
        stdc_impl_t;
        std::string out;
        for (const auto &run : helpRuns(*this, &impl)) {
            out += run.text;
        }
        return out;
    }

    void ParseResult::showHelp() const {
        stdc_impl_t;
        // Through the library's own console rather than fwrite, so that one program does not
        // talk to the terminal two different ways, and so a Windows console gets the transcoding
        // it needs.
        for (const auto &run : helpRuns(*this, &impl)) {
            console::fputs(run.style.style, run.style.foreground, run.style.background, run.text,
                           stdout);
        }
    }

    void ParseResult::showError() const {
        if (isValid()) {
            return;
        }
        stdc_impl_t;
        // What went wrong is worth a color where there is one to be had, and console works out
        // for itself whether stderr is somewhere escapes belong.
        console::fputs(console::bold, console::red, console::nocolor, impl.error_text + "\n",
                       stderr);
        if (!impl.display_options.test_flag(Parser::SkipCorrection)) {
            auto correction = correctionText();
            if (!correction.empty()) {
                console::fputs(console::nostyle, console::nocolor, console::nocolor,
                               correction + "\n", stderr);
            }
        }
        // How this program spells asking for help rather than how most of them do. A tree that
        // does not offer it at all gets no line, since pointing at something nobody declared is
        // worse than saying nothing.
        std::string help;
        for (const auto &item : impl.options) {
            if (item.option->role() != Option::Help) {
                continue;
            }
            for (const auto &token : item.option->tokens()) {
                // The long spelling where there is one, since that is the one worth reading.
                if (help.empty() || (help.rfind("--", 0) != 0 && token.rfind("--", 0) == 0)) {
                    help = token;
                }
            }
            break;
        }
        if (impl.target && !help.empty()) {
            std::string name;
            for (size_t i = 0; i < impl.path.size(); ++i) {
                name += (i ? " " : "") + impl.path[i];
            }
            console::fputs(console::nostyle, console::nocolor, console::nocolor,
                           "Try \"" + name + " " + help + "\" for more information.\n", stderr);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Help
    // ---------------------------------------------------------------------------------------

    namespace {

        /// However narrow the terminal, a description gets at least this much. Below it the text
        /// is broken into a column too thin to read, which is worse than running over.
        constexpr int min_description = 20;

    }

    HelpFormatter::HelpFormatter() = default;

    HelpFormatter::~HelpFormatter() = default;

    // At spaces where there are any, and between characters where there are none, which is what
    // a language that writes without spaces needs. Measured in columns rather than in bytes or
    // characters, so a CJK description breaks where it looks like it should.
    std::vector<std::string> HelpFormatter::wrapped(const std::string &text, int columns) {
        std::vector<std::string> lines;
        if (columns < 1) {
            lines.push_back(text);
            return lines;
        }

        auto points = utf::utf8_to_utf32(text);
        std::u32string line;
        int width = 0;
        const auto emit = [&lines](std::u32string piece) {
            while (!piece.empty() && piece.back() == U' ') {
                piece.pop_back();
            }
            lines.push_back(utf::utf32_to_utf8(piece));
        };
        const auto measure = [](const std::u32string &piece) {
            int res = 0;
            for (char32_t c : piece) {
                res += console::display_width(c);
            }
            return res;
        };

        for (char32_t c : points) {
            if (c == U'\n') {
                emit(std::move(line));
                line.clear();
                width = 0;
                continue;
            }
            int w = console::display_width(c);
            if (width + w > columns && !line.empty()) {
                // Back up to the last space, so a word is not cut in half. A word longer than
                // the whole column has no space to back up to and is broken where it reached
                // the edge.
                auto space = line.find_last_of(U' ');
                if (space == std::u32string::npos) {
                    emit(line);
                    line.clear();
                } else {
                    auto tail = line.substr(space + 1);
                    emit(line.substr(0, space));
                    line = tail;
                }
                width = measure(line);
            }
            line.push_back(c);
            width += w;
        }
        emit(std::move(line));
        return lines;
    }

    std::string HelpFormatter::displayed(const Argument &argument) const {
        std::string res = "<" + argument.displayName() + ">";
        if (argument.arity() != Argument::Single) {
            res += "...";
        }
        return argument.isRequired() ? res : "[" + res + "]";
    }

    std::string HelpFormatter::displayed(const Option &option, bool allSpellings) const {
        std::string res;
        if (allSpellings) {
            for (size_t i = 0; i < option.tokens().size(); ++i) {
                res += (i ? ", " : "") + option.tokens()[i];
            }
        } else {
            res = option.token();
        }
        // Through this rather than straight to the one above, so that a formatter overriding
        // only the argument rung reaches every metavar there is.
        for (const auto &argument : option.arguments()) {
            res += " " + displayed(argument);
        }
        return res;
    }

    namespace {

        /// Whether \a option can be printed and typed at all.
        ///
        /// One with no spelling has nothing to show and nothing to be looked up by, and
        /// token() is front() on an empty vector. Command::addOption() asserts on one, so this
        /// only answers false in a release build, where the assert is gone and the option is in
        /// the tree regardless. Asked wherever an option's name is read, so the two places
        /// cannot come to disagree about what counts.
        inline bool spelled(const Option &option) {
            return !option.tokens().empty();
        }

        /// A block that prints the way \a slot asks for, with \a title over it.
        HelpBlock blockLike(const HelpBlock &slot, std::string title) {
            HelpBlock res;
            res.role = slot.role;
            res.title = std::move(title);
            res.titleStyle = slot.titleStyle;
            res.bodyStyle = slot.bodyStyle;
            res.entryStyle = slot.entryStyle;
            return res;
        }

        /// Puts \a items into the groups \a groups asks for, in the order it gives them, with
        /// whatever it does not mention left under \a fallback at the end. One block per group,
        /// all printed the way \a slot asks for.
        template <class T, class Name, class Line>
        std::vector<HelpBlock>
            grouped(const std::vector<T> &items, const std::vector<CommandCatalogue::Group> &groups,
                    const HelpBlock &slot, const std::string &fallback, Name name, Line line) {
            std::vector<HelpBlock> res;
            std::vector<bool> taken(items.size(), false);

            for (const auto &group : groups) {
                HelpBlock block = blockLike(slot, group.name);
                for (const auto &wanted : group.members) {
                    for (size_t i = 0; i < items.size(); ++i) {
                        if (!taken[i] && name(items[i]) == wanted) {
                            block.entries.push_back(line(items[i]));
                            taken[i] = true;
                            break;
                        }
                    }
                }
                if (!block.entries.empty()) {
                    res.push_back(std::move(block));
                }
            }

            HelpBlock rest = blockLike(slot, fallback);
            for (size_t i = 0; i < items.size(); ++i) {
                if (!taken[i]) {
                    rest.entries.push_back(line(items[i]));
                }
            }
            if (!rest.entries.empty()) {
                res.push_back(std::move(rest));
            }
            return res;
        }

        /// Runs that print the same way are one run, so that a plain help text comes out of
        /// showHelp() in a single write rather than in one per column.
        void appendRun(std::vector<HelpFormatter::Run> &out, const TextStyle &style,
                       const std::string &text) {
            if (text.empty()) {
                return;
            }
            if (!out.empty() && out.back().style == style) {
                out.back().text += text;
                return;
            }
            out.push_back({style, text});
        }

        void appendRuns(std::vector<HelpFormatter::Run> &out,
                        const std::vector<HelpFormatter::Run> &more) {
            for (const auto &run : more) {
                appendRun(out, run.style, run.text);
            }
        }

        // Broken into as many lines as the room a section body gets, with the breaks written into
        // the text.
        std::string usage_text(const HelpFormatter &formatter, const Command &command,
                               const std::vector<std::string> &path,
                               const std::vector<Option> &inherited, int indent, int text_width) {
            std::string head;
            for (size_t i = 0; i < path.size(); ++i) {
                head += (i ? " " : "") + path[i];
            }

            // An option that has to be given is not optional information, so it is spelled out
            // where a reader looks first rather than left inside "[options]". The hint stays for
            // whatever is left, and goes away when nothing is.
            // A subcommand's name comes first or not at all, so it is written first here. An
            // option before it ends the command path, which is why the other order was the one
            // arrangement the parser refuses.
            std::vector<std::string> parts;
            if (!command.commands().empty()) {
                parts.push_back("[commands]");
            }
            size_t optional_count = 0;
            const auto &take = [&](const Option &option) {
                if (!spelled(option)) {
                    return;
                }
                if (option.isRequired()) {
                    parts.push_back(formatter.displayed(option, false));
                } else {
                    optional_count++;
                }
            };
            for (const auto &option : command.options()) {
                take(option);
            }
            for (const auto &option : inherited) {
                take(option);
            }
            if (optional_count > 0) {
                parts.push_back("[options]");
            }
            for (const auto &argument : command.arguments()) {
                parts.push_back(formatter.displayed(argument));
            }

            int room = std::max(text_width - indent, min_description);
            std::string res = head;
            int line_width = console::display_width(head);
            for (const auto &part : parts) {
                int part_width = console::display_width(part);
                if (line_width > 0 && line_width + 1 + part_width > room) {
                    res += "\n";
                    line_width = 0;
                }
                // At the margin the piece goes straight down under the one above. Anywhere else
                // it needs the space that separates it from what came before.
                res += line_width == 0 ? part : " " + part;
                line_width += line_width == 0 ? part_width : 1 + part_width;
            }
            return res;
        }

    }

    std::string HelpFormatter::displayed(const Command &command) const {
        return command.name();
    }

    // What an argument adds to the right hand column beyond its description. The same for an
    // argument of a command and an argument of an option, since a default value is worth as much
    // in either place.
    static std::string argument_extras(const Argument &argument, const HelpSizes &sizes) {
        auto flags = sizes.displayOptions;
        std::string res;
        if (flags.test_flag(Parser::ShowArgumentExpectedValues) &&
            !argument.expectedValues().empty()) {
            std::string words;
            for (const auto &item : argument.expectedValues()) {
                words += (words.empty() ? "" : ", ") + item;
            }
            res += " [" + words + "]";
        }
        if (flags.test_flag(Parser::ShowArgumentDefaultValue) && argument.hasDefaultValue()) {
            res += " (default: " + argument.defaultValue() + ")";
        }
        return res;
    }

    HelpBlock::Entry HelpFormatter::entry(const Argument &argument, const HelpSizes &sizes) const {
        return {displayed(argument), argument.description() + argument_extras(argument, sizes)};
    }

    HelpBlock::Entry HelpFormatter::entry(const Option &option, const HelpSizes &sizes) const {
        std::string right = option.description();
        for (const auto &argument : option.arguments()) {
            right += argument_extras(argument, sizes);
        }
        if (sizes.displayOptions.test_flag(Parser::ShowOptionIsRequired) && option.isRequired()) {
            right += " (required)";
        }
        return {displayed(option, true), right};
    }

    HelpBlock::Entry HelpFormatter::entry(const Command &command, const HelpSizes &) const {
        return {displayed(command), command.description()};
    }

    std::string HelpFormatter::usageText(const Command &command,
                                         const std::vector<std::string> &path,
                                         const std::vector<Option> &inherited,
                                         const HelpSizes &sizes) const {
        return usage_text(*this, command, path, inherited, sizes.indent, sizes.textWidth);
    }

    std::vector<HelpBlock> HelpFormatter::blocks(const ParseResult &result,
                                                 const HelpSizes &sizes) const {
        if (!result.command()) {
            return {};
        }
        const Command &command = *result.command();
        const auto &catalogue = command.catalogue();
        auto flags = sizes.displayOptions;

        // A row at a time, through the rung that makes one, so that a formatter changing what a
        // row says does not have to take over this whole function to do it.
        auto argument_line = [this, &sizes](const Argument &item) { return entry(item, sizes); };
        auto option_line = [this, &sizes](const Option &item) { return entry(item, sizes); };
        auto command_line = [this, &sizes](const Command &item) { return entry(item, sizes); };

        // Only the ones that can be printed, which is spelled() and why. The help text is not
        // the place to find out that a tree holds an option nobody can type.
        std::vector<Option> own;
        for (const auto &item : command.options()) {
            if (spelled(item)) {
                own.push_back(item);
            }
        }
        // What the commands above declared recursive is in scope here and is demanded here, so
        // it is listed here. Under a heading of its own, since it belongs to the program rather
        // than to this command, and since the catalogue's groups were written for this
        // command's own options and have nothing to say about these.
        std::vector<Option> inherited_options;
        for (const auto *option : result.inheritedOptions()) {
            if (spelled(*option)) {
                inherited_options.push_back(*option);
            }
        }

        std::vector<HelpBlock> out;
        // A block with nothing in it is not printed and not handed out, so a command with no
        // subcommands says nothing about subcommands rather than showing an empty heading.
        const auto push = [&out](HelpBlock block) {
            if (!block.isEmpty()) {
                out.push_back(std::move(block));
            }
        };
        const auto pushAll = [&out](std::vector<HelpBlock> blocks) {
            for (auto &block : blocks) {
                out.push_back(std::move(block));
            }
        };

        for (const auto &slot : result.helpLayout().blocks()) {
            switch (slot.role) {
                case HelpBlock::Prologue: {
                    auto block = blockLike(slot, {});
                    block.text = result.prologue();
                    push(std::move(block));
                    break;
                }
                case HelpBlock::Description: {
                    auto block = blockLike(slot, "Description");
                    block.text = command.description();
                    push(std::move(block));
                    break;
                }
                case HelpBlock::Usage: {
                    auto block = blockLike(slot, "Usage");
                    block.text = usageText(command, result.commandPath(), inherited_options, sizes);
                    push(std::move(block));
                    break;
                }
                case HelpBlock::Arguments: {
                    pushAll(grouped(
                        command.arguments(), catalogue.argumentGroups(), slot, "Arguments",
                        [](const Argument &item) { return item.name(); }, argument_line));
                    break;
                }
                // ###QUESTION: a recursive option is listed here on the page of the command
                // that declared it and under "Global options" on the pages below, so the same
                // spelling sits under two headings depending on which page is being read. That
                // is what Cobra does with a persistent flag. The other two answers are to list
                // it under "Global options" everywhere, which splits the declaring command's
                // list by something a reader there cannot act on, and to drop the second block
                // altogether, which is System.CommandLine's and loses the one thing worth
                // saying on a subcommand's page: this is not mine, read the program's help.
                // Should it be the same heading on both? Four lines here if so, filtering the
                // recursive ones out of own and adding them to the block below.
                case HelpBlock::Options: {
                    pushAll(grouped(
                        own, catalogue.optionGroups(), slot, "Options",
                        [](const Option &item) { return item.token(); }, option_line));
                    break;
                }
                case HelpBlock::InheritedOptions: {
                    auto block = blockLike(slot, "Global options");
                    for (const auto &option : inherited_options) {
                        block.entries.push_back(option_line(option));
                    }
                    push(std::move(block));
                    break;
                }
                case HelpBlock::Commands: {
                    pushAll(grouped(
                        command.commands(), catalogue.commandGroups(), slot, "Commands",
                        [](const Command &item) { return item.name(); }, command_line));
                    break;
                }
                case HelpBlock::Epilogue: {
                    auto block = blockLike(slot, {});
                    block.text = result.epilogue();
                    push(std::move(block));
                    break;
                }
                case HelpBlock::Custom: {
                    push(slot);
                    break;
                }
            }
        }
        return out;
    }

    std::vector<HelpFormatter::Run> HelpFormatter::renderBlock(const HelpBlock &block,
                                                               const HelpSizes &sizes,
                                                               size_t widest) const {
        std::vector<Run> out;
        if (!block.title.empty()) {
            // The newline is outside the styling, so that the escape putting it back is the last
            // thing on the line rather than the first thing on the next one. A background color
            // painted to the end of the line is what shows this up.
            appendRun(out, block.titleStyle, block.title + ":");
            appendRun(out, {}, "\n");
        }

        if (!block.entries.empty()) {
            // Where a description starts, and therefore where the lines under the first one are
            // indented to, so a wrapped entry stays one block instead of drifting left.
            size_t column = size_t(sizes.indent) + widest + size_t(sizes.spacing);
            int room = std::max(sizes.textWidth - int(column), min_description);
            for (const auto &entry : block.entries) {
                appendRun(out, {}, std::string(size_t(sizes.indent), ' '));
                appendRun(out, block.entryStyle, entry.left);
                if (!entry.right.empty()) {
                    auto lines = wrapped(entry.right, room);
                    size_t padding =
                        widest - size_t(console::display_width(entry.left)) + size_t(sizes.spacing);
                    appendRun(out, {}, std::string(padding, ' '));
                    appendRun(out, block.bodyStyle, lines.front());
                    for (size_t i = 1; i < lines.size(); ++i) {
                        appendRun(out, {}, "\n" + std::string(column, ' '));
                        appendRun(out, block.bodyStyle, lines[i]);
                    }
                }
                appendRun(out, {}, "\n");
            }
            return out;
        }

        // Prose under a heading is set in under it. Prose without one sits at the margin, which
        // is what a prologue and an epilogue want.
        size_t margin = block.title.empty() ? 0 : size_t(sizes.indent);
        int room = std::max(sizes.textWidth - int(margin), min_description);
        for (const auto &line : wrapped(block.text, room)) {
            appendRun(out, {}, std::string(margin, ' '));
            appendRun(out, block.bodyStyle, line);
            appendRun(out, {}, "\n");
        }
        return out;
    }

    std::vector<HelpFormatter::Run> HelpFormatter::render(const std::vector<HelpBlock> &blocks,
                                                          const HelpSizes &sizes) const {
        // Measured across every list rather than across each on its own, so that a catalogue
        // reads as one table instead of as several.
        bool align_all = sizes.displayOptions.test_flag(Parser::AlignAllCatalogues);
        size_t shared = align_all ? widestOf(blocks) : 0;

        std::vector<Run> out;
        for (size_t i = 0; i < blocks.size(); ++i) {
            if (i > 0) {
                appendRun(out, {}, "\n");
            }
            appendRuns(out,
                       renderBlock(blocks[i], sizes, align_all ? shared : widestOf(blocks[i])));
        }
        return out;
    }

    // ---------------------------------------------------------------------------------------
    // Parsing
    //
    // The command path is a prefix. The run of subcommand names at the front of the line is the
    // whole of it, and the first token that is not one settles what was reached. Everything
    // after that belongs to the command reached: its own options, the ones its ancestors
    // declared recursive, and its arguments. This is SysCmdLine's rule.
    //
    // So there is one scope and it is known before a single option is read. An option written
    // between two command names is not read against whichever command the walk had got to, and
    // that is the point: what a ParseResult can be asked is exactly what a line can say.
    //
    // Two rules below differ from SysCmdLine, which this replaces. Each is a line SysCmdLine
    // accepts and this refuses. Both were measured against it.
    //
    // Positional tokens a command cannot take are an error. SysCmdLine drops them, so a mistyped
    // subcommand succeeds silently. Measured: a root declaring no arguments accepted four
    // surplus tokens and did nothing with them.
    //
    // An option that needs a value will not take a token that is a declared option of the same
    // command. Reporting it beats swallowing --force and leaving the reader to find out where it
    // went. Only a declared option counts, so a negative number or an undeclared name is still a
    // value.
    // ---------------------------------------------------------------------------------------

    namespace {

        /// Everything one call to parse needs, kept together so the steps can hand off to each
        /// other without a dozen parameters.
        class ParserCore {
        public:
            ParserCore(detail::parse_data *out, Parser::ParseOptions flags) : r(out), flags(flags) {
            }

            void run(array_view<std::string> args);

        private:
            using Error = ParseResult::Error;

            detail::parse_data *r;
            Parser::ParseOptions flags;
            std::vector<std::string> tokens;
            size_t pos = 0;
            /// The positional tokens, gathered first and handed to the arguments afterwards,
            /// since how many each takes depends on how many there are.
            std::vector<std::string> positional;
            /// The highest priority option given, which is what decides whether the checks at
            /// the end are worth making.
            const Option *prior_option = nullptr;
            /// What every command walked through declared recursive, in scope below it.
            std::vector<const Option *> inherited;
            /// Where the target's Remainder argument sits among its arguments, if it has one.
            /// Once that many positional tokens are in hand the rest of the line is its, options
            /// and all, which is how a program says where option reading stops.
            size_t remainder_at = size_t(-1);
            /// Whether the Remainder has taken its first token, which only matters where it is
            /// the first argument and the options in front of it are still being read.
            bool remainder_started = false;

            bool on(Parser::ParseOption flag) const {
                return flags.test_flag(flag);
            }
            bool failed() const {
                return r->error != ParseResult::NoError;
            }
            /// What can be written at the command that was reached: its own options first, then
            /// the ones it inherited. That is all r->options holds, the path having been settled
            /// before any of it was collected, so what is writable and what is readable are the
            /// same list.
            std::vector<const Option *> inScope() const {
                std::vector<const Option *> res;
                for (const auto &option : r->target->options()) {
                    res.push_back(&option);
                }
                res.insert(res.end(), inherited.begin(), inherited.end());
                return res;
            }
            /// Whether any option in scope was written. Asked beside an empty positional list to
            /// tell a bare command from one that was given something.
            bool anythingGiven() const {
                for (const auto &item : r->options) {
                    if (!item.occurrences.empty()) {
                        return true;
                    }
                }
                return false;
            }
            void fail(Error error, std::string text) {
                if (!failed()) {
                    r->error = error;
                    r->error_text = std::move(text);
                }
            }
            /// The same, for a failure that is a name spelled wrong, where the names that were
            /// declared are worth offering back.
            void failFor(Error error, std::string text, std::string token,
                         std::vector<std::string> candidates) {
                if (failed()) {
                    return;
                }
                fail(error, std::move(text));
                r->error_token = std::move(token);
                r->error_candidates = std::move(candidates);
            }

            void expandResponseFiles();
            const Command *subcommandFor(const std::string &token) const;
            void enter(const Command *next);
            void collectOptions();
            void readTokens();
            bool readOption(const std::string &token);
            bool readOneOption(OptionData *data, std::string_view inline_value);
            OptionData *lookup(std::string_view token) const;
            /// Which option a token names and what was written against it, in every spelling
            /// readOption() accepts. Grouped flags are not here, naming a list rather than one
            /// option, and are groupedFlagsFor() instead.
            OptionMatch optionFor(const std::string &token) const;
            bool groupedFlagsFor(const std::string &token, std::vector<OptionData *> *found) const;
            /// Whether the token names an option at all, which is where a run of values stops.
            /// Asking this and reading the token have to give one answer, so both go through
            /// the two above: a run that stops at --out and not at --out=x would take the
            /// second for a value of whatever it was reading.
            bool namesAnOption(const std::string &token) const;
            bool readGroupedFlags(const std::string &token);
            void assignPositional();
            void applyDefaults();
            void checkRequired();

            bool looksLikeOption(std::string_view token) const;
            bool accepts(const Argument &argument, const std::string &token,
                         const std::string &where);
            void notePrior(const Option *option);
        };

        bool ParserCore::looksLikeOption(std::string_view token) const {
            if (token.size() < 2) {
                return false;
            }
            if (token[0] == '-') {
                return token[1] == '-' || !on(Parser::DontAllowUnixShortOptions);
            }
            return token[0] == '/' && on(Parser::AllowDosShortOptions);
        }

        void ParserCore::notePrior(const Option *option) {
            if (!prior_option || option->prior() > prior_option->prior()) {
                if (option->prior() != Option::NoPrior) {
                    prior_option = option;
                }
            }
        }

        /// Whitespace at either end, gone. The carriage return of a CRLF line is whitespace, so
        /// a file written on Windows needs no step of its own.
        std::string_view trimmed(std::string_view text) {
            const auto space = [](char c) {
                return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\v' || c == '\f';
            };
            while (!text.empty() && space(text.front())) {
                text.remove_prefix(1);
            }
            while (!text.empty() && space(text.back())) {
                text.remove_suffix(1);
            }
            return text;
        }

        // A line of a response file is not a token until three things are taken off it. What
        // writes these files is a build system rather than a shell, and none of the three is
        // something a shell would have left behind.
        //
        //  - blanks at either end, since a generator lines its arguments up
        //  - one pair of quotes, since a path with a space in it has to be written somehow, and
        //    CMake writes every path that way
        //  - a byte order mark, since a Windows editor puts one on the first line
        //
        // A line that is only a pair of quotes is an empty argument and is kept. A line that is
        // empty or only blanks is not an argument at all and is dropped.
        void ParserCore::expandResponseFiles() {
            std::vector<std::string> out;
            for (const auto &token : tokens) {
                if (token.size() < 2 || token.front() != '@') {
                    out.push_back(token);
                    continue;
                }
                // The name is UTF-8 like everything else here, and on Windows handing that to
                // ifstream as a narrow string reads it in the system code page.
                //
                // Read as bytes, so that nothing in the file is interpreted. A Windows text
                // stream takes a Ctrl-Z for the end of the file and drops the rest. The
                // carriage returns of a CRLF file are not the reason: those are whitespace and
                // come off in the trim below, on every platform and whichever mode this is.
                std::ifstream file(path::from_utf8(std::string_view(token).substr(1)),
                                   std::ios::binary);
                if (!file) {
                    fail(ParseResult::ErrorReadingResponseFile,
                         "cannot read response file \"" + token.substr(1) + "\"");
                    return;
                }
                bool first = true;
                std::string line;
                while (std::getline(file, line)) {
                    std::string_view text = line;
                    if (first) {
                        first = false;
                        // Only the first line can carry one, and only whole. Two of its three
                        // bytes are not a mark.
                        if (text.substr(0, 3) == "\xEF\xBB\xBF") {
                            text.remove_prefix(3);
                        }
                    }
                    text = trimmed(text);
                    if (text.empty()) {
                        continue;
                    }
                    if (text.size() >= 2 && text.front() == '"' && text.back() == '"') {
                        text = text.substr(1, text.size() - 2);
                    }
                    out.emplace_back(text);
                }
            }
            tokens = std::move(out);
        }

        /// The subcommand \a token names, or null. Only worth asking before the first positional
        /// token, since after that a name is a value.
        const Command *ParserCore::subcommandFor(const std::string &token) const {
            if (!positional.empty()) {
                return nullptr;
            }
            for (const auto &candidate : r->target->commands()) {
                if (same_token(candidate.name(), token, on(Parser::IgnoreCommandCase))) {
                    return &candidate;
                }
            }
            return nullptr;
        }

        /// Moves into \a next, keeping whatever the command being left declared recursive.
        ///
        /// The options are not collected here. Nothing may be written until the path is over, so
        /// there is one scope to collect and it is the target's, and collecting at every level
        /// would leave each ancestor's own options in the table for the rest of the parse.
        void ParserCore::enter(const Command *next) {
            for (const auto &option : r->target->options()) {
                if (option.isRecursive()) {
                    inherited.push_back(&option);
                }
            }
            r->target = next;
            r->path.push_back(next->name());
        }

        /// What can be written here: the target's own options, plus the recursive ones of every
        /// command above it. Called once, after the path is settled, so this is the only scope
        /// there ever is and what a result can be asked for is exactly what could be written.
        void ParserCore::collectOptions() {
            r->options.clear();
            r->by_token.clear();
            auto add = [this](const Option *option) {
                size_t index = r->options.size();
                for (size_t i = 0; i < r->options.size(); ++i) {
                    if (r->options[i].option == option) {
                        index = i;
                        break;
                    }
                }
                if (index == r->options.size()) {
                    r->options.push_back({option, {}});
                }
                for (const auto &spelling : option->tokens()) {
                    r->by_token[spelling] = index;
                }
            };
            for (const auto &option : r->target->options()) {
                add(&option);
            }
            for (auto option : inherited) {
                add(option);
            }
        }

        OptionData *ParserCore::lookup(std::string_view token) const {
            if (!on(Parser::IgnoreOptionCase)) {
                return r->findForWriting(token);
            }
            for (auto &item : r->options) {
                for (const auto &spelling : item.option->tokens()) {
                    if (str::equals_insensitive(spelling, token)) {
                        return &item;
                    }
                }
            }
            return nullptr;
        }

        bool ParserCore::accepts(const Argument &argument, const std::string &token,
                                 const std::string &where) {
            const auto &expected = argument.expectedValues();
            if (!expected.empty() &&
                std::find(expected.begin(), expected.end(), token) == expected.end()) {
                failFor(ParseResult::InvalidArgumentValue,
                        "\"" + token + "\" is not one of the values " + where + " accepts", token,
                        expected);
                return false;
            }
            if (argument.typeInfo().check && !argument.typeInfo().check(token)) {
                fail(ParseResult::ArgumentTypeMismatch, "\"" + token + "\" is not a " +
                                                            argument.typeInfo().name +
                                                            ", which is what " + where + " takes");
                return false;
            }
            if (argument.validator()) {
                std::string reason;
                if (!argument.validator()(token, &reason)) {
                    fail(ParseResult::ArgumentValidateFailed,
                         reason.empty() ? "\"" + token + "\" is not acceptable to " + where
                                        : reason);
                    return false;
                }
            }
            return true;
        }

        /// Reads the arguments of one option occurrence, starting at \c pos. \a inline_value is
        /// what came after an equals sign or was joined to a short token, and stands in for the
        /// first argument when there is one.
        bool ParserCore::readOneOption(OptionData *data, std::string_view inline_value) {
            const Option *option = data->option;

            int limit = option->maxOccurrence();
            if (limit > 0 && int(data->occurrences.size()) >= limit) {
                fail(ParseResult::OptionOccurTooMuch,
                     "option \"" + option->token() + "\" was given more than " +
                         std::to_string(limit) + (limit == 1 ? " time" : " times"));
                return false;
            }

            ArgumentSlots slots(option->arguments().size());
            bool have_inline = inline_value.data() != nullptr;

            for (size_t i = 0; i < option->arguments().size(); ++i) {
                const auto &argument = option->arguments()[i];
                const std::string where = "\"" + option->token() + "\"";

                // What was written after the equals sign or stuck to the spelling is the first
                // value of the first argument, not the whole of it. An argument that takes one
                // is finished by it, and one that takes more goes on reading from where the
                // token ended, so that --opt=a b and --opt a b are the same line said twice.
                if (i == 0 && have_inline) {
                    std::string token(inline_value);
                    if (!accepts(argument, token, where)) {
                        return false;
                    }
                    slots[i].push_back(std::move(token));
                    if (argument.arity() == Argument::Single) {
                        continue;
                    }
                }

                // How many are here to be had, which is up to the next token that is somebody's
                // option, and then how many of those are this argument's to take.
                // A token that is somebody's option is never quietly eaten as a value, not
                // even by an argument that has to have one: saying "-o needs a value" is worth
                // more than taking --force and leaving the reader to work out where it went.
                // Only a declared option counts, so a negative number is a value like any other
                // rather than an option nobody has heard of.
                //
                // A Remainder is the exception and the whole of its meaning: it takes the rest
                // of the line as it stands. That is how a program says where option reading
                // stops, and what token it stops at is the program's own to choose.
                bool remainder = argument.arity() == Argument::Remainder;
                const auto &ends_the_run = [this](const std::string &token) {
                    return namesAnOption(token);
                };

                size_t available = tokens.size() - pos;
                if (!remainder) {
                    available = 0;
                    while (pos + available < tokens.size() &&
                           !ends_the_run(tokens[pos + available])) {
                        ++available;
                    }
                }
                size_t take = take_for(option->arguments(), i, available, !slots[i].empty());

                bool took_any = !slots[i].empty();
                for (size_t count = 0; count < take && pos < tokens.size(); ++count) {
                    const auto &token = tokens[pos];
                    if (!remainder && ends_the_run(token)) {
                        break;
                    }
                    if (!accepts(argument, token, where)) {
                        return false;
                    }
                    slots[i].push_back(token);
                    ++pos;
                    took_any = true;
                }

                if (!took_any && argument.isRequired() &&
                    option->prior() < Option::IgnoreMissingArguments) {
                    fail(ParseResult::MissingOptionArgument, "option \"" + option->token() +
                                                                 "\" needs a value for <" +
                                                                 argument.displayName() + ">");
                    return false;
                }
            }

            data->occurrences.push_back(std::move(slots));
            notePrior(option);
            return true;
        }

        OptionMatch ParserCore::optionFor(const std::string &token) const {
            if (token.empty()) {
                return {};
            }
            // The whole token, which is the ordinary case.
            if (auto data = lookup(token)) {
                return {data, {}, token};
            }

            // A value joined by an equals sign. The value is empty rather than absent where
            // nothing follows the sign, since --prefix= sets an empty string.
            auto equals = token.find('=');
            if (equals != std::string::npos) {
                if (auto data = lookup(token.substr(0, equals))) {
                    return {data, std::string_view(token).substr(equals + 1),
                            std::string_view(token).substr(0, equals)};
                }
            }

            // A short option with its value stuck to it. Which spellings can be one is
            // detail::sticky_spellings(), the same answer the whole-tree check asks for, so a
            // configuration refused as ambiguous is refused about the spellings that would
            // really have been tried. The prefix is compared the way a whole token is, or
            // IgnoreOptionCase would hold for -d foo and not for -dfoo.
            for (auto &item : r->options) {
                for (auto spelling : detail::sticky_spellings(*item.option)) {
                    if (spelling.size() >= token.size()) {
                        continue;
                    }
                    auto head = std::string_view(token).substr(0, spelling.size());
                    if (!detail::same_name(spelling, head, on(Parser::IgnoreOptionCase))) {
                        continue;
                    }
                    return {&item, std::string_view(token).substr(spelling.size()), head};
                }
            }

            // A DOS token spelled the other way round.
            if (token[0] == '/' && on(Parser::AllowDosShortOptions)) {
                if (auto data = lookup("-" + token.substr(1))) {
                    return {data, {}, token};
                }
            }
            return {};
        }

        bool ParserCore::groupedFlagsFor(const std::string &token,
                                         std::vector<OptionData *> *found) const {
            if (!on(Parser::AllowUnixGroupFlags) || token.size() < 3 || token[0] != '-' ||
                token[1] == '-') {
                return false;
            }
            // Every letter has to be an option of its own that wants no value, or the whole
            // token is something else and is left alone.
            for (size_t i = 1; i < token.size(); ++i) {
                auto data = lookup(std::string("-") + token[i]);
                if (!data || !data->option->arguments().empty()) {
                    return false;
                }
                found->push_back(data);
            }
            return true;
        }

        bool ParserCore::namesAnOption(const std::string &token) const {
            if (!looksLikeOption(token)) {
                return false;
            }
            if (optionFor(token)) {
                return true;
            }
            std::vector<OptionData *> flags;
            return groupedFlagsFor(token, &flags);
        }

        bool ParserCore::readGroupedFlags(const std::string &token) {
            std::vector<OptionData *> found;
            if (!groupedFlagsFor(token, &found)) {
                return false;
            }
            for (auto data : found) {
                if (!readOneOption(data, {})) {
                    return false;
                }
            }
            return true;
        }

        bool ParserCore::readOption(const std::string &token) {
            if (auto match = optionFor(token)) {
                if (match.value.data() && match.data->option->arguments().empty()) {
                    fail(ParseResult::UnknownOption,
                         "option \"" + std::string(match.spelling) + "\" takes no value");
                    return false;
                }
                return readOneOption(match.data, match.value);
            }

            if (readGroupedFlags(token)) {
                return true;
            }

            std::vector<std::string> declared;
            for (const auto &item : r->options) {
                for (const auto &spelling : item.option->tokens()) {
                    declared.push_back(spelling);
                }
            }
            failFor(ParseResult::UnknownOption, "unknown option \"" + token + "\"", token,
                    std::move(declared));
            return false;
        }

        void ParserCore::readTokens() {
            // The path first, and nothing but. A command line names its command by naming each
            // one down to it and nothing in between, so the run of subcommand names at the front
            // is the whole of it and the first token that is not one ends it.
            //
            // This is what makes a scope out of the target rather than out of wherever the
            // reader happened to be. An option belongs to one command, it is written after that
            // command, and the only way it reaches a command below is recursive().
            while (pos < tokens.size()) {
                const auto &token = tokens[pos];
                if (looksLikeOption(token)) {
                    break;
                }
                auto next = subcommandFor(token);
                if (!next) {
                    break;
                }
                ++pos;
                enter(next);
            }
            collectOptions();

            // Where the target's own Remainder argument begins, if it declares one. Everything
            // before it takes a token each, since nothing greedy may come before a Remainder, so
            // the count of positional tokens in hand says when it has started.
            const auto &declared = r->target->arguments();
            for (size_t i = 0; i < declared.size(); ++i) {
                if (declared[i].arity() == Argument::Remainder) {
                    remainder_at = i;
                    break;
                }
            }

            while (pos < tokens.size() && !failed()) {
                const auto &token = tokens[pos];
                // Once the Remainder has started, nothing is an option any more. This is what
                // the arity means and what lets a program choose the word it stops at, rather
                // than every program stopping at the one word a parser picked.
                if (remainder_at != size_t(-1) && positional.size() >= remainder_at) {
                    // Filling the argument before it is what says option reading is over.
                    // Where the Remainder is the first argument there is no such argument, so
                    // what says it is the first token that is not written as an option. This is
                    // sudo: sudo -u root ls -l reads -u root and runs ls -l. A token that looks
                    // like an option and is not one is still reported, since a wrapper is not
                    // improved by silently passing on its own misspelt flags.
                    if (remainder_at == 0 && !remainder_started && looksLikeOption(token)) {
                        ++pos;
                        readOption(token);
                        continue;
                    }
                    remainder_started = true;
                    positional.push_back(token);
                    ++pos;
                    continue;
                }
                if (looksLikeOption(token)) {
                    ++pos;
                    readOption(token);
                    continue;
                }
                // The path is over, so a name that would have gone into it was written too late.
                // Said as that rather than as a stray value, since "unknown argument" for a word
                // the reader can see is a subcommand is the least useful thing to answer with.
                //
                // Only where the target takes no arguments of its own. Where it takes some, this
                // token is one of them: a program that has a subcommand called \c copy can still
                // be handed a file called copy, and guessing otherwise would make the name
                // unusable as a value.
                if (r->target->arguments().empty() && subcommandFor(token)) {
                    failFor(ParseResult::UnknownCommand,
                            "command \"" + token + "\" has to come before the options of \"" +
                                r->target->name() + "\"",
                            token, {});
                    return;
                }
                positional.push_back(token);
                ++pos;
            }
        }

        void ParserCore::assignPositional() {
            const auto &declared = r->target->arguments();
            r->arguments.resize(declared.size());

            size_t taken = 0;
            for (size_t i = 0; i < declared.size() && taken < positional.size(); ++i) {
                const auto &argument = declared[i];
                size_t take = std::min(take_for(declared, i, positional.size() - taken),
                                       positional.size() - taken);

                const std::string where = "<" + argument.displayName() + ">";
                for (size_t k = 0; k < take; ++k) {
                    const auto &token = positional[taken + k];
                    if (!accepts(argument, token, where)) {
                        return;
                    }
                    r->arguments[i].push_back(token);
                }
                taken += take;
            }

            if (taken < positional.size()) {
                // Nothing placed at all, on a command that has subcommands, means the token sat
                // where a subcommand goes. Saying so beats counting arguments at somebody who
                // mistyped a name.
                if (taken == 0 && !r->target->commands().empty()) {
                    std::vector<std::string> declared;
                    for (const auto &command : r->target->commands()) {
                        declared.push_back(command.name());
                    }
                    failFor(ParseResult::UnknownCommand,
                            "\"" + positional[0] + "\" is not a command of \"" + r->target->name() +
                                "\"",
                            positional[0], std::move(declared));
                    return;
                }
                fail(ParseResult::TooManyArguments, "\"" + positional[taken] +
                                                        "\" is one argument more than \"" +
                                                        r->target->name() + "\" takes");
            }
        }

        void ParserCore::applyDefaults() {
            const auto &declared = r->target->arguments();
            for (size_t i = 0; i < declared.size() && i < r->arguments.size(); ++i) {
                if (r->arguments[i].empty() && declared[i].hasDefaultValue()) {
                    r->arguments[i].push_back(declared[i].defaultValue());
                }
            }
            for (auto &item : r->options) {
                for (auto &occurrence : item.occurrences) {
                    for (size_t i = 0; i < occurrence.size(); ++i) {
                        if (occurrence[i].empty() &&
                            item.option->arguments()[i].hasDefaultValue()) {
                            occurrence[i].push_back(item.option->arguments()[i].defaultValue());
                        }
                    }
                }
            }
        }

        void ParserCore::checkRequired() {
            // An option high enough on the ladder answers the command line by itself, so what is
            // missing elsewhere is no longer a complaint worth making.
            auto level = prior_option ? prior_option->prior() : Option::NoPrior;

            // The three exclusive levels each forbid their own thing rather than everything
            // below them. Only the ladder's lower half is a ladder.
            bool forbids_arguments =
                level == Option::ExclusiveToArguments || level == Option::ExclusiveToAll;
            bool forbids_options =
                level == Option::ExclusiveToOptions || level == Option::ExclusiveToAll;

            // What was given rather than what is in hand. r->arguments has had the defaults
            // applied by now, and a default is what stands in where nothing was given, so
            // reading them here would have an option that forbids arguments refuse a line that
            // carried none.
            if (forbids_arguments && !positional.empty()) {
                fail(ParseResult::PriorOptionWithArguments,
                     "option \"" + prior_option->token() + "\" takes no arguments beside it");
                return;
            }
            if (forbids_options) {
                for (const auto &item : r->options) {
                    if (item.option != prior_option && !item.occurrences.empty()) {
                        fail(ParseResult::PriorOptionWithOptions,
                             "option \"" + prior_option->token() + "\" takes no options beside it");
                        return;
                    }
                }
            }
            if (level >= Option::IgnoreMissingSymbols) {
                return;
            }

            const auto &declared = r->target->arguments();
            for (size_t i = 0; i < declared.size(); ++i) {
                if (declared[i].isRequired() && r->arguments[i].empty()) {
                    fail(ParseResult::MissingCommandArgument, "\"" + r->target->name() +
                                                                  "\" needs a value for <" +
                                                                  declared[i].displayName() + ">");
                    return;
                }
            }
            for (const auto &item : r->options) {
                if (item.option->isRequired() && item.occurrences.empty()) {
                    fail(ParseResult::MissingRequiredOption,
                         "option \"" + item.option->token() + "\" is required");
                    return;
                }
            }
        }

        void ParserCore::run(array_view<std::string> args) {
            // The first argument names the program rather than anything to parse.
            tokens.assign(args.begin() + (args.empty() ? 0 : 1), args.end());
            if (on(Parser::EnableResponseFile)) {
                expandResponseFiles();
                if (failed()) {
                    return;
                }
            }

            r->path.push_back(r->target->name());
            readTokens();
            if (failed()) {
                return;
            }

            // An option that stands in for an empty command line, which is what makes a bare
            // command print its help rather than complain.
            //
            // What counts is what the command that was reached was given, not how many tokens
            // there were. A subcommand's name is a token, so counting them left "prog build"
            // looking like a line with something in it and a subcommand's own auto option never
            // fired at all.
            //
            // Looked for among what is in scope here rather than among everything collected on
            // the way, since an option of a command already left behind cannot be written here
            // and has no business standing in for a line written here. The command's own come
            // before the ones it inherited, so the innermost answer wins.
            if (!prior_option && positional.empty() && !anythingGiven()) {
                for (const auto *option : inScope()) {
                    if (option->prior() != Option::AutoSetWhenNoSymbols ||
                        option->tokens().empty()) {
                        continue;
                    }
                    auto data = r->findForWriting(option->token());
                    if (!data) {
                        continue;
                    }
                    data->occurrences.emplace_back(option->arguments().size());
                    prior_option = option;
                    break;
                }
            }

            assignPositional();
            if (failed()) {
                return;
            }
            applyDefaults();
            checkRequired();
        }

    }

    // ---------------------------------------------------------------------------------------
    // Parser
    // ---------------------------------------------------------------------------------------

    namespace {

        /// What a parser starts with. Shared rather than one per parser, since a plain formatter
        /// keeps nothing between calls and every method on it is const.
        const std::shared_ptr<HelpFormatter> &defaultFormatter() {
            static const std::shared_ptr<HelpFormatter> instance =
                std::make_shared<HelpFormatter>();
            return instance;
        }

    }

    class Parser::Impl {
    public:
        std::shared_ptr<Command> root = std::make_shared<Command>();
        std::string prologue;
        std::string epilogue;
        HelpLayout help_layout = HelpLayout::defaultLayout();
        std::shared_ptr<HelpFormatter> formatter = defaultFormatter();
        Parser::DisplayOptions display_options;
        int text_width = 0;
        int indent = 4;
        int spacing = 4;
    };

    Parser::Parser() : _impl(std::make_unique<Impl>()) {
    }

    Parser::Parser(Command root) : _impl(std::make_unique<Impl>()) {
        stdc_impl_t;
        impl.root = std::make_shared<Command>(std::move(root));
    }

    Parser::~Parser() = default;

    Parser::Parser(Parser &&RHS) noexcept = default;

    Parser &Parser::operator=(Parser &&RHS) noexcept = default;

    void Parser::setRootCommand(Command root) {
        stdc_impl_t;

        // A new tree rather than new contents for the old one. Every ParseResult already handed
        // out shares this pointer and holds raw pointers into what it addresses, so assigning
        // through it leaves them all reading freed vectors. Checked: assigning through it dies
        // under ASAN in test_a_parser_is_reusable_and_its_tree_can_be_replaced.
        impl.root = std::make_shared<Command>(std::move(root));
    }

    const Command &Parser::rootCommand() const {
        stdc_impl_t;
        return *impl.root;
    }

    void Parser::setPrologue(std::string text) {
        stdc_impl_t;
        impl.prologue = std::move(text);
    }

    const std::string &Parser::prologue() const {
        stdc_impl_t;
        return impl.prologue;
    }

    void Parser::setEpilogue(std::string text) {
        stdc_impl_t;
        impl.epilogue = std::move(text);
    }

    const std::string &Parser::epilogue() const {
        stdc_impl_t;
        return impl.epilogue;
    }

    void Parser::setDisplayOptions(DisplayOptions options) {
        stdc_impl_t;
        impl.display_options = options;
    }

    Parser::DisplayOptions Parser::displayOptions() const {
        stdc_impl_t;
        return impl.display_options;
    }

    void Parser::setTextWidth(int width) {
        stdc_impl_t;
        impl.text_width = width;
    }

    int Parser::textWidth() const {
        stdc_impl_t;
        return impl.text_width;
    }

    void Parser::setIndent(int columns) {
        stdc_impl_t;
        impl.indent = columns;
    }

    int Parser::indent() const {
        stdc_impl_t;
        return impl.indent;
    }

    void Parser::setSpacing(int columns) {
        stdc_impl_t;
        impl.spacing = columns;
    }

    int Parser::spacing() const {
        stdc_impl_t;
        return impl.spacing;
    }

    void Parser::setHelpLayout(HelpLayout layout) {
        stdc_impl_t;
        impl.help_layout = std::move(layout);
    }

    const HelpLayout &Parser::helpLayout() const {
        stdc_impl_t;
        return impl.help_layout;
    }

    // Null puts the plain one back rather than leaving a parser that cannot answer for its own
    // help text, which every rung above this one still goes through.
    void Parser::setHelpFormatter(std::shared_ptr<HelpFormatter> formatter) {
        stdc_impl_t;
        impl.formatter = formatter ? std::move(formatter) : defaultFormatter();
    }

    const std::shared_ptr<HelpFormatter> &Parser::helpFormatter() const {
        stdc_impl_t;
        return impl.formatter;
    }

    std::optional<std::string> Parser::validate(ParseOptions parseOptions) const {
        stdc_impl_t;
        return detail::validate_tree(*impl.root, parseOptions.test_flag(IgnoreOptionCase),
                                     parseOptions.test_flag(IgnoreCommandCase));
    }

    ParseResult Parser::parseImpl(array_view<std::string> args, ParseOptions parseOptions) const {
        stdc_impl_t;
        ParseResult result;
        auto &out = *result._impl;
        out.root = impl.root;
        out.target = impl.root.get();
        out.prologue = impl.prologue;
        out.epilogue = impl.epilogue;
        out.help_layout = impl.help_layout;
        out.formatter = impl.formatter;
        out.display_options = impl.display_options;
        out.text_width = impl.text_width;
        out.indent = impl.indent;
        out.spacing = impl.spacing;
        ParserCore(&out, parseOptions).run(args);
        return result;
    }

}

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_COMMANDLINE_P_H
#define STDCORELIB_COMMANDLINE_P_H

#include <algorithm>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <stdcorelib/str.h>
#include <stdcorelib/support/commandline.h>

namespace stdc::cli::detail {

    /// Whether \a argument may be added after \a arguments without making their values
    /// ambiguous or unreachable.
    inline bool arguments_can_follow(const std::vector<Argument> &arguments,
                                     const Argument &argument) {
        if (argument.name().empty()) {
            return false;
        }
        for (const auto &item : arguments) {
            if (item.name() == argument.name()) {
                return false;
            }
            if (!item.isRequired() && argument.isRequired()) {
                return false;
            }
            if (item.arity() == Argument::Remainder) {
                return false;
            }
            if (item.arity() == Argument::Multiple &&
                (!argument.isRequired() || argument.arity() != Argument::Single)) {
                return false;
            }
        }
        return true;
    }

    /// Whether \a option may be put beside \a options.
    inline bool options_can_join(const std::vector<Option> &options, const Option &option) {
        if (option.tokens().empty()) {
            return false;
        }
        for (size_t i = 0; i < option.tokens().size(); ++i) {
            const auto &token = option.tokens()[i];
            if (token.size() < 2 || (token.front() != '-' && token.front() != '/')) {
                return false;
            }
            if (std::find(option.tokens().begin(), option.tokens().begin() + i, token) !=
                option.tokens().begin() + i) {
                return false;
            }
            for (const auto &item : options) {
                const auto &taken = item.tokens();
                if (std::find(taken.begin(), taken.end(), token) != taken.end()) {
                    return false;
                }
            }
        }
        return option.prior() != Option::AutoSetWhenNoSymbols ||
               (!option.isRequired() && option.arguments().empty());
    }

    /// Whether \a command may be put beside \a commands.
    inline bool commands_can_join(const std::vector<Command> &commands, const Command &command) {
        if (command.name().empty()) {
            return false;
        }
        for (const auto &item : commands) {
            if (item.name() == command.name()) {
                return false;
            }
        }
        return true;
    }

    /// Whether \a names may be added as a catalogue group beside \a groups.
    inline bool catalogue_can_add_group(const std::vector<CommandCatalogue::Group> &groups,
                                        const std::vector<std::string> &names) {
        for (size_t i = 0; i < names.size(); ++i) {
            if (std::find(names.begin(), names.begin() + i, names[i]) != names.begin() + i) {
                return false;
            }
            for (const auto &group : groups) {
                if (std::find(group.members.begin(), group.members.end(), names[i]) !=
                    group.members.end()) {
                    return false;
                }
            }
        }
        return true;
    }

    /// Whether two declared names are the same name, which under a case-insensitive parse they
    /// are without being the same text.
    inline bool same_name(std::string_view a, std::string_view b, bool ignore_case) {
        return ignore_case ? str::equals_insensitive(a, b) : a == b;
    }

    /// The spellings of \a option that a value may be stuck to, which is what the parser tries
    /// once an exact lookup has failed. Mirrors what readOption() will accept.
    ///
    /// One token carries one value, so the option has to want exactly one and have to have it.
    /// An argument that takes more is left out too: a value written against the spelling says
    /// this is the value, and reading on from there would take the next token as well.
    inline std::vector<std::string_view> sticky_spellings(const Option &option) {
        std::vector<std::string_view> res;
        if (option.shortMatch() == Option::NoShortMatch || option.arguments().size() != 1 ||
            !option.arguments().front().isRequired() ||
            option.arguments().front().arity() != Argument::Single) {
            return res;
        }
        for (const auto &spelling : option.tokens()) {
            if (option.shortMatch() != Option::ShortMatchAll && spelling.size() != 2) {
                continue;
            }
            if (option.shortMatch() == Option::ShortMatchSingleLetter &&
                !(spelling.size() > 1 && ((spelling[1] >= 'a' && spelling[1] <= 'z') ||
                                          (spelling[1] >= 'A' && spelling[1] <= 'Z')))) {
                continue;
            }
            res.push_back(spelling);
        }
        return res;
    }

    /// Whether \a command can be given both what its own arguments want and what its options
    /// want.
    ///
    /// A Remainder argument takes the rest of the line from where it starts, so every option has
    /// to be written before it. An option whose own argument is greedy reads on until the next
    /// declared option or the end, so it has to be written where something stops it. Put the two
    /// in one command and there is no order that works: the option first eats the arguments, the
    /// arguments first turn the option into one of their values, and only a third option written
    /// between them saves it.
    ///
    inline bool arguments_can_be_reached(const Command &command,
                                         const std::vector<const Option *> &inherited) {
        bool has_remainder = false;
        for (const auto &argument : command.arguments()) {
            if (argument.arity() == Argument::Remainder) {
                has_remainder = true;
                break;
            }
        }
        if (!has_remainder) {
            return true;
        }
        const auto &greedy = [](const Option &option) {
            for (const auto &argument : option.arguments()) {
                if (argument.arity() != Argument::Single) {
                    return true;
                }
            }
            return false;
        };
        for (const auto &option : command.options()) {
            if (greedy(option)) {
                return false;
            }
        }
        for (const auto *option : inherited) {
            if (greedy(*option)) {
                return false;
            }
        }
        return true;
    }

    /// \a command's own names against \a inherited, then the same for what is under it, carrying
    /// whatever it declares recursive down with it.
    inline bool unambiguous_under(const Command &command, std::vector<const Option *> inherited,
                                  bool ignoreOptionCase, bool ignoreCommandCase) {
        if (!arguments_can_be_reached(command, inherited)) {
            return false;
        }

        std::vector<std::string_view> spellings;
        const auto &take = [&spellings, ignoreOptionCase](const Option &option) {
            for (const auto &spelling : option.tokens()) {
                for (const auto &taken : spellings) {
                    if (same_name(taken, spelling, ignoreOptionCase)) {
                        return false;
                    }
                }
                spellings.push_back(spelling);
            }
            return true;
        };
        for (const auto &option : command.options()) {
            if (!take(option)) {
                return false;
            }
        }
        for (const auto *option : inherited) {
            if (!take(*option)) {
                return false;
            }
        }

        // A value stuck to a spelling is matched by walking the options and taking the first
        // whose spelling the token starts with. Where one such spelling is the start of another,
        // -D and -Da with -Dabc, which is taken depends on the order they were declared in and
        // neither is more right than the other.
        std::vector<std::string_view> sticky;
        const auto &takeSticky = [&sticky, ignoreOptionCase](const Option &option) {
            for (auto spelling : sticky_spellings(option)) {
                for (const auto &taken : sticky) {
                    const auto &shorter = taken.size() < spelling.size() ? taken : spelling;
                    const auto &longer = taken.size() < spelling.size() ? spelling : taken;
                    if (same_name(shorter, longer.substr(0, shorter.size()), ignoreOptionCase)) {
                        return false;
                    }
                }
                sticky.push_back(spelling);
            }
            return true;
        };
        for (const auto &option : command.options()) {
            if (!takeSticky(option)) {
                return false;
            }
        }
        for (const auto *option : inherited) {
            if (!takeSticky(*option)) {
                return false;
            }
        }

        std::vector<std::string_view> names;
        for (const auto &sub : command.commands()) {
            for (const auto &taken : names) {
                if (same_name(taken, sub.name(), ignoreCommandCase)) {
                    return false;
                }
            }
            names.push_back(sub.name());
        }

        for (const auto &option : command.options()) {
            if (option.isRecursive()) {
                inherited.push_back(&option);
            }
        }
        for (const auto &sub : command.commands()) {
            if (!unambiguous_under(sub, inherited, ignoreOptionCase, ignoreCommandCase)) {
                return false;
            }
        }
        return true;
    }

    inline std::optional<std::string> argument_problem(const Argument &argument) {
        if (argument.typeInfo().check) {
            for (const auto &item : argument.expectedValues()) {
                if (!argument.typeInfo().check(item)) {
                    return "argument \"" + argument.name() +
                           "\" has an expected value that is not a " + argument.typeInfo().name;
                }
            }
        }
        if (!argument.hasDefaultValue()) {
            return std::nullopt;
        }
        if (argument.isRequired()) {
            return "argument \"" + argument.name() + "\" is required and also has a default value";
        }
        const auto &value = argument.defaultValue();
        if (argument.typeInfo().check && !argument.typeInfo().check(value)) {
            return "argument \"" + argument.name() + "\" has a default value that is not a " +
                   argument.typeInfo().name;
        }
        const auto &expected = argument.expectedValues();
        if (!expected.empty() &&
            std::find(expected.begin(), expected.end(), value) == expected.end()) {
            return "argument \"" + argument.name() +
                   "\" has a default value outside its expected values";
        }
        if (argument.validator()) {
            std::string reason;
            if (!argument.validator()(value, &reason)) {
                std::string problem = "argument \"" + argument.name() +
                                      "\" has a default value its validator refuses";
                if (!reason.empty()) {
                    problem += ": " + reason;
                }
                return problem;
            }
        }
        return std::nullopt;
    }

    inline std::optional<std::string> arguments_problem(const std::vector<Argument> &arguments,
                                                        std::string_view owner) {
        std::vector<Argument> preceding;
        for (const auto &argument : arguments) {
            if (!arguments_can_follow(preceding, argument)) {
                return std::string(owner) + " has an invalid argument sequence at \"" +
                       argument.name() + "\"";
            }
            if (auto problem = argument_problem(argument)) {
                return problem;
            }
            preceding.push_back(argument);
        }
        return std::nullopt;
    }

    inline std::optional<std::string>
        catalogue_problem(const std::vector<CommandCatalogue::Group> &groups,
                          const std::vector<std::string> &available, std::string_view kind) {
        std::vector<CommandCatalogue::Group> preceding;
        for (const auto &group : groups) {
            if (!catalogue_can_add_group(preceding, group.members)) {
                return std::string(kind) + " catalogue assigns one member to more than one group";
            }
            for (const auto &member : group.members) {
                if (std::find(available.begin(), available.end(), member) == available.end()) {
                    return std::string(kind) + " catalogue names an unknown member \"" + member +
                           "\"";
                }
            }
            preceding.push_back(group);
        }
        return std::nullopt;
    }

    inline std::optional<std::string> local_problem(const Command &command, std::string_view path) {
        if (auto problem = arguments_problem(command.arguments(), path)) {
            return problem;
        }

        std::vector<Option> precedingOptions;
        for (const auto &option : command.options()) {
            if (option.prior() == Option::AutoSetWhenNoSymbols &&
                (option.isRequired() || !option.arguments().empty())) {
                return std::string(path) +
                       " has an automatic option that is required or takes arguments";
            }
            if (!options_can_join(precedingOptions, option)) {
                return std::string(path) + " has an invalid or duplicate option spelling";
            }
            if (option.maxOccurrence() < 0) {
                return std::string(path) + " has an option with a negative occurrence limit";
            }
            std::string owner = "option \"" + option.token() + "\"";
            if (auto problem = arguments_problem(option.arguments(), owner)) {
                return problem;
            }
            precedingOptions.push_back(option);
        }

        std::vector<Command> precedingCommands;
        for (const auto &sub : command.commands()) {
            if (!commands_can_join(precedingCommands, sub)) {
                return std::string(path) + " has an empty or duplicate subcommand name";
            }
            precedingCommands.push_back(sub);
        }

        std::vector<std::string> argumentNames;
        for (const auto &argument : command.arguments()) {
            argumentNames.push_back(argument.name());
        }
        std::vector<std::string> optionNames;
        for (const auto &option : command.options()) {
            optionNames.push_back(option.token());
        }
        std::vector<std::string> commandNames;
        for (const auto &sub : command.commands()) {
            commandNames.push_back(sub.name());
        }
        const auto &catalogue = command.catalogue();
        if (auto problem =
                catalogue_problem(catalogue.argumentGroups(), argumentNames, "argument")) {
            return problem;
        }
        if (auto problem = catalogue_problem(catalogue.optionGroups(), optionNames, "option")) {
            return problem;
        }
        if (auto problem = catalogue_problem(catalogue.commandGroups(), commandNames, "command")) {
            return problem;
        }

        for (const auto &sub : command.commands()) {
            std::string childPath = std::string(path) + " " + sub.name();
            if (auto problem = local_problem(sub, childPath)) {
                return problem;
            }
        }
        return std::nullopt;
    }

    /// Whether every command in \a command's tree can be parsed at all.
    ///
    /// What is in scope at a command is its own options plus the recursive ones above it, and
    /// they are looked up by spelling, so two of them answering to one spelling has no right
    /// answer. The pieces cannot see this as they are added: a command knows nothing about the
    /// ancestors it will end up under, so the whole tree is asked once it is one.
    ///
    /// \a ignoreOptionCase and \a ignoreCommandCase are the options the line will be read with,
    /// since under those two spellings differing only in case are one spelling.
    ///
    inline bool tree_can_be_parsed(const Command &command, bool ignoreOptionCase = false,
                                   bool ignoreCommandCase = false) {
        const std::string root =
            command.name().empty() ? "the root command" : "command \"" + command.name() + "\"";
        if (local_problem(command, root)) {
            return false;
        }
        std::vector<const Option *> inherited;
        return unambiguous_under(command, inherited, ignoreOptionCase, ignoreCommandCase);
    }

    /// The first reason \a command cannot be parsed, or nothing where its whole tree is valid.
    inline std::optional<std::string> validate_tree(const Command &command,
                                                    bool ignoreOptionCase = false,
                                                    bool ignoreCommandCase = false) {
        const std::string root =
            command.name().empty() ? "the root command" : "command \"" + command.name() + "\"";
        if (auto problem = local_problem(command, root)) {
            return problem;
        }
        std::vector<const Option *> inherited;
        if (!unambiguous_under(command, inherited, ignoreOptionCase, ignoreCommandCase)) {
            return "the command tree has ambiguous option or subcommand names, or a Remainder "
                   "argument shares a scope with a greedy option";
        }
        return std::nullopt;
    }

}

#endif // STDCORELIB_COMMANDLINE_P_H

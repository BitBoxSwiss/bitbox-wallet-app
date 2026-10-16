#ifndef COMMANDS_H
#define COMMANDS_H

#include <string>
#include <vector>

#include <stdcorelib/support/commandline.h>

#include "utils/utils.h"

namespace cli = stdc::cli;

// What the commands are, and the few things every one of them does with a parse result. Anything
// that is not about a command line is in utils/utils.h.

/// \name The commands
///
/// One per file, named after it. deploy is three, being a different program on every platform.
///
/// copy, rmdir and touch are here because Windows has no command of its own for any of them and
/// because CMake's answers are either slower or do not exist.
/// @{

int cmd_copy(const cli::ParseResult &result);
int cmd_rmdir(const cli::ParseResult &result);
int cmd_touch(const cli::ParseResult &result);
int cmd_configure(const cli::ParseResult &result);
int cmd_incsync(const cli::ParseResult &result);
int cmd_deploy(const cli::ParseResult &result);

/// @}

/// \name The options more than one command declares
///
/// Read the same way by all of them, so that a command line means one thing.
/// @{

inline bool isForceSet(const cli::ParseResult &result) {
    return result.option("-f").has_value();
}

inline bool isDryRunSet(const cli::ParseResult &result) {
    return result.option("-d").has_value();
}

inline bool isVerboseSet(const cli::ParseResult &result) {
    return result.option("-V").has_value();
}

inline bool isStandardSet(const cli::ParseResult &result) {
    return result.option("-s").has_value();
}

/// @}

/// \name Reading what was given
///
/// A parse result answers with \c std::optional, since a value that is not there and a value
/// that is empty are different questions. Nothing here needs them to be: an argument that was
/// not given and one given as an empty string both mean the command has nothing to work with.
/// So these fold the two together and hand back a plain value.
///
/// They are also the readable way to spell it. Written out, asking for one string is
/// <tt>result.value<std::string>(0).value_or(std::string())</tt>, and the tail of that cannot
/// be shortened to \c {} because \c value_or deduces its parameter and a braced initialiser
/// deduces nothing. MSVC takes it anyway, so a line written that way builds here and stops the
/// build on GCC.
/// @{

/// One positional argument of the command that was reached.
inline std::string argumentValue(const cli::ParseResult &result, int index) {
    return result.value<std::string>(index).value_or(std::string());
}

/// The values of one positional argument of the command that was reached.
inline std::vector<std::string> argumentValues(const cli::ParseResult &result, int index) {
    return result.values<std::string>(index).value_or(std::vector<std::string>{});
}

/// The first argument of \a token's first occurrence.
inline std::string optionValue(const cli::ParseResult &result, std::string_view token) {
    return result.valueForOption<std::string>(token).value_or(std::string());
}

/// The values of one argument of \a token, across every time it was given.
///
/// \param index which of the option's arguments to read, for the ones that take more than one
/// \return nothing at all where the option was not given
inline std::vector<std::string> optionValues(const cli::ParseResult &result,
                                             std::string_view token, int index = 0) {
    auto given = result.option(token);
    if (!given) {
        return {};
    }
    return given->allValues<std::string>(index).value_or(std::vector<std::string>{});
}

/// One argument of one occurrence of an option already known to have been given.
///
/// \param index which of the option's arguments to read
/// \param occurrence which time it was given, for an option that may be repeated
///
/// \pre \a occurrence names a time the option was given, which is what \c count() answers
inline std::string givenValue(const cli::OptionResult &given, int index = 0, int occurrence = 0) {
    return given.at(occurrence).value<std::string>(index).value_or(std::string());
}

/// @}

#endif // COMMANDS_H

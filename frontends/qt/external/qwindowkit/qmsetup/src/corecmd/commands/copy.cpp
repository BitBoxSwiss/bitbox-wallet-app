// copy, which puts files and directories where they are asked for and passes over what is
// already there and no older.

#include "commands.h"

#include "utils/utils.h"

#include <stdexcept>
#include <utility>

#include <stdcorelib/path.h>

namespace {

    // Whether \a dest is \a dir or lies somewhere under it.
    //
    // Compared as paths rather than as text, so that a directory is not taken for one whose name
    // it merely begins with.
    bool isInside(const fs::path &dest, const fs::path &dir) {
        const auto &relative = dest.lexically_relative(dir);
        return !relative.empty() && *relative.begin() != fs::path("..");
    }

}

int cmd_copy(const cli::ParseResult &result) {
    bool force = isForceSet(result);
    bool verbose = isVerboseSet(result);

    std::set<fs::path> files;
    std::set<fs::path> directories;
    std::set<fs::path> directoryContents;
    {
        for (const auto &rawString : argumentValues(result, 0)) {
            // Asked before back(), which has no last character to answer with here. An argument
            // is empty where a variable that was meant to name something expanded to nothing.
            if (rawString.empty()) {
                throw std::runtime_error("not a file or directory: \"\"");
            }

            bool contents = false;
            if (auto last = rawString.back(); last == '/' || last == '\\') {
                contents = true;
            }

            const auto &path = stdc::path::clean_path(fs::absolute(str2tstr(rawString)));
            if (fs::is_directory(path)) {
                (contents ? directoryContents : directories).insert(path);
            } else if (fs::exists(path)) {
                files.insert(path);
            } else {
                throw std::runtime_error("not a file or directory: \"" + rawString + "\"");
            }
        }
    }

    const auto &dest =
        stdc::path::clean_path(fs::absolute(str2tstr(argumentValue(result, 1))));

    // A destination inside a source is a walk that keeps arriving at what it has itself just
    // written, so it is turned down before anything is copied rather than left to make
    // directories until the platform runs out of path to name them with.
    const auto &refuseIfInside = [&dest](const std::set<fs::path> &sources) {
        for (const auto &item : sources) {
            if (isInside(dest, item)) {
                throw std::runtime_error("cannot copy \"" + tstr2str(item.native()) +
                                         "\" into itself");
            }
        }
    };
    refuseIfInside(directories);
    refuseIfInside(directoryContents);

    // Add excludes
    TStringList excludes;
    {
        const auto &excludeResult = optionValues(result, "-e");
        excludes.reserve(excludeResult.size());
        for (const auto &item : excludeResult) {
            excludes.emplace_back(str2tstr(item));
        }
    }

    // Copy
    const auto &excludeFunc = [&excludes](const fs::path &path) {
        return Utils::searchInRegexList(TString(path), excludes);
    };

    for (const auto &item : std::as_const(files)) {
        Utils::copyFile(item, dest, {}, force, verbose);
    }
    for (const auto &item : std::as_const(directories)) {
        Utils::copyDirectory(item, item, dest / item.filename(), force, verbose, excludeFunc);
    }
    for (const auto &item : std::as_const(directoryContents)) {
        Utils::copyDirectory(item, item, dest, force, verbose, excludeFunc);
    }

    return 0;
}

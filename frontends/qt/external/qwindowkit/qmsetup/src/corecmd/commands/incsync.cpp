// incsync, which builds an include directory out of a source tree.

#include "commands.h"

#include "utils/utils.h"

#include <fstream>
#include <iostream>
#include <map>
#include <set>

#include <stdcorelib/console.h>
#include <stdcorelib/path.h>
#include <stdcorelib/str.h>

using stdc::u8printf;

int cmd_incsync(const cli::ParseResult &result) {
    bool dryrun = isDryRunSet(result);
    bool verbose = dryrun || isVerboseSet(result);
    bool force = isForceSet(result);
    bool standard = isStandardSet(result);
    bool copy = result.option("-c").has_value();
    bool all = !result.option("-n").has_value();

    const fs::path &src =
        stdc::path::clean_path(fs::absolute(str2tstr(argumentValue(result, 0))));
    const fs::path &dest =
        stdc::path::clean_path(fs::absolute(str2tstr(argumentValue(result, 1))));
    if (!fs::is_directory(src)) {
        throw std::runtime_error("not a directory: \"" + tstr2str(src) + "\"");
    }

    // Add includes
    std::vector<std::pair<TString, TString>> includes;
    {
        const auto &includeResult = result.option("-i");
        int cnt = includeResult ? includeResult->count() : 0;
        includes.reserve(cnt + 1);

        // Add standard
        if (standard) {
            includes.emplace_back(_TSTR(R"(.*?_p\..+$)"), _TSTR("private"));
        }

        for (int i = 0; i < cnt; ++i) {
            includes.emplace_back(str2tstr(givenValue(*includeResult, 0, i)),
                                  str2tstr(givenValue(*includeResult, 1, i)));
        }
    }

    // Add excludes
    TStringList excludes;
    {
        const auto &excludeResult = optionValues(result, "-e");
        excludes.reserve(excludeResult.size());
        for (const auto &item : excludeResult) {
            excludes.emplace_back(str2tstr(item));
        }
    }

    // Remove target directory if needed
    if (!dryrun && fs::exists(dest) && force) {
        fs::remove_all(dest);
    }

    for (const auto &entry : fs::recursive_directory_iterator(src)) {
        if (entry.is_regular_file()) {
            const auto &path = entry.path();
            const auto &ext = stdc::str::to_lower(TString(path.extension()));
            if (!(ext == _TSTR(".h") || ext == _TSTR(".hh") || ext == _TSTR(".hpp") ||
                  ext == _TSTR(".hxx"))) {
                continue;
            }

            // Get subdirectory
            fs::path subdir;
            for (const auto &pair : includes) {
                TString pathString = path;
                // Replace separator
                std::replace(pathString.begin(), pathString.end(), _TSTR('\\'), _TSTR('/'));

                if (std::regex_search(pathString.begin(), pathString.end(),
                                      std::basic_regex<TChar>(pair.first))) {
                    subdir = pair.second;
                }
            }

            if (!all && subdir.empty())
                continue;

            // Check if it should be excluded
            if (Utils::searchInRegexList(TString(path), excludes))
                continue;

            const fs::path &targetDir = subdir.empty() ? dest : (dest / subdir);

            auto targetPath = targetDir / path.filename();
            if (verbose) {
                u8printf("Sync: from \"%s\" to \"%s\"\n", tstr2str(path).data(),
                       tstr2str(targetPath).data());
            }

            if (dryrun)
                continue;

            if (fs::exists(targetPath) &&
                Utils::fileTime(targetPath).modifyTime >= Utils::fileTime(path).modifyTime) {
                continue;
            }

            // Create directory
            if (!fs::exists(targetDir)) {
                fs::create_directories(targetDir);
            }

            if (copy) {
                // Copy
                fs::copy(path, targetPath, fs::copy_options::overwrite_existing);
            } else {
                // Make relative reference
                //
                // `relative` answers an empty path where the two have no root in common
                // rather than treating it as an error, which on Windows is a source
                // directory on one drive and a build directory on another. Writing that
                // out gave `#include ""`. There is no relative path to be had in that
                // case, so the absolute one is written instead.
                const auto relPath = fs::relative(path, targetDir);
                std::string rel = tstr2str(relPath.empty() ? path : relPath);

#ifdef _WIN32
                // Replace separator
                std::replace(rel.begin(), rel.end(), '\\', '/');
#endif

                // Create file
                std::ofstream outFile(targetPath);
                if (!outFile.is_open()) {
                    throw std::runtime_error("failed to open file \"" + tstr2str(targetPath) +
                                             "\": " + Utils::sysErrorMessage());
                }
                outFile << "#include \"" << rel << "\"" << std::endl;
                outFile.close();
            }

            // Set timestamp
            Utils::syncFileTime(targetPath, path);
        }
    }

    return 0;
}


// rmdir, which takes out the empty directories an install left behind.

#include "commands.h"

#include "utils/utils.h"

#include <utility>

int cmd_rmdir(const cli::ParseResult &result) {
    bool verbose = isVerboseSet(result);

    std::vector<fs::path> dirs;
    {
        const auto &dirsResult = argumentValues(result, 0);
        dirs.reserve(dirsResult.size());
        for (const auto &item : dirsResult) {
            dirs.emplace_back(fs::absolute(str2tstr(item)));
        }
    }

    for (const auto &item : std::as_const(dirs)) {
        if (!fs::is_directory(item)) {
            continue;
        }
        Utils::removeEmptyDirectories(item, verbose);
    }
    return 0;
}

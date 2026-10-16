// touch, which sets a file's timestamps, to another file's where one is named.

#include "commands.h"

#include "utils/utils.h"

#include <stdexcept>

#include <stdcorelib/console.h>

using stdc::u8printf;

int cmd_touch(const cli::ParseResult &result) {
    bool verbose = isVerboseSet(result);

    const auto &file = str2tstr(argumentValue(result, 0));
    const auto &refFile = str2tstr(argumentValue(result, 1));

    // Check existence
    if (!fs::is_regular_file(file)) {
        throw std::runtime_error("not a regular file: \"" + tstr2str(file) + "\"");
    }

    if (!refFile.empty() && !fs::is_regular_file(refFile)) {
        throw std::runtime_error("not a regular file: \"" + tstr2str(refFile) + "\"");
    }

    // Get time
    Utils::FileTime t;
    if (!refFile.empty()) {
        t = Utils::fileTime(refFile);
    } else {
        auto now = std::chrono::system_clock::now();
        t = {now, now, now};
    }

    // Set time
    if (verbose) {
        u8printf("Set A-Time: %s\n", Utils::time2str(t.accessTime).data());
        u8printf("Set M-Time: %s\n", Utils::time2str(t.modifyTime).data());
        u8printf("Set C-Time: %s\n", Utils::time2str(t.statusChangeTime).data());
    }
    Utils::setFileTime(file, t);
    return 0;
}

// SPDX-License-Identifier: MIT

#include <cstring>

#include <stdcorelib/support/logging.h>

using namespace stdc;

int main(int argc, char *argv[]) {
    if (argc != 2) {
        return 2;
    }

    LogCategory category("stdc.fatal.child");
    category.setFilterRules("stdc.fatal.child.fatal=false");

    if (std::strcmp(argv[1], "log") == 0) {
        category.log<Logger::Fatal>(__FILE__, __LINE__, __FUNCTION__, "filtered fatal");
    }
    if (std::strcmp(argv[1], "logf") == 0) {
        category.logf<Logger::Fatal>(__FILE__, __LINE__, __FUNCTION__, "filtered %s", "fatal");
    }
    return 0;
}

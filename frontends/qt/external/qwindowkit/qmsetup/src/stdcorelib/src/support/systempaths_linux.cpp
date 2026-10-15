// SPDX-License-Identifier: MIT

#include "systempaths.h"

#include <cerrno>
#include <cstdlib>
#include <string>
#include <vector>

#include <pwd.h>
#include <unistd.h>

namespace fs = std::filesystem;

namespace stdc::system {

    static std::optional<fs::path> absoluteEnvironmentPath(const char *name) {
        const char *value = std::getenv(name);
        if (!value || !*value) {
            return std::nullopt;
        }

        fs::path path(value);
        if (!path.is_absolute()) {
            return std::nullopt;
        }
        return path;
    }

    static std::optional<fs::path> accountHomePath() {
        long capacity = ::sysconf(_SC_GETPW_R_SIZE_MAX);
        if (capacity < 1) {
            capacity = 16384;
        }

        std::vector<char> buffer(static_cast<size_t>(capacity));
        passwd entry{};
        passwd *result = nullptr;
        int error = 0;
        while ((error = ::getpwuid_r(::geteuid(), &entry, buffer.data(), buffer.size(), &result)) ==
               ERANGE) {
            buffer.resize(buffer.size() * 2);
        }
        if (error || !result || !entry.pw_dir || !*entry.pw_dir) {
            return std::nullopt;
        }

        fs::path path(entry.pw_dir);
        if (!path.is_absolute()) {
            return std::nullopt;
        }
        return path;
    }

    static std::optional<fs::path> homePath() {
        if (auto path = absoluteEnvironmentPath("HOME")) {
            return path;
        }
        return accountHomePath();
    }

    static std::optional<fs::path> xdgPath(const char *name, const fs::path &fallback) {
        if (auto path = absoluteEnvironmentPath(name)) {
            return path;
        }
        if (auto home = homePath()) {
            return *home / fallback;
        }
        return std::nullopt;
    }

    std::optional<fs::path> SystemPaths::writableDirectory(Directory directory) {
        switch (directory) {
            case HomeDirectory:
                return homePath();
            case TempDirectory:
                if (auto path = absoluteEnvironmentPath("TMPDIR")) {
                    return path;
                }
                return fs::path("/tmp");
            case ConfigDirectory:
                return xdgPath("XDG_CONFIG_HOME", ".config");
            case AppDataDirectory:
                return xdgPath("XDG_DATA_HOME", ".local/share");
            case CacheDirectory:
                return xdgPath("XDG_CACHE_HOME", ".cache");
            case StateDirectory:
                return xdgPath("XDG_STATE_HOME", ".local/state");
        }
        return std::nullopt;
    }

}

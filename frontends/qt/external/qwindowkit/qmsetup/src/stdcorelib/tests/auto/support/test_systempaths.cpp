// SPDX-License-Identifier: MIT

#include <stdcorelib/support/systempaths.h>

#include <array>
#include <cstdlib>
#include <filesystem>
#include <optional>
#include <string>

#include <boost/test/unit_test.hpp>

namespace fs = std::filesystem;

using namespace stdc;

#if !defined(_WIN32) && !defined(__APPLE__)
namespace {

    class ScopedEnvironment {
    public:
        ScopedEnvironment(const char *name, const char *value) : _name(name) {
            if (const char *oldValue = std::getenv(name)) {
                _oldValue = oldValue;
            }
            if (value) {
                ::setenv(name, value, 1);
            } else {
                ::unsetenv(name);
            }
        }

        ~ScopedEnvironment() {
            if (_oldValue) {
                ::setenv(_name, _oldValue->c_str(), 1);
            } else {
                ::unsetenv(_name);
            }
        }

    private:
        const char *_name;
        std::optional<std::string> _oldValue;
    };

}
#endif

BOOST_AUTO_TEST_SUITE(test_systempaths)

BOOST_AUTO_TEST_CASE(test_directories) {
    using SystemPaths = system::SystemPaths;
    constexpr std::array directories{
        SystemPaths::HomeDirectory,   SystemPaths::TempDirectory,
        SystemPaths::ConfigDirectory, SystemPaths::AppDataDirectory,
        SystemPaths::CacheDirectory,  SystemPaths::StateDirectory,
    };

    for (const auto directory : directories) {
        const auto path = SystemPaths::writableDirectory(directory);
        BOOST_REQUIRE(path);
        BOOST_CHECK(!path->empty());
        BOOST_CHECK(path->is_absolute());
    }

    BOOST_CHECK(fs::is_directory(*SystemPaths::writableDirectory(SystemPaths::HomeDirectory)));
    BOOST_CHECK(fs::is_directory(*SystemPaths::writableDirectory(SystemPaths::TempDirectory)));
    BOOST_CHECK(!SystemPaths::writableDirectory(static_cast<SystemPaths::Directory>(-1)));

#ifdef _WIN32
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::ConfigDirectory) ==
                SystemPaths::writableDirectory(SystemPaths::AppDataDirectory));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::CacheDirectory) ==
                SystemPaths::writableDirectory(SystemPaths::StateDirectory));
#elif defined(__APPLE__)
    BOOST_CHECK_EQUAL(
        SystemPaths::writableDirectory(SystemPaths::ConfigDirectory)->filename().string(),
        "Preferences");
    BOOST_CHECK_EQUAL(
        SystemPaths::writableDirectory(SystemPaths::AppDataDirectory)->filename().string(),
        "Application Support");
    BOOST_CHECK_EQUAL(
        SystemPaths::writableDirectory(SystemPaths::CacheDirectory)->filename().string(),
        "Caches");
    BOOST_CHECK_EQUAL(
        SystemPaths::writableDirectory(SystemPaths::StateDirectory)->filename().string(),
        "State");
#endif
}

#if !defined(_WIN32) && !defined(__APPLE__)
BOOST_AUTO_TEST_CASE(test_follow_xdg_environment) {
    using SystemPaths = system::SystemPaths;
    const fs::path home = "/tmp/stdcorelib-systempaths-home";
    ScopedEnvironment setHome("HOME", home.c_str());
    ScopedEnvironment setTemp("TMPDIR", "/tmp/stdcorelib-systempaths-temp");
    ScopedEnvironment setConfig("XDG_CONFIG_HOME", "/tmp/stdcorelib-systempaths-config");
    ScopedEnvironment setData("XDG_DATA_HOME", "/tmp/stdcorelib-systempaths-data");
    ScopedEnvironment setCache("XDG_CACHE_HOME", "/tmp/stdcorelib-systempaths-cache");
    ScopedEnvironment setState("XDG_STATE_HOME", "/tmp/stdcorelib-systempaths-state");

    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::HomeDirectory) == home);
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::TempDirectory) ==
                fs::path("/tmp/stdcorelib-systempaths-temp"));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::ConfigDirectory) ==
                fs::path("/tmp/stdcorelib-systempaths-config"));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::AppDataDirectory) ==
                fs::path("/tmp/stdcorelib-systempaths-data"));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::CacheDirectory) ==
                fs::path("/tmp/stdcorelib-systempaths-cache"));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::StateDirectory) ==
                fs::path("/tmp/stdcorelib-systempaths-state"));
}

BOOST_AUTO_TEST_CASE(test_ignore_relative_xdg_environment) {
    using SystemPaths = system::SystemPaths;
    const fs::path home = "/tmp/stdcorelib-systempaths-home";
    ScopedEnvironment setHome("HOME", home.c_str());
    ScopedEnvironment setTemp("TMPDIR", "relative-temp");
    ScopedEnvironment setConfig("XDG_CONFIG_HOME", "relative-config");
    ScopedEnvironment setData("XDG_DATA_HOME", "relative-data");
    ScopedEnvironment setCache("XDG_CACHE_HOME", "relative-cache");
    ScopedEnvironment setState("XDG_STATE_HOME", "relative-state");

    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::TempDirectory) == fs::path("/tmp"));
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::ConfigDirectory) ==
                home / ".config");
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::AppDataDirectory) ==
                home / ".local/share");
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::CacheDirectory) == home / ".cache");
    BOOST_CHECK(SystemPaths::writableDirectory(SystemPaths::StateDirectory) ==
                home / ".local/state");
}
#endif

BOOST_AUTO_TEST_SUITE_END()

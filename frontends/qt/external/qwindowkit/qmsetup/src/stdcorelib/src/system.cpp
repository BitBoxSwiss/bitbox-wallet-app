// SPDX-License-Identifier: MIT

#include "system.h"

#ifdef _WIN32
#  include "winapi.h"
// ...
#  include <Psapi.h>
#elif defined(__APPLE__)
#  include <crt_externs.h>
#  include <mach/mach.h>
#  include <mach-o/dyld.h>
#else
#  include <limits.h>
#  include <unistd.h>
//
#  include <fstream>
#endif

#include <cstring>

#include "path.h"
#include "str.h"

#ifdef _WIN32
using PathChar = wchar_t;
using PathString = std::wstring;
static constexpr const PathChar PathSeparator = L'\\';
#else
using PathChar = char;
using PathString = std::string;
static constexpr const PathChar PathSeparator = '/';
#endif

namespace stdc {

#if defined(__APPLE__)

    static std::string macGetExecutablePath() {
        // Use stack buffer for the first try
        char stackBuf[PATH_MAX + 1];

        // "_NSGetExecutablePath" will return "-1" if the buffer is not large enough
        // and "*bufferSize" will be set to the size required.

        // Call
        unsigned int size = PATH_MAX + 1;
        char *buf = stackBuf;
        if (_NSGetExecutablePath(buf, &size) != 0) {
            // Re-alloc
            buf = new char[size]; // The return size contains the terminating 0

            // Call
            if (_NSGetExecutablePath(buf, &size) != 0) {
                delete[] buf;
                return {};
            }
        }

        // Return
        std::string res(buf);
        if (buf != stackBuf) {
            delete[] buf;
        }
        return res;
    }

#endif

    PathString sys_application_path() {
        static const auto res = []() -> PathString {
#ifdef _WIN32
            return winapi::kernel32::GetModuleFileNameW(nullptr);
#elif defined(__APPLE__)
            return macGetExecutablePath();
#else
            char buf[PATH_MAX];
            if (!realpath("/proc/self/exe", buf)) {
                return {};
            }
            return buf;
#endif
        }();
        return res;
    }

    static PathString sys_application_filename() {
        auto appName = sys_application_path();
        auto slashIdx = appName.find_last_of(PathSeparator);
        if (slashIdx != std::string::npos) {
            appName = appName.substr(slashIdx + 1);
        }
        return appName;
    }

    PathString sys_application_directory() {
        auto appDir = sys_application_path();
        auto slashIdx = appDir.find_last_of(PathSeparator);
        if (slashIdx != std::string::npos) {
            appDir = appDir.substr(0, slashIdx);
        }
        return appDir;
    }

    PathString sys_application_name() {
        auto appName = sys_application_filename();
#ifdef _WIN32
        auto dotIdx = appName.find_last_of(L'.');
        if (dotIdx != PathString::npos) {
            auto suffix = stdc::to_lower(appName.substr(dotIdx + 1));
            if (suffix == L"exe") {
                appName = appName.substr(0, dotIdx);
            }
        }
#endif
        return appName;
    }

    static std::vector<std::string> sys_command_line_arguments() {
        std::vector<std::string> res;
#ifdef _WIN32
        int argc;
        auto argvW = ::CommandLineToArgvW(::GetCommandLineW(), &argc);
        if (argvW == nullptr)
            return {};
        res.reserve(argc);
        for (int i = 0; i != argc; ++i) {
            res.push_back(wstring_conv::to_utf8(argvW[i]));
        }
        ::LocalFree(argvW);
#elif defined(__APPLE__)
        auto argv = *(_NSGetArgv());
        for (int i = 0; argv[i] != nullptr; ++i) {
            res.push_back(argv[i]);
        }
#else
        std::ifstream file("/proc/self/cmdline", std::ios::in);
        if (!file.is_open())
            return {};
        std::string s;
        while (std::getline(file, s, '\0')) {
            res.push_back(s);
        }
        file.close();
#endif
        return res;
    }

    namespace system {

        std::filesystem::path application_path() {
            static std::filesystem::path result = sys_application_path();
            return result;
        }

        std::filesystem::path application_directory() {
            static std::filesystem::path result = sys_application_directory();
            return result;
        }

        std::filesystem::path application_filename() {
            static std::filesystem::path result = sys_application_filename();
            return result;
        }

        std::string application_name() {
            static std::string result = path::to_utf8(sys_application_name());
            return result;
        }

        array_view<std::string> command_line_arguments() {
            static auto result = sys_command_line_arguments();
            return result;
        }

        /*
            Splits a command line string to a vector of arguments.

            https://github.com/qt/qtbase/blob/v6.8.0/src/corelib/io/qprocess.cpp#L2428
        */
        std::vector<std::string> split_command_line(const std::string_view &command) {
            std::vector<std::string> args;
            std::string tmp;
            int quoteCount = 0;
            bool inQuote = false;

            // handle quoting. tokens can be surrounded by double quotes
            // "hello world". three consecutive double quotes represent
            // the quote character itself.
            for (size_t i = 0; i < command.size(); ++i) {
                if (command.at(i) == '"') {
                    ++quoteCount;
                    if (quoteCount == 3) {
                        // third consecutive quote
                        quoteCount = 0;
                        tmp += command.at(i);
                    }
                    continue;
                }
                if (quoteCount) {
                    if (quoteCount == 1)
                        inQuote = !inQuote;
                    quoteCount = 0;
                }
                if (!inQuote && str::is_space(command.at(i))) {
                    if (!tmp.empty()) {
                        args.push_back(tmp);
                        tmp.clear();
                    }
                } else {
                    tmp += command.at(i);
                }
            }
            if (!tmp.empty()) {
                args.push_back(tmp);
            }
            return args;
        }

        std::string join_command_line(const std::vector<std::string> &args) {
            std::string cmdLine;
            for (size_t i = 0; i < args.size(); ++i) {
                if (i != 0)
                    cmdLine += ' ';

                if (args[i].find_first_of(" \t") != std::string::npos) {
                    std::string tmp = "\"";
                    for (const auto &c : args[i]) {
                        if (c == '"') {
                            tmp += "\"\"\"";
                        } else {
                            tmp += c;
                        }
                    }
                    tmp += "\"";
                    cmdLine += tmp;
                } else {
                    cmdLine += args[i];
                }
            }
            return cmdLine;
        }

#ifdef _WIN32
        std::map<std::string, std::string> environment() {
            std::map<std::string, std::string> env;
            if (wchar_t *envStrings = ::GetEnvironmentStringsW()) {
                for (const wchar_t *entry = envStrings; *entry;) {
                    const int entryLen = int(wcslen(entry));
                    // + 1 to permit magic cmd variable names starting with =
                    if (const wchar_t *equal = wcschr(entry + 1, L'=')) {
                        int nameLen = equal - entry;
                        std::string name = wstring_conv::to_utf8(entry, nameLen);
                        std::string value =
                            wstring_conv::to_utf8(equal + 1, entryLen - nameLen - 1);
                        env.insert(std::make_pair(name, value));
                    }
                    entry += entryLen + 1;
                }
                ::FreeEnvironmentStringsW(envStrings);
            }
            return env;
        }
#elif !defined(__APPLE__)
        std::map<std::string, std::string> environment() {
            std::map<std::string, std::string> env;
            const char *entry;
            for (int count = 0; (entry = environ[count]); ++count) {
                const char *equal = strchr(entry, '=');
                if (!equal)
                    continue;

                std::string name(entry, equal - entry);
                std::string value(equal + 1);
                env.insert(std::make_pair(name, value));
            }
            return env;
        }
#endif
    }

    /*
        Returns the memory usage of current process in bytes.
    */
    [[maybe_unused]] static size_t processMemoryUsage() {
#ifdef _WIN32
        PROCESS_MEMORY_COUNTERS pmc;
        if (::GetProcessMemoryInfo(::GetCurrentProcess(), &pmc, sizeof(pmc))) {
            return pmc.WorkingSetSize; // already in bytes
        }
        return 0;
#elif defined __APPLE__
        mach_task_basic_info info;
        mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
        if (task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t) &info, &count) ==
            KERN_SUCCESS) {
            return info.resident_size;
        }
        return 0;
#else
        std::ifstream statm("/proc/self/statm");
        if (!statm.is_open()) {
            return 0;
        }
        size_t size, resident, shared, text, lib, data, dt;
        statm >> size >> resident >> shared >> text >> lib >> data >> dt;
        return resident * sysconf(_SC_PAGESIZE);
#endif
    }

}

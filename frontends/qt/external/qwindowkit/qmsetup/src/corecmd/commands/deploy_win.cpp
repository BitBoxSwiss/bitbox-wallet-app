// What deploying comes to on Windows, which is copying.
//
// A PE file names what it needs and where to look is decided by the loader at run time, so a
// library that has moved needs nothing done to it. Nothing here rewrites a binary.

#include "deploy_p.h"

#include <stdcorelib/platform/windows/stdc_windows.h>

#include <stdcorelib/str.h>

#include "utils/utils.h"

namespace {

    // Where Windows keeps what every machine already has. Asked for rather than spelled out,
    // since Windows is not always on C:, and a 32 bit process is handed SysWOW64 here without
    // anyone having to work out that it should be.
    const std::vector<fs::path> &systemDirectories() {
        static const std::vector<fs::path> directories = []() {
            std::vector<fs::path> paths;
            wchar_t buf[MAX_PATH];
            if (UINT len = ::GetWindowsDirectoryW(buf, MAX_PATH); len > 0 && len < MAX_PATH) {
                paths.emplace_back(std::wstring(buf, len));
            }
            if (UINT len = ::GetSystemDirectoryW(buf, MAX_PATH); len > 0 && len < MAX_PATH) {
                paths.emplace_back(std::wstring(buf, len));
            }
            return paths;
        }();
        return directories;
    }

    bool isUnderSystemDirectory(const TString &fileName) {
        for (const auto &path : systemDirectories()) {
            if (fs::exists(path / fileName)) {
                return true;
            }
        }
        return false;
    }

    bool isMSVCLibrary(const TString &fileName) {
        return stdc::str::starts_with(fileName, _TSTR("vcruntime")) ||
               stdc::str::starts_with(fileName, _TSTR("msvcp")) ||
               stdc::str::starts_with(fileName, _TSTR("concrt")) ||
               stdc::str::starts_with(fileName, _TSTR("vccorlib")) ||
               stdc::str::starts_with(fileName, _TSTR("ucrtbase"));
    }

}

namespace Deploy {

    fs::path toDeployable(const fs::path &path) {
        return path;
    }

    fs::path toResolvable(const fs::path &path) {
        return path;
    }

    std::vector<fs::path> resolveDependencies(const fs::path &file, const Request &request,
                                              std::vector<std::string> *unparsed) {
        const auto &names =
            Utils::resolveWinBinaryDependencies(file, request.searchingPaths, unparsed);
        return {names.begin(), names.end()};
    }

    bool isSystemLibrary(const TString &fileName, bool standard) {
        // Never deployed, asked for or not. An api-ms-win or ext-ms-win name is an API set rather
        // than a file, and resolves to something under the system directory anyway.
        if (isUnderSystemDirectory(fileName) ||
            stdc::str::starts_with(fileName, _TSTR("api-ms-win-")) ||
            stdc::str::starts_with(fileName, _TSTR("ext-ms-win-"))) {
            return true;
        }
        return standard && isMSVCLibrary(fileName);
    }

    void noteDependency(const fs::path &path) {
        std::ignore = path;
    }

    void deployFiles(const Request &request, const std::vector<fs::path> &dependencies) {
        for (const auto &pair : std::as_const(request.extraFiles)) {
            Utils::copyFile(pair.first, pair.second, {}, request.force, request.verbose);
        }

        for (const auto &file : std::as_const(dependencies)) {
            Utils::copyFile(file, request.dest, {}, request.force, request.verbose);
        }
    }

}

// SPDX-License-Identifier: MIT

#include "systempaths.h"

#include <string>
#include <utility>

#include "platform/windows/stdc_windows.h"

#include <shlobj.h>

namespace fs = std::filesystem;

namespace stdc::system {

    static std::optional<fs::path> knownFolderPath(const KNOWNFOLDERID &id) {
        wchar_t *rawPath = nullptr;
        const HRESULT result = ::SHGetKnownFolderPath(id, KF_FLAG_DONT_VERIFY, nullptr, &rawPath);
        if (FAILED(result) || !rawPath || !*rawPath) {
            if (rawPath) {
                ::CoTaskMemFree(rawPath);
            }
            return std::nullopt;
        }

        fs::path path(rawPath);
        ::CoTaskMemFree(rawPath);
        if (!path.is_absolute()) {
            return std::nullopt;
        }
        return path;
    }

    static std::optional<fs::path> tempPath() {
        const DWORD required = ::GetTempPathW(0, nullptr);
        if (!required) {
            return std::nullopt;
        }

        std::wstring buffer(required, L'\0');
        const DWORD size = ::GetTempPathW(required, buffer.data());
        if (!size || size >= required) {
            return std::nullopt;
        }
        buffer.resize(size);

        fs::path path(std::move(buffer));
        if (!path.is_absolute()) {
            return std::nullopt;
        }
        return path;
    }

    std::optional<fs::path> SystemPaths::writableDirectory(Directory directory) {
        switch (directory) {
            case HomeDirectory:
                return knownFolderPath(FOLDERID_Profile);
            case TempDirectory:
                return tempPath();
            case ConfigDirectory:
            case AppDataDirectory:
                return knownFolderPath(FOLDERID_RoamingAppData);
            case CacheDirectory:
            case StateDirectory:
                return knownFolderPath(FOLDERID_LocalAppData);
        }
        return std::nullopt;
    }

}

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_WINAPI_H
#define STDCORELIB_WINAPI_H

#include "stdc_windows.h"

#include <string>
#include <chrono>

#include <stdcorelib/stdc_global.h>

namespace stdc::winapi {

    struct STDC_EXPORT kernel32 {
        //
        // winbase
        //
        static std::wstring FormatMessageW(int from, LPCVOID source, DWORD messageId,
                                           DWORD languageId, bool ignoreInserts = true,
                                           void *arguments = nullptr, bool isArray = false);


        //
        // stringapiset
        //
        static std::wstring MultiByteToWideChar(UINT cp, DWORD flags, const std::string_view &s);
        static std::string WideCharToMultiByte(UINT cp, DWORD flags, const std::wstring_view &s);


        //
        // libloaderapi
        //
        static std::wstring GetDllDirectoryW();
        static std::wstring GetModuleFileNameW(HMODULE hModule);


        //
        // processenv
        //
        static std::wstring GetEnvironmentVariableW(LPCWSTR name, bool *exists = nullptr);

        static std::wstring ExpandEnvironmentStringsW(LPCWSTR src, bool *ok);
    };

    struct STDC_EXPORT user32 {
        // To be added...
    };

}

#endif // STDCORELIB_WINAPI_H

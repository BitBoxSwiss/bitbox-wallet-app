// SPDX-License-Identifier: MIT

#include "winapi.h"

namespace stdc {}

namespace stdc::winapi {

    std::wstring kernel32::FormatMessageW(int from, LPCVOID source, DWORD messageId,
                                          DWORD languageId, bool ignoreInserts, void *arguments,
                                          bool isArray) {
        DWORD dwFlags = FORMAT_MESSAGE_ALLOCATE_BUFFER | from;
        if (ignoreInserts)
            dwFlags |= FORMAT_MESSAGE_IGNORE_INSERTS;
        if (isArray)
            dwFlags |= FORMAT_MESSAGE_ARGUMENT_ARRAY;

        std::wstring ret;
        wchar_t *pAllocated = nullptr;

        DWORD dwLength = ::FormatMessageW(dwFlags, source, messageId, languageId,
                                          (LPWSTR) &pAllocated, 0, (va_list *) arguments);
        if (dwLength != 0) {
            ret.assign(pAllocated, dwLength);
        }
        ::LocalFree((HLOCAL) pAllocated);
        return ret;
    }

    std::wstring kernel32::MultiByteToWideChar(UINT cp, DWORD flags, const std::string_view &s) {
        auto size = ::MultiByteToWideChar(cp, flags, s.data(), int(s.size()), nullptr, 0);
        if (size <= 0) {
            return {};
        }
        std::wstring res;
        res.resize(size);
        std::ignore = ::MultiByteToWideChar(cp, flags, s.data(), int(s.size()), res.data(), size);
        return res;
    }

    std::string kernel32::WideCharToMultiByte(UINT cp, DWORD flags, const std::wstring_view &s) {
        auto size =
            ::WideCharToMultiByte(cp, flags, s.data(), int(s.size()), nullptr, 0, nullptr, nullptr);
        if (size <= 0) {
            return {};
        }
        std::string res;
        res.resize(size);
        std::ignore = ::WideCharToMultiByte(cp, flags, s.data(), int(s.size()), res.data(), size,
                                            nullptr, nullptr);
        return res;
    }

    std::wstring kernel32::GetDllDirectoryW() {
        // The size asked for counts the terminator. The size written back does not, which is why
        // the result cannot keep the length from the first call.
        auto size = ::GetDllDirectoryW(0, nullptr);
        if (size == 0) {
            return {};
        }

        std::wstring res;
        res.resize(size);
        auto written = ::GetDllDirectoryW(size, res.data());
        if (written == 0 || written >= size) {
            return {}; // failed, or grew between the two calls
        }
        res.resize(written);
        return res;
    }

    std::wstring kernel32::GetModuleFileNameW(HMODULE hModule) {
        // https://stackoverflow.com/a/57114164/17177007
        DWORD size = MAX_PATH;
        std::wstring buffer;
        buffer.resize(size);
        while (true) {
            DWORD result = ::GetModuleFileNameW(hModule, buffer.data(), size);
            if (result == 0) {
                break;
            }

            if (result < size) {
                buffer.resize(result);
                return buffer;
            }

            // Check if a larger buffer is needed
            if (::GetLastError() == ERROR_INSUFFICIENT_BUFFER) {
                size *= 2;
                buffer.resize(size);
                continue;
            }

            // Exactly
            return buffer;
        }
        return {};
    }

    std::wstring kernel32::GetEnvironmentVariableW(LPCWSTR name, bool *exists) {
        // As above, the size asked for counts the terminator and the size written back does not.
        DWORD size = ::GetEnvironmentVariableW(name, nullptr, 0);
        if (size == 0) {
            if (exists)
                *exists = false;
            return {};
        }

        std::wstring res;
        res.resize(size - 1);
        // A variable set to nothing writes nothing, so zero is an answer as well as a failure and
        // only the last error tells them apart.
        ::SetLastError(ERROR_SUCCESS);
        DWORD written = ::GetEnvironmentVariableW(name, res.data(), size);
        if (written >= size || (written == 0 && ::GetLastError() != ERROR_SUCCESS)) {
            if (exists)
                *exists = false;
            return {};
        }
        res.resize(written);
        if (exists)
            *exists = true;
        return res;
    }

    std::wstring kernel32::ExpandEnvironmentStringsW(LPCWSTR src, bool *ok) {
        // This one counts the terminator both times, unlike the two above.
        DWORD size = ::ExpandEnvironmentStringsW(src, nullptr, 0);
        if (size == 0) {
            if (ok)
                *ok = false;
            return {};
        }

        std::wstring res;
        res.resize(size);
        DWORD written = ::ExpandEnvironmentStringsW(src, res.data(), size);
        if (written == 0 || written > size) {
            if (ok)
                *ok = false;
            return {};
        }
        res.resize(written - 1);
        if (ok)
            *ok = true;
        return res;
    }

}

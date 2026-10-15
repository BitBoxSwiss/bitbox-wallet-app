// SPDX-License-Identifier: MIT

#include "winextra.h"

#include "winapi.h"

#include "str.h"

namespace stdc {}

namespace stdc::windows {

    using namespace winapi;

    std::wstring systemError(DWORD errorCode, DWORD languageId) {
        std::wstring ret =
            kernel32::FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM, nullptr, errorCode, languageId);
        if (stdc::ends_with(ret, L"\r\n"))
            ret = ret.substr(0, ret.size() - 2);
        if (ret.empty()) {
            wchar_t buffer[50];
            std::ignore = wsprintfW(buffer, L"Unknown error 0x%X.", unsigned(errorCode));
            ret = buffer;
        }
        return ret;
    }

    static RTL_OSVERSIONINFOW static_get_real_os_version() {
        HMODULE hMod = ::GetModuleHandleW(L"ntdll.dll");
        using RtlGetVersionPtr = NTSTATUS(WINAPI *)(PRTL_OSVERSIONINFOW);
        auto pRtlGetVersion =
            reinterpret_cast<RtlGetVersionPtr>(::GetProcAddress(hMod, "RtlGetVersion"));
        RTL_OSVERSIONINFOW rovi{};
        rovi.dwOSVersionInfoSize = sizeof(rovi);
        pRtlGetVersion(&rovi);
        return rovi;
    }

    RTL_OSVERSIONINFOW systemVersion() {
        static auto result = static_get_real_os_version();
        return result;
    }

    namespace {

        // A FILETIME counts hundreds of nanoseconds from 1601. system_clock counts from 1970.
        // This is the distance between the two, in the unit they are converted through.
        constexpr uint64_t UnixEpochInFileTime = 116444736000000000ULL;

        using FileTimeDuration = std::chrono::duration<int64_t, std::ratio<1, 10'000'000>>;

    }

    std::chrono::system_clock::time_point fileTimeToTimePoint(const FILETIME &ft) {
        const uint64_t ticks = (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;

        // A timestamp from before 1970 makes this wrap, and reading the result back as signed is
        // what turns it into the negative duration it should be.
        const FileTimeDuration since_epoch(static_cast<int64_t>(ticks - UnixEpochInFileTime));

        return std::chrono::system_clock::time_point(
            std::chrono::duration_cast<std::chrono::system_clock::duration>(since_epoch));
    }

    FILETIME timePointToFileTime(const std::chrono::system_clock::time_point &tp) {
        const auto since_epoch =
            std::chrono::duration_cast<FileTimeDuration>(tp.time_since_epoch());

        // The wrap above, undone. A negative count wraps on the way into the unsigned value and
        // wraps back when the offset is added.
        ULARGE_INTEGER ticks;
        ticks.QuadPart = static_cast<uint64_t>(since_epoch.count()) + UnixEpochInFileTime;

        FILETIME ft;
        ft.dwLowDateTime = ticks.LowPart;
        ft.dwHighDateTime = ticks.HighPart;
        return ft;
    }

}

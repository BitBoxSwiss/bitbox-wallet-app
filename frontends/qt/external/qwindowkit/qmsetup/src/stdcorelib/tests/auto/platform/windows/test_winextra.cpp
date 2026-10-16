// SPDX-License-Identifier: MIT

#include <chrono>
#include <cstdint>
#include <string>

#include <stdcorelib/platform/windows/winextra.h>

#include <boost/test/unit_test.hpp>

using namespace stdc::windows;

BOOST_AUTO_TEST_SUITE(test_winextra)

namespace {

    // 1601-01-01 to 1970-01-01 in units of 100ns, which is what a FILETIME counts
    constexpr uint64_t UnixEpochInFileTime = 116444736000000000ULL;

    FILETIME fileTime(uint64_t ticks) {
        FILETIME ft;
        ft.dwLowDateTime = DWORD(ticks & 0xFFFFFFFF);
        ft.dwHighDateTime = DWORD(ticks >> 32);
        return ft;
    }

}

BOOST_AUTO_TEST_CASE(test_system_error) {
    auto message = systemError(ERROR_FILE_NOT_FOUND);
    BOOST_REQUIRE(!message.empty());

    // the system ends every one of these with a newline, which is no use inside a sentence
    BOOST_CHECK(message.back() != L'\n');
    BOOST_CHECK(message.back() != L'\r');

    // a code with no text behind it still describes itself rather than coming back empty
    auto unknown = systemError(0xDEADBEEF);
    BOOST_CHECK(unknown == L"Unknown error 0xDEADBEEF.");

    // success is a code like any other and has its own message
    BOOST_CHECK(!systemError(ERROR_SUCCESS).empty());
}

BOOST_AUTO_TEST_CASE(test_system_version) {
    auto version = systemVersion();

    // read through RtlGetVersion rather than GetVersionEx, so it is the real version and not the
    // 6.2 that an unmanifested process is told
    BOOST_CHECK_EQUAL(version.dwOSVersionInfoSize, sizeof(RTL_OSVERSIONINFOW));
    BOOST_CHECK(version.dwMajorVersion >= 10);
    BOOST_CHECK(version.dwBuildNumber > 0);

    // it is read once and kept
    BOOST_CHECK_EQUAL(systemVersion().dwBuildNumber, version.dwBuildNumber);
}

BOOST_AUTO_TEST_CASE(test_file_time_at_the_unix_epoch) {
    const auto epoch = std::chrono::system_clock::time_point{};

    BOOST_CHECK(fileTimeToTimePoint(fileTime(UnixEpochInFileTime)) == epoch);

    auto back = timePointToFileTime(epoch);
    BOOST_CHECK_EQUAL(back.dwLowDateTime, DWORD(UnixEpochInFileTime & 0xFFFFFFFF));
    BOOST_CHECK_EQUAL(back.dwHighDateTime, DWORD(UnixEpochInFileTime >> 32));
}

BOOST_AUTO_TEST_CASE(test_file_time_before_the_unix_epoch) {
    // The conversion subtracts the epoch offset from an unsigned value, so anything the registry
    // or a file system reports from before 1970 goes through a wraparound on the way out.
    constexpr uint64_t OneDay = 24ULL * 60 * 60 * 10'000'000;

    auto tp = fileTimeToTimePoint(fileTime(UnixEpochInFileTime - OneDay));
    BOOST_CHECK(tp < std::chrono::system_clock::time_point{});
    BOOST_CHECK_EQUAL(std::chrono::duration_cast<std::chrono::hours>(tp.time_since_epoch()).count(),
                      -24);

    auto back = timePointToFileTime(tp);
    BOOST_CHECK_EQUAL(back.dwLowDateTime, DWORD((UnixEpochInFileTime - OneDay) & 0xFFFFFFFF));
    BOOST_CHECK_EQUAL(back.dwHighDateTime, DWORD((UnixEpochInFileTime - OneDay) >> 32));
}

BOOST_AUTO_TEST_CASE(test_file_time_round_trip) {
    // A real timestamp, at the full resolution both sides claim to carry.
    FILETIME now;
    ::GetSystemTimeAsFileTime(&now);

    auto back = timePointToFileTime(fileTimeToTimePoint(now));
    BOOST_CHECK_EQUAL(back.dwLowDateTime, now.dwLowDateTime);
    BOOST_CHECK_EQUAL(back.dwHighDateTime, now.dwHighDateTime);
}

BOOST_AUTO_TEST_SUITE_END()

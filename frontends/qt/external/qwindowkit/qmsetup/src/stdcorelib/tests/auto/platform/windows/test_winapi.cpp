// SPDX-License-Identifier: MIT

#include <cwchar>
#include <string>

#include <stdcorelib/platform/windows/winapi.h>
#include <stdcorelib/scope_guard.h>

#include <boost/test/unit_test.hpp>

using namespace stdc::winapi;

BOOST_AUTO_TEST_SUITE(test_winapi)

namespace {

    // Each of these builds a std::wstring from a length the API reported, and the APIs disagree
    // about whether that length counts the terminator. Comparing size() against wcslen() is what
    // catches a result carrying a stray trailing null that no caller would expect.
    bool no_embedded_terminator(const std::wstring &s) {
        return s.size() == std::wcslen(s.c_str());
    }

}

BOOST_AUTO_TEST_CASE(test_format_message) {
    auto message =
        kernel32::FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM, nullptr, ERROR_FILE_NOT_FOUND, 0);
    BOOST_CHECK(!message.empty());
    BOOST_CHECK(no_embedded_terminator(message));

    // a code the system has no text for gives nothing rather than something invented
    BOOST_CHECK(
        kernel32::FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM, nullptr, 0xDEADBEEF, 0).empty());
}

BOOST_AUTO_TEST_CASE(test_code_page_conversion) {
    // "中文", spelled in bytes so the source encoding cannot affect the test
    const std::string utf8 = "\xE4\xB8\xAD\xE6\x96\x87";

    auto wide = kernel32::MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8);
    BOOST_REQUIRE_EQUAL(wide.size(), 2u);
    BOOST_CHECK(wide[0] == 0x4E2D);
    BOOST_CHECK(wide[1] == 0x6587);
    BOOST_CHECK(no_embedded_terminator(wide));

    BOOST_CHECK(kernel32::WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide) == utf8);

    // the empty string is not a failure, it just has nothing to convert
    BOOST_CHECK(kernel32::MultiByteToWideChar(CP_UTF8, 0, std::string()).empty());
    BOOST_CHECK(kernel32::WideCharToMultiByte(CP_UTF8, 0, std::wstring()).empty());

    // bytes that are not valid in the code page they claim come back empty, which is what
    // MB_ERR_INVALID_CHARS buys
    BOOST_CHECK(
        kernel32::MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, std::string("\x80")).empty());
}

BOOST_AUTO_TEST_CASE(test_module_file_name) {
    auto path = kernel32::GetModuleFileNameW(nullptr); // null asks for this executable
    BOOST_CHECK(!path.empty());
    BOOST_CHECK(no_embedded_terminator(path));
    BOOST_CHECK(path.find(L'\\') != std::wstring::npos); // an absolute path

    // a handle that is not a loaded module has no name
    BOOST_CHECK(kernel32::GetModuleFileNameW(HMODULE(-1)).empty());
}

BOOST_AUTO_TEST_CASE(test_dll_directory) {
    auto restore = stdc::make_scope_guard([] { ::SetDllDirectoryW(nullptr); });

    BOOST_REQUIRE(::SetDllDirectoryW(L"C:\\stdcorelib\\test"));
    auto dir = kernel32::GetDllDirectoryW();
    BOOST_CHECK(dir == L"C:\\stdcorelib\\test");
    BOOST_CHECK(no_embedded_terminator(dir));

    // having no directory set is the default, not an error
    ::SetDllDirectoryW(nullptr);
    BOOST_CHECK(kernel32::GetDllDirectoryW().empty());
}

BOOST_AUTO_TEST_CASE(test_environment_variable) {
    const wchar_t *name = L"STDC_TEST_VAR";
    auto restore = stdc::make_scope_guard([&] { ::SetEnvironmentVariableW(name, nullptr); });

    BOOST_REQUIRE(::SetEnvironmentVariableW(name, L"value"));
    bool exists = false;
    auto value = kernel32::GetEnvironmentVariableW(name, &exists);
    BOOST_CHECK(exists);
    BOOST_CHECK(value == L"value");
    BOOST_CHECK(no_embedded_terminator(value));

    // a variable set to nothing still exists, and that is the case an empty return value cannot
    // report on its own
    BOOST_REQUIRE(::SetEnvironmentVariableW(name, L""));
    exists = false;
    BOOST_CHECK(kernel32::GetEnvironmentVariableW(name, &exists).empty());
    BOOST_CHECK(exists);

    // one that was never set does not
    exists = true;
    BOOST_CHECK(kernel32::GetEnvironmentVariableW(L"STDC_NO_SUCH_VAR", &exists).empty());
    BOOST_CHECK(!exists);
}

BOOST_AUTO_TEST_CASE(test_expand_environment_strings) {
    const wchar_t *name = L"STDC_TEST_EXPAND";
    auto restore = stdc::make_scope_guard([&] { ::SetEnvironmentVariableW(name, nullptr); });
    BOOST_REQUIRE(::SetEnvironmentVariableW(name, L"expanded"));

    bool ok = false;
    auto result = kernel32::ExpandEnvironmentStringsW(L"[%STDC_TEST_EXPAND%]", &ok);
    BOOST_CHECK(ok);
    BOOST_CHECK(result == L"[expanded]");
    BOOST_CHECK(no_embedded_terminator(result));

    // text with nothing to expand comes back as it went in
    ok = false;
    BOOST_CHECK(kernel32::ExpandEnvironmentStringsW(L"plain", &ok) == L"plain");
    BOOST_CHECK(ok);

    // a name that resolves to nothing is left standing, which is the API's own behavior and not
    // a failure
    BOOST_CHECK(kernel32::ExpandEnvironmentStringsW(L"%STDC_NO_SUCH_VAR%", &ok) ==
                L"%STDC_NO_SUCH_VAR%");
}

BOOST_AUTO_TEST_SUITE_END()

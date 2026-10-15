// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_UTF_H
#define STDCORELIB_UTF_H

#include <string>
#include <string_view>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup text
    /// @{

    /// Conversions between the three UTF encodings, without the standard library's help and
    /// without the platform's.
    ///
    /// The encodings are named in the function, not left to the width of a type. \c std::wstring
    /// is UTF-16 on Windows and UTF-32 everywhere else, which is why the wide functions are a
    /// convenience over the explicit ones rather than the other way round.
    ///
    /// \note Code pages are a separate matter and are not here. Converting to or from the local
    ///       ANSI encoding is a Windows API call, and lives in \c str::conv<std::wstring>.
    namespace utf {

        /// What to do about input that is not valid in its own encoding.
        enum error_policy {
            /// Put U+FFFD where the bad sequence was and carry on, so the conversion always
            /// produces something. The default, because losing a whole log line or file name to
            /// one bad byte is worse than losing the byte.
            replace,

            /// Give up and return an empty string.
            fail,
        };

        /// The character a \c replace conversion substitutes.
        constexpr char32_t replacement_character = 0xFFFD;

        /// The largest code point Unicode defines.
        constexpr char32_t max_code_point = 0x10FFFF;

        /// \name Conversions
        ///
        /// Each takes the policy for invalid input and, optionally, somewhere to report whether
        /// the input was valid. \a ok is worth passing only under \c fail, where an empty result
        /// otherwise says nothing about whether the input was empty or bad.
        /// @{

        STDC_EXPORT std::u16string utf8_to_utf16(std::string_view s, error_policy policy = replace,
                                                 bool *ok = nullptr);

        STDC_EXPORT std::u32string utf8_to_utf32(std::string_view s, error_policy policy = replace,
                                                 bool *ok = nullptr);

        STDC_EXPORT std::string utf16_to_utf8(std::u16string_view s, error_policy policy = replace,
                                              bool *ok = nullptr);

        STDC_EXPORT std::u32string utf16_to_utf32(std::u16string_view s,
                                                  error_policy policy = replace,
                                                  bool *ok = nullptr);

        STDC_EXPORT std::string utf32_to_utf8(std::u32string_view s, error_policy policy = replace,
                                              bool *ok = nullptr);

        STDC_EXPORT std::u16string utf32_to_utf16(std::u32string_view s,
                                                  error_policy policy = replace,
                                                  bool *ok = nullptr);

        /// @}

        /// \name Wide strings
        ///
        /// The same conversions against whichever encoding \c wchar_t holds here, which is
        /// UTF-16 on Windows and UTF-32 elsewhere.
        /// @{

        STDC_EXPORT std::wstring utf8_to_wide(std::string_view s, error_policy policy = replace,
                                              bool *ok = nullptr);

        STDC_EXPORT std::string wide_to_utf8(std::wstring_view s, error_policy policy = replace,
                                             bool *ok = nullptr);

        /// @}

        /// \name Validation
        ///
        /// Whether the input is well formed, without building the converted string.
        /// @{

        STDC_EXPORT bool is_valid_utf8(std::string_view s);
        STDC_EXPORT bool is_valid_utf16(std::u16string_view s);
        STDC_EXPORT bool is_valid_utf32(std::u32string_view s);

        /// @}

        /// Whether \a c is a code point that may appear in text: within range, and not one of
        /// the surrogates, which exist only to encode a pair in UTF-16.
        constexpr bool is_valid_code_point(char32_t c) {
            return c <= max_code_point && (c < 0xD800 || c > 0xDFFF);
        }

    }

    /// @}
}

#endif // STDCORELIB_UTF_H

// SPDX-License-Identifier: MIT

#include "utf.h"

#include <cstdint>
#include <memory>
#include <type_traits>

namespace stdc::utf {

    namespace {

        /// Widens a code unit through the unsigned type of its own width. \c wchar_t is signed on
        /// most platforms that are not Windows, and sign extending it would hand the decoder a
        /// value no encoding could have produced.
        template <class Char>
        char32_t code_unit(Char c) {
            return char32_t(std::make_unsigned_t<Char>(c));
        }

        // How many bytes a lead byte announces, or 0 if it cannot start a sequence. C0 and C1
        // are missing on purpose: the only things they could encode are already spelled in one
        // byte, and accepting the longer form lets the same text be written two ways. F5 and
        // above would run past U+10FFFF.
        int sequence_length(uint8_t lead) {
            if (lead < 0x80) {
                return 1;
            }
            if (lead >= 0xC2 && lead <= 0xDF) {
                return 2;
            }
            if (lead >= 0xE0 && lead <= 0xEF) {
                return 3;
            }
            if (lead >= 0xF0 && lead <= 0xF4) {
                return 4;
            }
            return 0;
        }

        bool is_continuation(uint8_t c) {
            return (c & 0xC0) == 0x80;
        }

        // The second byte carries the constraint that the lead byte alone cannot express: which
        // of the values in its range would be an overlong encoding, a surrogate, or past the end
        // of Unicode.
        bool second_byte_ok(uint8_t lead, uint8_t second) {
            switch (lead) {
                case 0xE0:
                    return second >= 0xA0 && second <= 0xBF; // shorter form exists below A0
                case 0xED:
                    return second >= 0x80 && second <= 0x9F; // above 9F is a surrogate
                case 0xF0:
                    return second >= 0x90 && second <= 0xBF; // shorter form exists below 90
                case 0xF4:
                    return second >= 0x80 && second <= 0x8F; // above 8F is past U+10FFFF
                default:
                    return is_continuation(second);
            }
        }

        // One type per encoding, rather than a pair of function pointers, so that the walk in
        // convert() calls them directly and they inline into it.

        struct utf8_codec {
            /// Reads one code point starting at \a pos.
            ///
            /// On success \a pos moves past it and the code point comes back. On invalid input
            /// \a pos moves past the maximal part that could still have been the start of
            /// something valid, which is at least one unit, and the result is nothing. Consuming
            /// exactly that much is what stops one bad byte turning the rest of the text into
            /// replacement characters.
            static bool decode(std::string_view s, size_t &pos, char32_t &out) {
                const uint8_t lead = uint8_t(s[pos]);
                const int length = sequence_length(lead);
                if (length == 0) {
                    pos += 1;
                    return false;
                }
                if (length == 1) {
                    out = lead;
                    pos += 1;
                    return true;
                }

                // A sequence cut off by the end of the input is not valid, but it is not garbage
                // either, so what there is of it is consumed whole rather than one byte at a
                // time. Only the part that was still on its way to being valid counts: E0 80 at
                // the end of the input is not a truncated sequence, it is E0 followed by a byte
                // that could never have come after it.
                if (pos + size_t(length) > s.size()) {
                    size_t taken = 1;
                    if (pos + 1 < s.size() && second_byte_ok(lead, uint8_t(s[pos + 1]))) {
                        taken = 2;
                        while (pos + taken < s.size() && is_continuation(uint8_t(s[pos + taken]))) {
                            ++taken;
                        }
                    }
                    pos += taken;
                    return false;
                }

                if (!second_byte_ok(lead, uint8_t(s[pos + 1]))) {
                    pos += 1;
                    return false;
                }
                for (int i = 2; i < length; ++i) {
                    if (!is_continuation(uint8_t(s[pos + i]))) {
                        pos += size_t(i);
                        return false;
                    }
                }

                char32_t c = lead & (0xFF >> (length + 1));
                for (int i = 1; i < length; ++i) {
                    c = (c << 6) | (uint8_t(s[pos + i]) & 0x3F);
                }
                pos += size_t(length);
                out = c;
                return true;
            }

            /// Writes \a c at \a p and returns how many units that took. There is always room for
            /// the longest form, so the encoders never have to ask whether the write will fit.
            static int encode(char32_t c, char *p) {
                if (c < 0x80) {
                    p[0] = char(c);
                    return 1;
                }
                if (c < 0x800) {
                    p[0] = char(0xC0 | (c >> 6));
                    p[1] = char(0x80 | (c & 0x3F));
                    return 2;
                }
                if (c < 0x10000) {
                    p[0] = char(0xE0 | (c >> 12));
                    p[1] = char(0x80 | ((c >> 6) & 0x3F));
                    p[2] = char(0x80 | (c & 0x3F));
                    return 3;
                }
                p[0] = char(0xF0 | (c >> 18));
                p[1] = char(0x80 | ((c >> 12) & 0x3F));
                p[2] = char(0x80 | ((c >> 6) & 0x3F));
                p[3] = char(0x80 | (c & 0x3F));
                return 4;
            }
        };

        struct utf16_codec {
            /// Follows the same contract as utf8_codec::decode().
            template <class View>
            static bool decode(View s, size_t &pos, char32_t &out) {
                const char32_t unit = code_unit(s[pos]);
                if (unit < 0xD800 || unit > 0xDFFF) {
                    out = unit;
                    pos += 1;
                    return true;
                }
                if (unit >= 0xDC00) { // a low surrogate with no high one ahead of it
                    pos += 1;
                    return false;
                }
                if (pos + 1 >= s.size()) {
                    pos += 1;
                    return false;
                }
                const char32_t low = code_unit(s[pos + 1]);
                if (low < 0xDC00 || low > 0xDFFF) {
                    pos += 1;
                    return false;
                }
                out = 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00);
                pos += 2;
                return true;
            }

            template <class Char>
            static int encode(char32_t c, Char *p) {
                if (c < 0x10000) {
                    p[0] = Char(c);
                    return 1;
                }
                c -= 0x10000;
                p[0] = Char(0xD800 + (c >> 10));
                p[1] = Char(0xDC00 + (c & 0x3FF));
                return 2;
            }
        };

        // UTF-32 has no encoding to get wrong, only values that are not code points.
        struct utf32_codec {
            template <class View>
            static bool decode(View s, size_t &pos, char32_t &out) {
                const char32_t c = code_unit(s[pos]);
                pos += 1;
                if (!is_valid_code_point(c)) {
                    return false;
                }
                out = c;
                return true;
            }

            template <class Char>
            static int encode(char32_t c, Char *p) {
                p[0] = Char(c);
                return 1;
            }
        };

        /// The most units of output that one unit of input can turn into.
        ///
        /// A byte of UTF-8 never yields more than one unit of anything wider, because however
        /// many bytes a sequence spans it still decodes to a single code point. In the other
        /// direction a unit of UTF-16 reaches three bytes, a code point reaches four, and an
        /// invalid unit costs the three bytes of U+FFFD.
        template <class SourceChar, class Char>
        constexpr size_t max_units() {
            if (sizeof(SourceChar) == 1) {
                return 1;
            }
            if (sizeof(Char) == 1) {
                return sizeof(SourceChar) == 2 ? 3 : 4;
            }
            return sizeof(SourceChar) == 4 && sizeof(Char) == 2 ? 2 : 1;
        }

        /// How many units a conversion writes without reaching for the heap. Enough for the
        /// names, keys and log lines that most conversions are.
        constexpr size_t inline_units = 256;

        // Every conversion is the same walk, so they share one. Decode is told how to read a code
        // point out of the source, Encode how to write one into the result.
        //
        // The result is built in a scratch buffer of the largest size it could need and copied
        // out at the end, rather than grown a code point at a time. The buffer is deliberately
        // left uninitialized: filling the bound first is the single largest cost in a conversion,
        // since a whole page has to be faulted in whether or not the result reaches it. That is
        // also why this is not make_unique, which would value initialize.
        template <class Result, class Decode, class Encode, class Source>
        Result convert(Source s, error_policy policy, bool *ok) {
            using Char = typename Result::value_type;

            const size_t bound = s.size() * max_units<typename Source::value_type, Char>();
            Char inline_buffer[inline_units];
            std::unique_ptr<Char[]> heap;
            if (bound > inline_units) {
                heap.reset(new Char[bound]);
            }
            Char *const begin = heap ? heap.get() : inline_buffer;
            Char *p = begin;

            bool valid = true;
            size_t pos = 0;
            while (pos < s.size()) {
                char32_t c = 0;
                if (!Decode::decode(s, pos, c)) {
                    valid = false;
                    if (policy == fail) {
                        if (ok) {
                            *ok = false;
                        }
                        return Result();
                    }
                    c = replacement_character;
                }
                p += Encode::encode(c, p);
            }

            if (ok) {
                *ok = valid;
            }
            return Result(begin, size_t(p - begin));
        }

    }

    std::u16string utf8_to_utf16(std::string_view s, error_policy policy, bool *ok) {
        return convert<std::u16string, utf8_codec, utf16_codec>(s, policy, ok);
    }

    std::u32string utf8_to_utf32(std::string_view s, error_policy policy, bool *ok) {
        return convert<std::u32string, utf8_codec, utf32_codec>(s, policy, ok);
    }

    std::string utf16_to_utf8(std::u16string_view s, error_policy policy, bool *ok) {
        return convert<std::string, utf16_codec, utf8_codec>(s, policy, ok);
    }

    std::u32string utf16_to_utf32(std::u16string_view s, error_policy policy, bool *ok) {
        return convert<std::u32string, utf16_codec, utf32_codec>(s, policy, ok);
    }

    std::string utf32_to_utf8(std::u32string_view s, error_policy policy, bool *ok) {
        return convert<std::string, utf32_codec, utf8_codec>(s, policy, ok);
    }

    std::u16string utf32_to_utf16(std::u32string_view s, error_policy policy, bool *ok) {
        return convert<std::u16string, utf32_codec, utf16_codec>(s, policy, ok);
    }

    // The wide functions convert straight into a wstring rather than through a u16string or a
    // u32string, which would be an entire second pass to copy units that already agree.

    std::wstring utf8_to_wide(std::string_view s, error_policy policy, bool *ok) {
        static_assert(sizeof(wchar_t) == 2 || sizeof(wchar_t) == 4,
                      "wchar_t is neither UTF-16 nor UTF-32 wide");
        if constexpr (sizeof(wchar_t) == 2) {
            return convert<std::wstring, utf8_codec, utf16_codec>(s, policy, ok);
        } else {
            return convert<std::wstring, utf8_codec, utf32_codec>(s, policy, ok);
        }
    }

    std::string wide_to_utf8(std::wstring_view s, error_policy policy, bool *ok) {
        if constexpr (sizeof(wchar_t) == 2) {
            return convert<std::string, utf16_codec, utf8_codec>(s, policy, ok);
        } else {
            return convert<std::string, utf32_codec, utf8_codec>(s, policy, ok);
        }
    }

    bool is_valid_utf8(std::string_view s) {
        size_t pos = 0;
        while (pos < s.size()) {
            char32_t c = 0;
            if (!utf8_codec::decode(s, pos, c)) {
                return false;
            }
        }
        return true;
    }

    bool is_valid_utf16(std::u16string_view s) {
        size_t pos = 0;
        while (pos < s.size()) {
            char32_t c = 0;
            if (!utf16_codec::decode(s, pos, c)) {
                return false;
            }
        }
        return true;
    }

    bool is_valid_utf32(std::u32string_view s) {
        for (char32_t c : s) {
            if (!is_valid_code_point(c)) {
                return false;
            }
        }
        return true;
    }

}

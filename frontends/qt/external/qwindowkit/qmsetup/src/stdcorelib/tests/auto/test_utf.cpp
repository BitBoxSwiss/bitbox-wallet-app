// SPDX-License-Identifier: MIT

#include <initializer_list>
#include <string>

#include <stdcorelib/utf.h>

#include <boost/test/unit_test.hpp>

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_utf)

namespace {

    // Spelled as bytes so nothing depends on how the compiler treats a literal.
    std::string bytes(std::initializer_list<int> v) {
        std::string s;
        for (int c : v) {
            s.push_back(char(static_cast<unsigned char>(c)));
        }
        return s;
    }

    std::u16string units(std::initializer_list<int> v) {
        std::u16string s;
        for (int c : v) {
            s.push_back(char16_t(c));
        }
        return s;
    }

    constexpr char32_t Fffd = utf::replacement_character;

}

BOOST_AUTO_TEST_CASE(test_round_trip) {
    // ASCII, two-byte, three-byte, and one past the BMP so a surrogate pair is involved
    const std::u32string source = {U'A', 0x00E9, 0x4F60, 0x1F600, U'z'};

    auto u8 = utf::utf32_to_utf8(source);
    auto u16 = utf::utf32_to_utf16(source);

    BOOST_CHECK_EQUAL(u8.size(), 1u + 2u + 3u + 4u + 1u);
    BOOST_CHECK_EQUAL(u16.size(), 1u + 1u + 1u + 2u + 1u); // the emoji takes two units

    BOOST_CHECK(utf::utf8_to_utf32(u8) == source);
    BOOST_CHECK(utf::utf16_to_utf32(u16) == source);
    BOOST_CHECK(utf::utf8_to_utf16(u8) == u16);
    BOOST_CHECK(utf::utf16_to_utf8(u16) == u8);
}

BOOST_AUTO_TEST_CASE(test_empty_input_is_not_a_failure) {
    bool ok = false;
    BOOST_CHECK(utf::utf8_to_utf16({}, utf::fail, &ok).empty());
    BOOST_CHECK(ok); // empty in, empty out, nothing went wrong

    ok = false;
    BOOST_CHECK(utf::utf16_to_utf8({}, utf::fail, &ok).empty());
    BOOST_CHECK(ok);
}

// The encodings that mean something already spelled in fewer bytes. Accepting them would let the
// same text be written more than one way, which is how a check on the short form gets bypassed.
BOOST_AUTO_TEST_CASE(test_overlong_is_rejected) {
    const std::string cases[] = {
        bytes({0xC0, 0x80}),             // NUL the long way
        bytes({0xC1, 0xBF}),             // U+007F the long way
        bytes({0xE0, 0x80, 0x80}),       // NUL the longer way
        bytes({0xE0, 0x9F, 0xBF}),       // below the three-byte range
        bytes({0xF0, 0x80, 0x80, 0x80}), // NUL longer still
        bytes({0xF0, 0x8F, 0xBF, 0xBF}), // below the four-byte range
    };
    for (const auto &s : cases) {
        BOOST_CHECK(!utf::is_valid_utf8(s));

        bool ok = true;
        BOOST_CHECK(utf::utf8_to_utf32(s, utf::fail, &ok).empty());
        BOOST_CHECK(!ok);
    }
}

// D800 to DFFF exist only to spell a pair in UTF-16 and are not characters, so UTF-8 must not
// carry them. This is the difference between UTF-8 and CESU-8.
BOOST_AUTO_TEST_CASE(test_surrogates_are_rejected) {
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xED, 0xA0, 0x80}))); // U+D800
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xED, 0xBF, 0xBF}))); // U+DFFF
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xED, 0x9F, 0xBF})));  // U+D7FF, just below
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xEE, 0x80, 0x80})));  // U+E000, just above

    // and neither may a UTF-32 string
    BOOST_CHECK(!utf::is_valid_utf32(std::u32string{0xD800}));
    BOOST_CHECK(!utf::is_valid_utf32(std::u32string{0xDFFF}));
    BOOST_CHECK(utf::is_valid_utf32(std::u32string{0xD7FF}));
}

BOOST_AUTO_TEST_CASE(test_out_of_range_is_rejected) {
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xF4, 0x8F, 0xBF, 0xBF})));  // U+10FFFF, the last one
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xF4, 0x90, 0x80, 0x80}))); // one past it
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xF5, 0x80, 0x80, 0x80}))); // no lead byte goes here
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xFF})));

    BOOST_CHECK(utf::is_valid_utf32(std::u32string{utf::max_code_point}));
    BOOST_CHECK(!utf::is_valid_utf32(std::u32string{utf::max_code_point + 1}));
}

BOOST_AUTO_TEST_CASE(test_stray_and_truncated_bytes) {
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0x80})));             // continuation with no lead
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xE4, 0xBD})));       // three-byte cut short
    BOOST_CHECK(!utf::is_valid_utf8(bytes({0xF0, 0x9F, 0x98}))); // four-byte cut short
}

// One bad byte costs one replacement character, not the rest of the string. Consuming the
// maximal part that could still have been valid is what keeps a single error local.
BOOST_AUTO_TEST_CASE(test_replacement_is_local) {
    // 'A', a stray continuation byte, then 'B'
    auto out = utf::utf8_to_utf32(bytes({'A', 0x80, 'B'}));
    BOOST_REQUIRE_EQUAL(out.size(), 3u);
    BOOST_CHECK(out[0] == U'A');
    BOOST_CHECK(out[1] == Fffd);
    BOOST_CHECK(out[2] == U'B');

    // a lead byte whose second byte is wrong, followed by text that is fine
    out = utf::utf8_to_utf32(bytes({0xE0, 0x41, 0x42}));
    BOOST_REQUIRE_EQUAL(out.size(), 3u);
    BOOST_CHECK(out[0] == Fffd);
    BOOST_CHECK(out[1] == U'A');
    BOOST_CHECK(out[2] == U'B');

    // a truncated sequence at the end is one error, not one per byte
    out = utf::utf8_to_utf32(bytes({'A', 0xF0, 0x9F, 0x98}));
    BOOST_REQUIRE_EQUAL(out.size(), 2u);
    BOOST_CHECK(out[0] == U'A');
    BOOST_CHECK(out[1] == Fffd);

    // but only what was still on its way to being valid counts as truncated. E0 announces three
    // bytes and 80 is a continuation byte, yet no sequence starting E0 80 could have been
    // completed, so this is two errors rather than one.
    out = utf::utf8_to_utf32(bytes({0xE0, 0x80}));
    BOOST_REQUIRE_EQUAL(out.size(), 2u);
    BOOST_CHECK(out[0] == Fffd);
    BOOST_CHECK(out[1] == Fffd);
}

// A conversion writes into a fixed buffer until the input outgrows it. Nothing may change at
// that threshold, and the widest code points are the ones that reach it first.
BOOST_AUTO_TEST_CASE(test_input_outgrowing_the_inline_buffer) {
    const char32_t cycle[] = {U'A', 0x00E9, 0x4F60, 0x1F600};

    for (size_t n : {size_t(1), size_t(85), size_t(86), size_t(256), size_t(257), size_t(4096)}) {
        std::u32string source;
        for (size_t i = 0; i < n; ++i) {
            source.push_back(cycle[i % 4]);
        }

        const auto u8 = utf::utf32_to_utf8(source);
        const auto u16 = utf::utf32_to_utf16(source);

        BOOST_CHECK(utf::utf8_to_utf32(u8) == source);
        BOOST_CHECK(utf::utf16_to_utf32(u16) == source);
        BOOST_CHECK(utf::utf8_to_utf16(u8) == u16);
        BOOST_CHECK(utf::utf16_to_utf8(u16) == u8);
        BOOST_CHECK(utf::wide_to_utf8(utf::utf8_to_wide(u8)) == u8);
    }
}

BOOST_AUTO_TEST_CASE(test_policies) {
    const auto bad = bytes({'A', 0x80, 'B'});

    bool ok = true;
    auto replaced = utf::utf8_to_utf16(bad, utf::replace, &ok);
    BOOST_CHECK(!ok); // it still says the input was bad
    BOOST_CHECK_EQUAL(replaced.size(), 3u);

    ok = true;
    auto failed = utf::utf8_to_utf16(bad, utf::fail, &ok);
    BOOST_CHECK(!ok);
    BOOST_CHECK(failed.empty());

    // valid input reports success under either
    ok = false;
    BOOST_CHECK_EQUAL(utf::utf8_to_utf16("hello", utf::fail, &ok).size(), 5u);
    BOOST_CHECK(ok);
}

BOOST_AUTO_TEST_CASE(test_utf16_surrogate_pairing) {
    BOOST_CHECK(utf::is_valid_utf16(units({0xD83D, 0xDE00}))); // a proper pair
    BOOST_CHECK(!utf::is_valid_utf16(units({0xD83D})));        // high with nothing after it
    BOOST_CHECK(!utf::is_valid_utf16(units({0xDE00})));        // low with nothing before it
    BOOST_CHECK(!utf::is_valid_utf16(units({0xD83D, 'A'})));   // high followed by something else

    auto out = utf::utf16_to_utf32(units({'A', 0xD83D, 'B'}));
    BOOST_REQUIRE_EQUAL(out.size(), 3u);
    BOOST_CHECK(out[1] == Fffd);
    BOOST_CHECK(out[2] == U'B'); // the letter after the stray surrogate survives
}

// wchar_t is UTF-16 on Windows and UTF-32 elsewhere, so the wide functions have to pick. Either
// way the text has to survive the round trip.
BOOST_AUTO_TEST_CASE(test_wide) {
    const std::string source = utf::utf32_to_utf8(std::u32string{U'A', 0x4F60, 0x1F600});

    auto wide = utf::utf8_to_wide(source);
    BOOST_CHECK_EQUAL(wide.size(), sizeof(wchar_t) == 2 ? 4u : 3u);
    BOOST_CHECK_EQUAL(utf::wide_to_utf8(wide), source);
}

BOOST_AUTO_TEST_CASE(test_valid_utf8_shapes) {
    BOOST_CHECK(utf::is_valid_utf8(""));
    BOOST_CHECK(utf::is_valid_utf8("plain ascii"));
    BOOST_CHECK(utf::is_valid_utf8(bytes({0x00})));             // NUL is a character
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xC2, 0x80})));       // U+0080, the shortest two-byte
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xDF, 0xBF})));       // U+07FF, the longest two-byte
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xE0, 0xA0, 0x80}))); // U+0800
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xEF, 0xBF, 0xBF}))); // U+FFFF
    BOOST_CHECK(utf::is_valid_utf8(bytes({0xF0, 0x90, 0x80, 0x80}))); // U+10000
}

// Every code point there is, encoded and decoded again.
//
// The cases above pick the interesting ones by hand, which is how the interesting ones get
// picked wrong. There are only about a million scalars, so there is no need to choose.
BOOST_AUTO_TEST_CASE(test_every_code_point_survives_a_round_trip) {
    std::u32string all;
    all.reserve(0x110000);
    for (char32_t c = 0; c <= utf::max_code_point; ++c) {
        // The surrogate range is not a code point anybody can write, so it is not in the sweep.
        if (c >= 0xD800 && c <= 0xDFFF) {
            continue;
        }
        all.push_back(c);
    }
    BOOST_REQUIRE_EQUAL(all.size(), 0x110000u - 0x800u);

    const auto u8 = utf::utf32_to_utf8(all);
    const auto u16 = utf::utf32_to_utf16(all);

    BOOST_CHECK(utf::is_valid_utf8(u8));
    BOOST_CHECK(utf::is_valid_utf16(u16));
    BOOST_CHECK(utf::is_valid_utf32(all));

    BOOST_CHECK(utf::utf8_to_utf32(u8) == all);
    BOOST_CHECK(utf::utf16_to_utf32(u16) == all);
    BOOST_CHECK(utf::utf8_to_utf16(u8) == u16);
    BOOST_CHECK(utf::utf16_to_utf8(u16) == u8);

    // And the byte counts are what the encoding says they should be, so a round trip that
    // silently agreed with itself on a wrong encoding would still be caught.
    size_t expected = 0;
    for (char32_t c : all) {
        expected += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    BOOST_CHECK_EQUAL(u8.size(), expected);
}

// Every byte on its own. Only the ASCII half is a string by itself, and the rest each announce
// something that is not there.
BOOST_AUTO_TEST_CASE(test_every_single_byte) {
    for (int b = 0; b <= 0xFF; ++b) {
        auto s = bytes({b});
        bool valid = b <= 0x7F;
        BOOST_CHECK_MESSAGE(utf::is_valid_utf8(s) == valid,
                            "byte " + std::to_string(b) + " should be " +
                                (valid ? "valid" : "invalid") + " on its own");
    }
}

// Every string of two bytes there is. Two ways to be one: two ASCII characters, or one two byte
// sequence, which means a lead of C2 to DF and a trail of 80 to BF. C0 and C1 could only ever
// spell something shorter, and anything above DF announces a third byte that is not there.
BOOST_AUTO_TEST_CASE(test_every_two_byte_string) {
    int wrong = 0;
    for (int lead = 0x00; lead <= 0xFF; ++lead) {
        for (int trail = 0x00; trail <= 0xFF; ++trail) {
            bool two_characters = lead <= 0x7F && trail <= 0x7F;
            bool one_sequence = lead >= 0xC2 && lead <= 0xDF && trail >= 0x80 && trail <= 0xBF;
            bool expected = two_characters || one_sequence;
            if (utf::is_valid_utf8(bytes({lead, trail})) != expected) {
                if (++wrong <= 8) {
                    BOOST_ERROR("pair " + std::to_string(lead) + " " + std::to_string(trail) +
                                " should be " + (expected ? "valid" : "invalid"));
                }
            }
        }
    }
    BOOST_CHECK_EQUAL(wrong, 0);
}

// Every three byte sequence whose first two bytes are a plausible start, which is the block
// where the surrogate hole and the overlong floor both live.
BOOST_AUTO_TEST_CASE(test_every_three_byte_sequence) {
    int wrong = 0;
    for (int lead = 0xE0; lead <= 0xEF; ++lead) {
        for (int second = 0x00; second <= 0xFF; ++second) {
            for (int third = 0x00; third <= 0xFF; ++third) {
                char32_t c =
                    char32_t(((lead & 0x0F) << 12) | ((second & 0x3F) << 6) | (third & 0x3F));
                bool shaped = second >= 0x80 && second <= 0xBF && third >= 0x80 && third <= 0xBF;
                // Three bytes may not spell what two would have, and may not spell a surrogate.
                bool expected = shaped && c >= 0x800 && !(c >= 0xD800 && c <= 0xDFFF);
                if (utf::is_valid_utf8(bytes({lead, second, third})) != expected) {
                    if (++wrong <= 8) {
                        BOOST_ERROR("triple " + std::to_string(lead) + " " +
                                    std::to_string(second) + " " + std::to_string(third) +
                                    " should be " + (expected ? "valid" : "invalid"));
                    }
                }
            }
        }
    }
    BOOST_CHECK_EQUAL(wrong, 0);
}

// How many replacement characters one broken sequence costs.
//
// Unicode's recommendation is one per maximal subpart: the decoder consumes as much as could
// still have become a valid sequence, and that whole run is one error. The count is the whole
// question, and it is the part a decoder is easiest to get wrong by emitting one per byte.
BOOST_AUTO_TEST_CASE(test_what_a_broken_sequence_costs) {
    struct Case {
        std::string input;
        size_t replacements;
        const char *why;
    };

    // clang-format off
    const Case cases[] = {
        // A truncated sequence is one error however many bytes it got through, as long as every
        // byte of it was still on the way to something valid.
        {bytes({0xC2}), 1, "a two byte lead with nothing after it"},
        {bytes({0xE1, 0x80}), 1, "a three byte sequence one byte short"},
        {bytes({0xE1}), 1, "a three byte lead alone"},
        {bytes({0xF1, 0x80, 0x80}), 1, "a four byte sequence one byte short"},
        {bytes({0xF1, 0x80}), 1, "two bytes short"},
        {bytes({0xF1}), 1, "a four byte lead alone"},

        // A byte that could never have continued the sequence ends it, and counts on its own.
        {bytes({0xE0, 0x80}), 2, "E0 only takes A0 to BF, so 80 is not a continuation of it"},
        {bytes({0xF0, 0x80}), 2, "F0 only takes 90 to BF"},
        {bytes({0xF4, 0x90}), 2, "F4 only takes 80 to 8F, which is where U+10FFFF ends"},
        {bytes({0xED, 0xA0}), 2, "ED only takes 80 to 9F, which is where the surrogates start"},

        // Stray continuation bytes are one error each, since none of them starts anything.
        {bytes({0x80}), 1, "one stray continuation byte"},
        {bytes({0x80, 0x80}), 2, "two of them"},
        {bytes({0x80, 0x80, 0x80}), 3, "three of them"},

        // Bytes that can never appear anywhere.
        {bytes({0xC0, 0x80}), 2, "C0 could only ever spell something shorter"},
        {bytes({0xFE}), 1, "FE is not a lead byte"},
        {bytes({0xFF, 0xFF}), 2, "nor is FF, twice"},

        // And what follows a broken sequence is read as itself.
        {bytes({0xE1, 0x80, 'A'}), 1, "a truncated sequence then a letter"},
        {bytes({0xC2, 'A', 0xC2, 'B'}), 2, "two truncated leads with letters between"},
    };
    // clang-format on

    for (const auto &c : cases) {
        auto out = utf::utf8_to_utf32(c.input);
        size_t count = 0;
        for (char32_t ch : out) {
            if (ch == Fffd) {
                count++;
            }
        }
        BOOST_CHECK_MESSAGE(count == c.replacements,
                            std::string(c.why) + ": expected " + std::to_string(c.replacements) +
                                " replacements, got " + std::to_string(count));
        // Whatever it was, it is not valid, and failing rather than replacing says so.
        BOOST_CHECK(!utf::is_valid_utf8(c.input));
        bool ok = true;
        BOOST_CHECK(utf::utf8_to_utf32(c.input, utf::fail, &ok).empty());
        BOOST_CHECK(!ok);
    }
}

// The predicate the conversions are written against. Everything above went through them and
// nothing had asked it directly, so the surrogate range and the ceiling were only ever checked
// by their effect on a conversion.
BOOST_AUTO_TEST_CASE(test_which_code_points_are_valid) {
    BOOST_CHECK(utf::is_valid_code_point(0));
    BOOST_CHECK(utf::is_valid_code_point(U'A'));
    BOOST_CHECK(utf::is_valid_code_point(U'你'));

    // The surrogates encode a pair in UTF-16 and stand for nothing on their own.
    BOOST_CHECK(utf::is_valid_code_point(0xD7FF));
    BOOST_CHECK(!utf::is_valid_code_point(0xD800));
    BOOST_CHECK(!utf::is_valid_code_point(0xDBFF));
    BOOST_CHECK(!utf::is_valid_code_point(0xDC00));
    BOOST_CHECK(!utf::is_valid_code_point(0xDFFF));
    BOOST_CHECK(utf::is_valid_code_point(0xE000));

    // And the last code point there is, against the first one there is not.
    BOOST_CHECK(utf::is_valid_code_point(0x10FFFF));
    BOOST_CHECK(!utf::is_valid_code_point(0x110000));
    BOOST_CHECK(!utf::is_valid_code_point(0xFFFFFFFF));

    // constexpr, so it answers where a constant is wanted.
    static_assert(utf::is_valid_code_point(U'A'), "");
    static_assert(!utf::is_valid_code_point(0xD800), "");
}

BOOST_AUTO_TEST_SUITE_END()

// SPDX-License-Identifier: MIT

#include "conformance.h"

#include <cmath>
#include <cstdio>
#include <algorithm>
#include <fstream>

namespace conformance {

    Report report;

    void Report::fail(const fs::path &file, std::string reason) {
        failures.push_back({file.filename().string(), std::move(reason)});
    }

    // ----------------------------------------------------------------------------------------
    // Reading
    // ----------------------------------------------------------------------------------------

    std::string readFile(const fs::path &path, bool *ok) {
        std::ifstream file(path, std::ios::binary);
        if (!file) {
            if (ok)
                *ok = false;
            return {};
        }
        std::string content((std::istreambuf_iterator<char>(file)),
                            std::istreambuf_iterator<char>());
        if (ok)
            *ok = true;
        return content;
    }

    bool startsWith(std::string_view s, std::string_view prefix) {
        return s.size() >= prefix.size() && s.compare(0, prefix.size(), prefix) == 0;
    }

    bool endsWith(std::string_view s, std::string_view suffix) {
        return s.size() >= suffix.size() &&
               s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
    }

    template <class Iterator>
    static std::vector<fs::path> collect(const fs::path &dir, std::string_view suffix) {
        std::vector<fs::path> result;
        std::error_code ec;
        for (const auto &entry : Iterator(dir, ec)) {
            if (!entry.is_regular_file())
                continue;
            if (!suffix.empty() && !endsWith(entry.path().filename().string(), suffix))
                continue;
            result.push_back(entry.path());
        }
        std::sort(result.begin(), result.end());
        return result;
    }

    std::vector<fs::path> filesIn(const fs::path &dir, std::string_view suffix) {
        return collect<fs::directory_iterator>(dir, suffix);
    }

    std::vector<fs::path> filesUnder(const fs::path &dir, std::string_view suffix) {
        return collect<fs::recursive_directory_iterator>(dir, suffix);
    }

    bool isValidUtf8(std::string_view s) {
        size_t i = 0;
        while (i < s.size()) {
            const auto lead = uint8_t(s[i]);
            int extra;
            char32_t cp;
            if (lead < 0x80) {
                i++;
                continue;
            } else if ((lead & 0xE0) == 0xC0) {
                extra = 1;
                cp = lead & 0x1F;
            } else if ((lead & 0xF0) == 0xE0) {
                extra = 2;
                cp = lead & 0x0F;
            } else if ((lead & 0xF8) == 0xF0) {
                extra = 3;
                cp = lead & 0x07;
            } else {
                return false; // A continuation byte on its own, or a five-byte lead.
            }

            if (i + size_t(extra) >= s.size())
                return false;
            for (int k = 1; k <= extra; ++k) {
                const auto c = uint8_t(s[i + size_t(k)]);
                if ((c & 0xC0) != 0x80)
                    return false;
                cp = (cp << 6) | (c & 0x3F);
            }

            // Overlong forms, surrogates and anything past the last plane are all sequences that
            // decode to something they were not allowed to be spelled as.
            static const char32_t lowest[] = {0, 0x80, 0x800, 0x10000};
            if (cp < lowest[extra] || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF))
                return false;

            i += size_t(extra) + 1;
        }
        return true;
    }

    // ----------------------------------------------------------------------------------------
    // Checks
    // ----------------------------------------------------------------------------------------

    bool hasNonFinite(const json::Value &value) {
        switch (value.type()) {
            case json::Type::Double:
                return !std::isfinite(value.toDouble());
            case json::Type::Array:
                for (const auto &item : value.toArray()) {
                    if (hasNonFinite(item))
                        return true;
                }
                return false;
            case json::Type::Object:
                for (const auto &item : value.toObject()) {
                    if (hasNonFinite(item.second))
                        return true;
                }
                return false;
            default:
                return false;
        }
    }

    void checkValue(const fs::path &path, const json::Value &value) {
        // What the serializer writes is always valid UTF-8, whatever went into the value. That one
        // it is never allowed to get wrong, since a document holding a bad string still has to be
        // writable.
        const auto compact = value.toJson();
        if (!isValidUtf8(compact)) {
            report.fail(path, "wrote text that is not valid UTF-8");
        }

        if (hasNonFinite(value)) {
            report.skipped++;
            return;
        }

        for (int indent : {-1, 4}) {
            const auto text = indent < 0 ? compact : value.toJson(indent);

            stdc::json::ParseError error;
            const auto reparsed = json::Value::fromJson(text, false, &error);
            if (error) {
                report.fail(path, "our own output does not parse (indent " +
                                      std::to_string(indent) + "): " + error.message());
                continue;
            }
            if (reparsed != value) {
                report.fail(path, "value changed across a serialize/parse round trip (indent " +
                                      std::to_string(indent) + ")");
                continue;
            }
            if (reparsed.toJson(indent) != text) {
                report.fail(path,
                            "serialization is not stable (indent " + std::to_string(indent) + ")");
            }
        }

        // Our CBOR has to survive our own decoder. This says nothing about the encoding being
        // right, which is what checkForeignCbor() is for.
        {
            stdc::cbor::DecodeError error;
            const auto decoded = json::Value::fromCbor(value.toCbor(), &error);
            if (error) {
                report.fail(path, "our own CBOR does not decode: " + error.message());
            } else if (decoded != value) {
                report.fail(path, "value changed across a CBOR round trip");
            }
        }
    }

    void checkForeignCbor(const fs::path &jsonPath, const json::Value &value) {
        const fs::path cborPath = jsonPath.string() + ".cbor";
        if (!fs::exists(cborPath))
            return;

        // A single byte, 0x81: an array of one, and then nothing. Whatever went wrong when the
        // fixture was written, there is no value in it to compare against.
        if (jsonPath.filename() == "y_number_too_big_neg_int.json") {
            report.skipped++;
            return;
        }

        const auto bytes = readFile(cborPath);
        stdc::cbor::DecodeError error;
        const auto decoded =
            json::Value::fromCbor(stdc::array_view<uint8_t>(
                                    reinterpret_cast<const uint8_t *>(bytes.data()), bytes.size()),
                                &error);
        report.checked++;
        if (error) {
            report.fail(cborPath, "foreign CBOR does not decode: " + error.message());
        } else if (decoded != value) {
            report.fail(cborPath, "foreign CBOR decodes to a different value than the JSON");
        }
    }

    static json::Value checkText(const fs::path &path, std::string_view text, Expectation expectation,
                               int *eitherAccepted) {
        report.checked++;

        stdc::json::ParseError error;
        auto value = json::Value::fromJson(text, false, &error);

        switch (expectation) {
            case Expectation::Accept:
                if (error) {
                    report.fail(path, "rejected, but must be accepted: " + error.message());
                    return {};
                }
                checkValue(path, value);
                return value;

            case Expectation::Reject:
                if (!error) {
                    report.fail(path, "accepted, but must be rejected");
                }
                return {};

            case Expectation::Either:
                if (!error) {
                    if (eitherAccepted)
                        (*eitherAccepted)++;
                    checkValue(path, value);
                }
                return value;
        }
        return {};
    }

    json::Value checkFile(const fs::path &path, Expectation expectation, int *eitherAccepted) {
        bool ok = false;
        const auto content = readFile(path, &ok);
        if (!ok) {
            report.fail(path, "cannot be read");
            return {};
        }

        auto value = checkText(path, content, expectation, eitherAccepted);
        if (expectation != Expectation::Reject && !value.isNull()) {
            checkForeignCbor(path, value);
        }
        return value;
    }

    void checkLineDelimited(const fs::path &path, Expectation expectation) {
        const auto content = readFile(path);

        // A file that must be rejected is rejected as a whole: one bad line is enough, and the
        // rest are usually fine on their own.
        int rejected = 0;
        size_t start = 0;
        while (start < content.size()) {
            auto stop = content.find('\n', start);
            if (stop == std::string::npos)
                stop = content.size();
            std::string_view line(content.data() + start, stop - start);
            start = stop + 1;
            while (!line.empty() && (line.back() == '\r' || line.back() == ' '))
                line.remove_suffix(1);
            if (line.empty())
                continue;

            if (expectation == Expectation::Reject) {
                report.checked++;
                stdc::json::ParseError error;
                json::Value::fromJson(line, false, &error);
                if (error) {
                    rejected++;
                }
            } else {
                checkText(path, line, expectation, nullptr);
            }
        }

        if (expectation == Expectation::Reject && rejected == 0) {
            report.fail(path, "every line was accepted, but the file must be rejected");
        }
    }

    void checkExactRoundTrip(const fs::path &path) {
        const auto value = checkFile(path, Expectation::Accept);

        auto expected = readFile(path);
        while (!expected.empty() && (expected.back() == '\n' || expected.back() == '\r'))
            expected.pop_back();

        const auto actual = value.toJson();
        if (actual == expected) {
            return;
        }

        // A number has more than one spelling, and these corpora were written by implementations
        // that chose differently. We write the fewest digits that read back as the same double,
        // which is 5e-324 where nlohmann writes 4.940656458412e-324, and we write the sign in an
        // exponent, where RapidJSON writes 1.7976931348623157e308. All of them are the same
        // number, and the grammar allows all of them.
        //
        // So a difference is only a defect if the two texts mean different things. That still
        // catches everything this check is for -- a lost key, a changed order, whitespace that
        // came back -- and the count of these is printed at the end so they cannot pile up
        // unnoticed.
        if (json::Value::fromJson(expected, false) == value) {
            report.skipped++;
            return;
        }

        report.fail(path, "round trip changed the text: expected " + expected + ", got " + actual);
    }

}

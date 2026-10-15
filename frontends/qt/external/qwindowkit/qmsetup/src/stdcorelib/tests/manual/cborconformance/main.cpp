// SPDX-License-Identifier: MIT

// A conformance run of json::Value's CBOR against the IETF working group's test vectors.
//
// Two corpora, neither part of this repository:
//
//     cd .cache
//     git clone git@github.com:cbor-wg/cbor-test-vectors.git
//     git clone git@github.com:cbor/test-vectors.git cbor-test-vectors-legacy
//     test_cborconformance .cache
//
// A vendor whose directory is not there is skipped, so either alone works. To put one somewhere
// else: test_cborconformance cbor-wg=/path/to/cbor-test-vectors
//
// Each vendor below records the commit its expectations were written against.
//
// What this can and cannot say
// ----------------------------
//
// Our CBOR is not a general CBOR implementation and is not meant to be. It exists so that a
// json::Value can be written in a binary form and read back, so it carries exactly what a json::Value
// can hold. CBOR can hold more, and a conformance suite is written for all of it.
//
// So a vector is not simply passed or failed. It is passed, or it lands outside what a json::Value
// can represent, and those two are counted apart. The second number is the interesting one: it is
// this implementation's boundary, written down, and the run prints what put each vector there.
// What must never appear is the third number -- a well-formed item we refuse for a reason that is
// not on that list, an ill-formed one we accept, or two encodings of one item that we read as two
// different things.

#include <cmath>
#include <cstdio>
#include <cstring>
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <map>
#include <string>
#include <vector>

#include <stdcorelib/support/json.h>

#include "vectors.h"

namespace fs = std::filesystem;

namespace json = stdc::json;
namespace cbor = stdc::cbor;

namespace {

    struct Failure {
        std::string where;
        std::string reason;
    };

    struct Report {
        int passed = 0;
        std::vector<Failure> failures;

        /// Vectors that ask for something a json::Value cannot hold, by what it was.
        std::map<std::string, int> outside;

        void fail(const std::string &where, std::string reason) {
            failures.push_back({where, std::move(reason)});
        }
        int total() const {
            int n = passed + int(failures.size());
            for (const auto &item : outside) {
                n += item.second;
            }
            return n;
        }
    };

    Report report;

    std::string readFile(const fs::path &path, bool *ok = nullptr) {
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

    std::vector<fs::path> filesUnder(const fs::path &dir, std::string_view suffix) {
        std::vector<fs::path> result;
        std::error_code ec;
        for (const auto &entry : fs::recursive_directory_iterator(dir, ec)) {
            if (!entry.is_regular_file())
                continue;
            const auto name = entry.path().filename().string();
            if (name.size() < suffix.size() ||
                name.compare(name.size() - suffix.size(), suffix.size(), suffix) != 0)
                continue;
            result.push_back(entry.path());
        }
        std::sort(result.begin(), result.end());
        return result;
    }

    vectors::Bytes view(const std::vector<uint8_t> &bytes) {
        return vectors::Bytes(bytes.data(), bytes.size());
    }

    // ----------------------------------------------------------------------------------------
    // Where our CBOR stops
    // ----------------------------------------------------------------------------------------

    /// The refusals that are this implementation's shape rather than a defect. Each is something
    /// a json::Value has no room for, so the decoder turns it away on purpose.
    ///
    /// Matching on the message is coarse, but the alternative is an error code enumeration on a
    /// decoder that has one caller, and these strings are the decoder's own.
    const char *outsideOurTypes(const std::string &error) {
        struct Known {
            const char *fragment;
            const char *what;
        };
        static const Known known[] = {
            {"tags are not supported",            "a tag"                                       },
            {"a map key has to be a text string", "a map key that is not text"                  },
            {"negative integer is out of range",  "an integer below INT64_MIN"                  },
            {"unsupported initial byte",          "a simple value that is not null or a boolean"},
        };
        for (const auto &entry : known) {
            if (error.find(entry.fragment) != std::string::npos) {
                return entry.what;
            }
        }
        return nullptr;
    }

    /// The other half of the boundary: items we read, but cannot write back the way they came.
    ///
    /// A json::Value holds one kind of number besides the exact integers, so a half or single float
    /// widens to a double and is written back as one, and an unsigned integer above INT64_MAX
    /// becomes a double and loses its low bits. Both are stated in JSON.h. CBOR's undefined is a
    /// third: the type had an Undefined once and it was taken out, so it reads as null and is
    /// written back as null. None of the three is reachable from JSON.
    const char *outsideOurEncoding(const std::vector<uint8_t> &encoded, const json::Value &value) {
        if (encoded.size() == 1 && encoded.front() == 0xF7) {
            return "undefined, which this type does not have";
        }
        if (encoded.empty() || !value.isDouble()) {
            return nullptr;
        }
        const auto initial = encoded.front();
        if (initial == 0xF9 || initial == 0xFA) {
            return "a float narrower than a double";
        }
        if ((initial >> 5) <= 1) {
            return "an integer above INT64_MAX";
        }
        return nullptr;
    }

    /// Equality, except that a NaN equals a NaN.
    ///
    /// json::Value compares its doubles numerically, so a NaN is not equal to itself -- which is
    /// what IEEE says and what every JSON library does. It is not what these vectors are asking
    /// about, though. When a file says that f97e00 and fa7fc00000 are the same item, the question
    /// is whether the decoder read both as a NaN, not whether two NaNs are interchangeable.
    bool sameValue(const json::Value &a, const json::Value &b) {
        if (a.isDouble() && b.isDouble()) {
            const auto x = a.toDouble(), y = b.toDouble();
            if (std::isnan(x) || std::isnan(y)) {
                return std::isnan(x) && std::isnan(y);
            }
        }
        if (a.isArray() && b.isArray()) {
            const auto &left = a.toArray();
            const auto &right = b.toArray();
            if (left.size() != right.size()) {
                return false;
            }
            for (size_t i = 0; i < left.size(); ++i) {
                if (!sameValue(left[i], right[i]))
                    return false;
            }
            return true;
        }
        if (a.isObject() && b.isObject()) {
            const auto &left = a.toObject();
            const auto &right = b.toObject();
            if (left.size() != right.size()) {
                return false;
            }
            auto i = left.begin();
            auto j = right.begin();
            for (; i != left.end(); ++i, ++j) {
                if (i->first != j->first || !sameValue(i->second, j->second))
                    return false;
            }
            return true;
        }
        return a == b;
    }

    void outside(const char *what) {
        report.outside[what]++;
    }

    // ----------------------------------------------------------------------------------------
    // One vector
    // ----------------------------------------------------------------------------------------

    /// \param where How to name this vector if it fails.
    void checkVector(const std::string &where, const vectors::Vector &test) {
        if (!test.hasEncoded) {
            // A vector that only says what an item decodes to, with no bytes to decode. There is
            // nothing here to hand a decoder.
            outside("no encoded form given");
            return;
        }

        stdc::cbor::DecodeError encodedError;
        const auto fromEncoded = json::Value::fromCbor(view(test.encoded), &encodedError);

        if (test.fail) {
            if (!encodedError) {
                report.fail(where, "accepted " + vectors::toHex(view(test.encoded)) +
                                       ", which is not well formed");
            } else {
                report.passed++;
            }
            return;
        }

        if (encodedError) {
            if (const auto *what = outsideOurTypes(encodedError.what)) {
                outside(what);
            } else {
                report.fail(where, "rejected " + vectors::toHex(view(test.encoded)) + ": " +
                                       encodedError.message());
            }
            return;
        }

        // The file writes the same item a second time, in preferred form. Both spellings have to
        // reach us as the same value -- that is the whole of what a decoder is for.
        if (test.hasDecoded) {
            stdc::cbor::DecodeError decodedError;
            const auto fromDecoded = json::Value::fromCbor(view(test.decoded), &decodedError);
            if (decodedError) {
                if (const auto *what = outsideOurTypes(decodedError.what)) {
                    // The preferred form uses something we do not carry, but the encoded form did
                    // not. Nothing to compare against, and no claim either way.
                    outside(what);
                    return;
                }
                report.fail(where, "read the encoded form but not the decoded one: " +
                                       decodedError.message());
                return;
            }
            if (!sameValue(fromEncoded, fromDecoded)) {
                report.fail(where, "read " + vectors::toHex(view(test.encoded)) + " and " +
                                       vectors::toHex(view(test.decoded)) + " as different values");
                return;
            }
        }

        if (test.roundtrip) {
            const auto reencoded = json::Value(fromEncoded).toCbor();
            if (reencoded != test.encoded) {
                if (const auto *what = outsideOurEncoding(test.encoded, fromEncoded)) {
                    outside(what);
                    return;
                }
                report.fail(where, "re-encoded " + vectors::toHex(view(test.encoded)) + " as " +
                                       vectors::toHex(view(reencoded)));
                return;
            }
        }

        report.passed++;
    }

    // ----------------------------------------------------------------------------------------
    // cbor-wg/cbor-test-vectors
    // ----------------------------------------------------------------------------------------

    /// https://github.com/cbor-wg/cbor-test-vectors, at 7e84843b (2026-01-25).
    ///
    /// The working group's own vectors. Every test file is a CBOR document holding its own tests,
    /// which is why Vectors.cpp reads them by hand rather than through the decoder under test.
    void runCborWg(const fs::path &root) {
        for (const auto &path : filesUnder(root / "tests", ".cbor")) {
            const auto bytes = readFile(path);
            const auto name =
                path.parent_path().filename().string() + "/" + path.filename().string();

            vectors::File file;
            std::string error;
            if (!vectors::readFile(
                    vectors::Bytes(reinterpret_cast<const uint8_t *>(bytes.data()), bytes.size()),
                    &file, &error)) {
                report.fail(name, "the test file itself could not be read: " + error);
                continue;
            }

            const int before = report.total();
            const auto failuresBefore = report.failures.size();
            for (size_t i = 0; i < file.tests.size(); ++i) {
                checkVector(name + " #" + std::to_string(i + 1) + " " + file.tests[i].description,
                            file.tests[i]);
            }
            std::printf(
                "  %-34s %-46s %s\n", name.c_str(),
                (file.title + ": " + std::to_string(file.tests.size()) + " vectors").c_str(),
                report.failures.size() == failuresBefore
                    ? "ok"
                    : (std::to_string(report.failures.size() - failuresBefore) + " FAILED")
                          .c_str());
            (void) before;
        }
    }

    // ----------------------------------------------------------------------------------------
    // cbor/test-vectors
    // ----------------------------------------------------------------------------------------

    /// https://github.com/cbor/test-vectors, at aba89b65 (2014-01-21).
    ///
    /// RFC 7049's appendix A as a JSON array: a hex encoding, whether a generic encoder would
    /// write it back the same way, and -- where the item can be said in JSON -- what it decodes
    /// to. That last field is what makes this one worth keeping after the newer repository: the
    /// expectation is stated in a different format by a different author, so agreeing with it is
    /// not agreeing with ourselves.
    void runCborLegacy(const fs::path &root) {
        const auto path = root / "appendix_a.json";
        if (!fs::exists(path)) {
            return;
        }

        stdc::json::ParseError error;
        const auto document = json::Value::fromJson(readFile(path), false, &error);
        if (error) {
            report.fail("appendix_a.json", "could not be read: " + error.message());
            return;
        }

        const auto failuresBefore = report.failures.size();
        const auto &items = document.toArray();
        for (size_t i = 0; i < items.size(); ++i) {
            const auto &item = items[i];
            const auto where =
                "appendix_a.json #" + std::to_string(i + 1) + " " + item["hex"].toString();

            vectors::Vector test;
            if (!vectors::fromHex(item["hex"].toString(), &test.encoded)) {
                report.fail(where, "the hex field is not hex");
                continue;
            }
            test.hasEncoded = true;
            test.roundtrip = item["roundtrip"].toBool();

            // "decoded" is absent where the item has no JSON form -- a byte string, a tag, a
            // date. Those entries carry a "diagnostic" string instead, which needs a diagnostic
            // notation printer we do not have, so all that is checked there is the decoding.
            if (item.toObject().count("decoded")) {
                test.decoded = json::Value(item["decoded"]).toCbor();
                test.hasDecoded = true;
            }

            checkVector(where, test);
        }

        std::printf(
            "  %-34s %-46s %s\n", "appendix_a.json",
            ("RFC 7049 appendix A: " + std::to_string(items.size()) + " vectors").c_str(),
            report.failures.size() == failuresBefore
                ? "ok"
                : (std::to_string(report.failures.size() - failuresBefore) + " FAILED").c_str());
    }

    // ----------------------------------------------------------------------------------------
    // The table
    // ----------------------------------------------------------------------------------------

    struct Vendor {
        const char *key;
        const char *directory;
        const char *repository;
        const char *commit;
        void (*run)(const fs::path &root);
    };

    // clang-format off
    const Vendor vendors[] = {
        {"cbor-wg", "cbor-test-vectors", "https://github.com/cbor-wg/cbor-test-vectors",
         "7e84843b", runCborWg},
        {"cbor-legacy", "cbor-test-vectors-legacy", "https://github.com/cbor/test-vectors",
         "aba89b65", runCborLegacy},
    };
    // clang-format on

    void runVendor(const Vendor &vendor, const fs::path &root) {
        std::printf("\n%s  %s @ %s\n", vendor.key, vendor.repository, vendor.commit);
        std::printf("%s\n", std::string(96, '-').c_str());
        vendor.run(root);
    }

    void usage(const char *program) {
        std::fprintf(stderr,
                     "usage: %s <directory-holding-the-clones>\n"
                     "       %s <vendor>=<path> ...\n\nvendors:\n",
                     program, program);
        for (const auto &vendor : vendors) {
            std::fprintf(stderr, "  %-12s %-26s %s @ %s\n", vendor.key, vendor.directory,
                         vendor.repository, vendor.commit);
        }
    }

}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        usage(argv[0]);
        return 2;
    }

    int ran = 0;
    for (int i = 1; i < argc; ++i) {
        const std::string argument = argv[i];
        const auto split = argument.find('=');

        if (split != std::string::npos) {
            const auto key = argument.substr(0, split);
            const Vendor *found = nullptr;
            for (const auto &vendor : vendors) {
                if (key == vendor.key)
                    found = &vendor;
            }
            if (!found) {
                std::fprintf(stderr, "no vendor called %s\n", key.c_str());
                usage(argv[0]);
                return 2;
            }
            const fs::path root = argument.substr(split + 1);
            if (!fs::is_directory(root)) {
                std::fprintf(stderr, "%s is not a directory\n", root.string().c_str());
                return 2;
            }
            runVendor(*found, root);
            ran++;
            continue;
        }

        const fs::path parent = argument;
        if (!fs::is_directory(parent)) {
            std::fprintf(stderr, "%s is not a directory\n", argument.c_str());
            return 2;
        }
        for (const auto &vendor : vendors) {
            const auto root = parent / vendor.directory;
            if (fs::is_directory(root)) {
                runVendor(vendor, root);
                ran++;
            }
        }
    }

    if (ran == 0) {
        std::fprintf(stderr, "\nfound no corpus to run\n");
        usage(argv[0]);
        return 2;
    }

    int beyond = 0;
    for (const auto &item : report.outside) {
        beyond += item.second;
    }

    std::printf("\n%d vectors: %d passed, %d outside what a json::Value holds, %zu failed\n",
                report.total(), report.passed, beyond, report.failures.size());

    if (beyond) {
        std::printf("\noutside what a json::Value holds:\n");
        for (const auto &item : report.outside) {
            std::printf("  %5d  %s\n", item.second, item.first.c_str());
        }
    }

    if (!report.failures.empty()) {
        std::printf("\nfailures:\n");
        for (const auto &failure : report.failures) {
            std::printf("  %s\n    %s\n", failure.where.c_str(), failure.reason.c_str());
        }
        return 1;
    }
    return 0;
}

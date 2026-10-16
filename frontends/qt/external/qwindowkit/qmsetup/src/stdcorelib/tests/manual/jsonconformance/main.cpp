// SPDX-License-Identifier: MIT

// A conformance run of stdc::json::Value against corpora written by other implementations.
//
// Four of them, none part of this repository. Clone the ones you want beside each other and point
// this program at the directory holding them:
//
//     cd .cache
//     git clone https://github.com/nlohmann/json_test_data
//     git clone https://github.com/nst/JSONTestSuite
//     git clone https://github.com/miloyip/nativejson-benchmark
//     git clone https://github.com/simdjson/simdjson-data
//     test_jsonconformance .cache
//
// A vendor whose directory is not there is skipped, so any subset works. To put one somewhere
// else, or to run one alone, name it: test_jsonconformance nst=/path/to/JSONTestSuite
//
// Each vendor below records the commit its expectations were written against. The suites are
// stable, but the files a corpus ships are not promised to be, and a run that starts failing
// after a pull should be read against that commit before it is read as a defect here.
//
// All four together are about a minute and a half in a debug build, most of it simdjson's larger
// samples -- every accepted document is parsed and serialized several times over.
//
// What every accepted document is put through is in Conformance.cpp. The short version: it has to
// parse, its serialization has to parse back to an equal value, serializing that has to give the
// same text, its CBOR has to decode to itself, and what we write is always valid UTF-8. Where a
// corpus ships a CBOR encoding beside the JSON, that has to decode to the value we parsed -- the
// only evidence in here that our encoding agrees with anyone else's.

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "conformance.h"

using namespace conformance;

namespace {

    void heading(const char *label, const std::string &detail, int failures) {
        const std::string verdict = failures ? std::to_string(failures) + " FAILED" : "ok";
        std::printf("  %-30s %-52s %s\n", label, detail.c_str(), verdict.c_str());
    }

    std::string counted(int n, const char *noun) {
        return std::to_string(n) + " " + noun + (n == 1 ? "" : "s");
    }

    // ----------------------------------------------------------------------------------------
    // Suites that more than one vendor ships
    // ----------------------------------------------------------------------------------------

    /// JSONTestSuite's layout, which three of the four corpora carry a copy of. The prefix on each
    /// filename says what is expected: y_ must parse, n_ must not, i_ is left to us.
    void runMinefield(const fs::path &dir, const char *label) {
        if (!fs::is_directory(dir)) {
            return;
        }

        const auto mark = report.mark();
        int accept = 0, reject = 0, either = 0, eitherAccepted = 0;
        for (const auto &path : filesIn(dir, ".json")) {
            const auto name = path.filename().string();
            if (name == "y_string_utf16.json") {
                // UTF-16LE with a byte order mark. The first round of the suite called this a
                // must-accept; the second reclassified it, since RFC 8259 says the text of an
                // exchanged document is UTF-8. We read UTF-8.
                checkFile(path, Expectation::Either, &eitherAccepted);
                either++;
            } else if (startsWith(name, "y_")) {
                checkFile(path, Expectation::Accept);
                accept++;
            } else if (startsWith(name, "n_")) {
                checkFile(path, Expectation::Reject);
                reject++;
            } else if (startsWith(name, "i_")) {
                checkFile(path, Expectation::Either, &eitherAccepted);
                either++;
            }
        }

        heading(label,
                counted(accept, "must-accept") + ", " + counted(reject, "must-reject") + ", " +
                    std::to_string(either) + " free (" + std::to_string(eitherAccepted) +
                    " accepted)",
                report.since(mark));
    }

    /// The JSON_checker suite from json.org, which three of the four also carry. Its pass/fail
    /// split predates RFC 8259 in two places.
    ///
    /// Where a corpus has already noticed that, it renames the file with an _EXCLUDE suffix, and
    /// those documents are not merely allowed but required to parse. Where it has not, the two
    /// are named here.
    void runJsonChecker(const fs::path &dir, const char *label) {
        if (!fs::is_directory(dir)) {
            return;
        }

        const auto mark = report.mark();
        int count = 0;
        for (const auto &path : filesIn(dir, ".json")) {
            const auto name = path.filename().string();
            count++;

            if (startsWith(name, "pass")) {
                checkFile(path, Expectation::Accept);
            } else if (name.find("_EXCLUDE") != std::string::npos) {
                // fail01: a bare string at the top level, which RFC 8259 allows and the suite,
                //         written against RFC 4627, does not.
                // fail18: nineteen nested arrays, called too deep. Every parser draws that line
                //         somewhere; ours is at 512.
                // fail39: a repeated key, which the grammar allows and says nothing about.
                checkFile(path, Expectation::Accept);
            } else if (name == "fail60.json" || name == "fail73.json") {
                // [1e+1111] and a number with 308 zeroes: both overflow to infinity. simdjson
                // turns those away, and JSONTestSuite's y_number_real_pos_overflow.json requires
                // that they be accepted. The two corpora contradict each other, so the grammar
                // decides -- it puts no ceiling on a number -- and we take them, as a double that
                // is an infinity. Serializing writes null, which is where that ends.
                checkFile(path, Expectation::Either);
            } else if (name == "fail41_toolarge.json") {
                // 2^64 written out. The grammar has no upper bound on a number, so what an
                // implementation does past its integer range is its own business. Ours becomes a
                // double and loses the low bits, which is what the header says it does.
                checkFile(path, Expectation::Either);
            } else if (name == "fail1.json" || name == "fail18.json") {
                // The same two, in the copy that has not renamed them.
                checkFile(path, Expectation::Accept);
            } else if (startsWith(name, "fail")) {
                checkFile(path, Expectation::Reject);
            } else {
                count--;
            }
        }

        heading(label, counted(count, "document"), report.since(mark));
    }

    /// Documents that simply have to parse, through every directory below.
    void runAcceptAll(const fs::path &dir, const char *label) {
        if (!fs::is_directory(dir)) {
            return;
        }

        const auto mark = report.mark();
        int count = 0, lines = 0;
        for (const auto &path : filesUnder(dir)) {
            const auto name = path.filename().string();
            if (endsWith(name, ".json")) {
                checkFile(path, Expectation::Accept);
                count++;
            } else if (endsWith(name, ".ndjson")) {
                // One document per line. Not JSON, but it is how the larger samples ship.
                checkLineDelimited(path, startsWith(name, "fail") ? Expectation::Reject
                                                                  : Expectation::Accept);
                lines++;
            }
        }

        heading(label,
                counted(count, "document") + (lines ? ", " + counted(lines, "line file") : ""),
                report.since(mark));
    }

    /// A corpus kept from a crash, not from a disagreement. The documents are mangled and none of
    /// them is JSON -- of simdjson's 1457, not one has balanced brackets -- so the requirement is
    /// that the parser says so rather than reading past the end of the buffer or running out of
    /// stack. Expect nothing here to parse; that it all gets turned away is the point.
    void runMustNotCrash(const fs::path &dir, const char *label) {
        if (!fs::is_directory(dir)) {
            return;
        }

        const auto mark = report.mark();
        int count = 0, accepted = 0;
        for (const auto &path : filesUnder(dir, ".json")) {
            checkFile(path, Expectation::Either, &accepted);
            count++;
        }
        heading(label,
                counted(count, "input") + ", " + std::to_string(accepted) + " parsed, none crashed",
                report.since(mark));
    }

    /// Documents already written the way we write them, so the text has to survive unchanged.
    void runRoundTrip(const fs::path &dir, const char *label) {
        if (!fs::is_directory(dir)) {
            return;
        }

        const auto mark = report.mark();
        int count = 0;
        for (const auto &path : filesIn(dir, ".json")) {
            checkExactRoundTrip(path);
            count++;
        }
        heading(label, counted(count, "document"), report.since(mark));
    }

    // ----------------------------------------------------------------------------------------
    // nlohmann/json_test_data
    // ----------------------------------------------------------------------------------------

    /// Markus Kuhn's UTF-8 decoder stress file, a line at a time, each line wrapped as a JSON
    /// string.
    ///
    /// A line that is valid UTF-8 has to come back as itself. A line that is not has to be
    /// rejected. Both directions are judged by the validator in Conformance.cpp rather than the
    /// one the parser calls, so the two are free to disagree.
    void runUtf8Stress(const fs::path &dir) {
        const auto path = dir / "UTF-8-test.txt";
        if (!fs::exists(path)) {
            return;
        }

        const auto content = readFile(path);
        const auto mark = report.mark();
        int lines = 0, accepted = 0;

        size_t start = 0;
        while (start <= content.size()) {
            auto stop = content.find('\n', start);
            if (stop == std::string::npos)
                stop = content.size();
            std::string_view line(content.data() + start, stop - start);
            start = stop + 1;
            if (line.empty())
                continue;
            lines++;

            std::string text = "\"";
            for (char c : line) {
                if (c == '"' || c == '\\') {
                    text += '\\';
                    text += c;
                } else if (uint8_t(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", unsigned(uint8_t(c)));
                    text += buf;
                } else {
                    text += c;
                }
            }
            text += '"';

            stdc::json::ParseError error;
            const auto value = json::Value::fromJson(text, false, &error);
            report.checked++;

            if (!error) {
                accepted++;
                if (!isValidUtf8(line)) {
                    report.fail(path, "accepted a line that is not valid UTF-8");
                } else if (value.toString() != line) {
                    report.fail(path, "a valid line did not survive parsing");
                }
                if (!isValidUtf8(value.toJson())) {
                    report.fail(path, "wrote text that is not valid UTF-8");
                }
            } else if (isValidUtf8(line)) {
                report.fail(path, "rejected a line that is valid UTF-8: " + error.message());
            }
        }

        heading("markus_kuhn",
                counted(lines, "line") + ", " + std::to_string(accepted) + " accepted",
                report.since(mark));
    }

    /// An indefinite-length byte string, 512 bytes of it, and then a fuzzer's tail: a chunk that
    /// is itself an indefinite-length byte string, which RFC 8949 does not allow -- the pieces of
    /// an indefinite-length string are definite-length strings of the same major type. nlohmann,
    /// where the fixture comes from, flattens the nesting anyway. We do not, so the document has
    /// to be rejected, and the check is that it is rejected for that reason and no other.
    ///
    /// The indefinite lengths this file was meant to exercise are covered by the RFC's own test
    /// vectors in test_JSON.cpp.
    void runBinaryData(const fs::path &dir) {
        const auto path = dir / "cbor_binary.cbor";
        if (!fs::exists(path)) {
            return;
        }

        const auto bytes = readFile(path);
        stdc::cbor::DecodeError error;
        json::Value::fromCbor(stdc::array_view<uint8_t>(
                                reinterpret_cast<const uint8_t *>(bytes.data()), bytes.size()),
                            &error);
        report.checked++;

        const bool asExpected = error.what.find("indefinite-length string") != std::string::npos;
        if (!asExpected) {
            report.fail(path, !error ? "ill-formed nesting was accepted"
                                     : "rejected for an unexpected reason: " + error.message());
        }
        heading("binary_data", "1 document", asExpected ? 0 : 1);
    }

    /// https://github.com/nlohmann/json_test_data, at a1375cea (2022-04-03).
    ///
    /// The one corpus here that ships a CBOR encoding beside most of its documents, which is what
    /// makes it worth keeping even though it carries its own older copies of two of the others.
    void runNlohmann(const fs::path &root) {
        runMinefield(root / "nst_json_testsuite" / "test_parsing", "nst_json_testsuite");
        runMinefield(root / "nst_json_testsuite2" / "test_parsing", "nst_json_testsuite2");
        runJsonChecker(root / "json_tests", "json_tests");
        runAcceptAll(root / "json.org", "json.org");
        runAcceptAll(root / "json_testsuite", "json_testsuite");
        runAcceptAll(root / "json_nlohmann_tests", "json_nlohmann_tests");
        runAcceptAll(root / "nativejson-benchmark", "nativejson-benchmark");
        runAcceptAll(root / "jeopardy", "jeopardy");
        runAcceptAll(root / "big-list-of-naughty-strings", "naughty-strings");
        runUtf8Stress(root / "markus_kuhn");
        runRoundTrip(root / "json_roundtrip", "json_roundtrip");
        runBinaryData(root / "binary_data");

        // Every document in regression/ is well formed, broken_file.json included -- what was
        // broken about it was how a stream was being read, not the JSON.
        runAcceptAll(root / "regression", "regression");

        // A fuzzer corpus. These are not valid CBOR and are not meant to be; the only requirement
        // is that the decoder says so rather than reading past the end or running out of stack.
        const auto dir = root / "cbor_regression";
        if (fs::is_directory(dir)) {
            int count = 0, decoded = 0;
            for (const auto &path : filesIn(dir)) {
                const auto bytes = readFile(path);
                stdc::cbor::DecodeError error;
                const auto value = json::Value::fromCbor(
                    stdc::array_view<uint8_t>(reinterpret_cast<const uint8_t *>(bytes.data()),
                                              bytes.size()),
                    &error);
                report.checked++;
                count++;
                if (!error) {
                    decoded++;
                    checkValue(path, value);
                }
            }
            heading("cbor_regression",
                    counted(count, "input") + ", " + std::to_string(decoded) +
                        " decoded, none crashed",
                    0);
        }
    }

    // ----------------------------------------------------------------------------------------
    // nst/JSONTestSuite
    // ----------------------------------------------------------------------------------------

    /// https://github.com/nst/JSONTestSuite, at 1ef36fa0 (2024-11-22).
    ///
    /// The origin of the y_/n_/i_ files that the other corpora vendor copies of, two years newer
    /// here than nlohmann's copy of it.
    void runJsonTestSuite(const fs::path &root) {
        runMinefield(root / "test_parsing", "test_parsing");

        // test_transform asks questions rather than setting answers: what a parser does with a
        // repeated key, with a number past the integer range, with a lone surrogate. The suite
        // records what implementations do and judges none of them, so neither do we -- but
        // whatever we decide, the document still has to survive everything in checkValue().
        const auto dir = root / "test_transform";
        if (fs::is_directory(dir)) {
            const auto mark = report.mark();
            int count = 0, accepted = 0;
            for (const auto &path : filesIn(dir, ".json")) {
                checkFile(path, Expectation::Either, &accepted);
                count++;
            }
            heading("test_transform",
                    counted(count, "document") + ", " + std::to_string(accepted) + " accepted",
                    report.since(mark));
        }
    }

    // ----------------------------------------------------------------------------------------
    // miloyip/nativejson-benchmark
    // ----------------------------------------------------------------------------------------

    /// https://github.com/miloyip/nativejson-benchmark, at 478d5727 (2022-10-28).
    ///
    /// A benchmark rather than a test suite, so what it brings is size: three documents of a few
    /// megabytes each, which is the only place here the parser is asked to do any real work.
    void runNativeJsonBenchmark(const fs::path &root) {
        runJsonChecker(root / "data" / "jsonchecker", "data/jsonchecker");
        runRoundTrip(root / "data" / "roundtrip", "data/roundtrip");

        // The benchmark documents themselves, without descending into jsonchecker and roundtrip.
        const auto dir = root / "data";
        if (fs::is_directory(dir)) {
            const auto mark = report.mark();
            int count = 0;
            for (const auto &path : filesIn(dir, ".json")) {
                checkFile(path, Expectation::Accept);
                count++;
            }
            heading("data", counted(count, "document"), report.since(mark));
        }
    }

    // ----------------------------------------------------------------------------------------
    // simdjson/simdjson-data
    // ----------------------------------------------------------------------------------------

    /// https://github.com/simdjson/simdjson-data, at 4197c425 (2025-11-20).
    ///
    /// The largest of the four and the only one still being added to. Its jsonchecker extends
    /// json.org's from 33 files to 82, and issue150 is a regression corpus of some 1450 documents
    /// from a single bug.
    void runSimdjson(const fs::path &root) {
        runJsonChecker(root / "jsonchecker", "jsonchecker");
        runMinefield(root / "jsonchecker" / "minefield", "jsonchecker/minefield");
        runMustNotCrash(root / "jsonchecker" / "adversarial", "jsonchecker/adversarial");
        runAcceptAll(root / "jsonexamples", "jsonexamples");
    }

    // ----------------------------------------------------------------------------------------
    // The table
    // ----------------------------------------------------------------------------------------

    struct Vendor {
        const char *key;       ///< What to name it on the command line.
        const char *directory; ///< What the clone is called, for finding it under a parent.
        const char *repository;
        const char *commit; ///< What the expectations above were written against.
        void (*run)(const fs::path &root);
    };

    // clang-format off
    const Vendor vendors[] = {
        {"nlohmann", "json_test_data", "https://github.com/nlohmann/json_test_data", "a1375cea",
         runNlohmann},
        {"nst", "JSONTestSuite", "https://github.com/nst/JSONTestSuite", "1ef36fa0",
         runJsonTestSuite},
        {"miloyip", "nativejson-benchmark", "https://github.com/miloyip/nativejson-benchmark",
         "478d5727", runNativeJsonBenchmark},
        {"simdjson", "simdjson-data", "https://github.com/simdjson/simdjson-data", "4197c425",
         runSimdjson},
    };
    // clang-format on

    const Vendor *findVendor(std::string_view key) {
        for (const auto &vendor : vendors) {
            if (key == vendor.key)
                return &vendor;
        }
        return nullptr;
    }

    void runVendor(const Vendor &vendor, const fs::path &root) {
        std::printf("\n%s  %s @ %s\n", vendor.key, vendor.repository, vendor.commit);
        std::printf("%s\n", std::string(96, '-').c_str());
        const auto mark = report.mark();
        const auto before = report.checked;
        vendor.run(root);

        const int failures = report.since(mark);
        const std::string verdict =
            failures ? counted(failures, "failure") + " <<<" : std::string("no failures");
        std::printf("  %-30s %s, %s\n", "", counted(report.checked - before, "check").c_str(),
                    verdict.c_str());
    }

    void usage(const char *program) {
        std::fprintf(stderr,
                     "usage: %s <directory-holding-the-clones>\n"
                     "       %s <vendor>=<path> ...\n\nvendors:\n",
                     program, program);
        for (const auto &vendor : vendors) {
            std::fprintf(stderr, "  %-10s %-24s %s @ %s\n", vendor.key, vendor.directory,
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
            const auto *vendor = findVendor(key);
            if (!vendor) {
                std::fprintf(stderr, "no vendor called %s\n", key.c_str());
                usage(argv[0]);
                return 2;
            }
            const fs::path root = argument.substr(split + 1);
            if (!fs::is_directory(root)) {
                std::fprintf(stderr, "%s is not a directory\n", root.string().c_str());
                return 2;
            }
            runVendor(*vendor, root);
            ran++;
            continue;
        }

        // A parent holding the clones, each under the name it is cloned as. Whatever is there
        // runs; whatever is not is not mentioned, so any subset works.
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

    std::printf("\n%d checks over %d %s, %d skipped, %zu failures\n", report.checked, ran,
                ran == 1 ? "corpus" : "corpora", report.skipped, report.failures.size());
    if (!report.failures.empty()) {
        std::printf("\n");
        for (const auto &failure : report.failures) {
            std::printf("  %-46s %s\n", failure.file.c_str(), failure.reason.c_str());
        }
        return 1;
    }
    return 0;
}

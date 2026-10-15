// SPDX-License-Identifier: MIT

#ifndef STDC_TEST_CONFORMANCE_H
#define STDC_TEST_CONFORMANCE_H

// The checks a conformance corpus is put through, and the bookkeeping behind them. What each
// vendor's files mean is in main.cpp; this is what we do with one once we know.

#include <string>
#include <string_view>
#include <filesystem>
#include <vector>

#include <stdcorelib/support/json.h>

namespace conformance {

    namespace fs = std::filesystem;

    namespace json = stdc::json;
    namespace cbor = stdc::cbor;

    struct Failure {
        std::string file;
        std::string reason;
    };

    /// Totals for the whole run, so a vendor that reports nothing still shows it did nothing.
    struct Report {
        int checked = 0;
        int skipped = 0;
        std::vector<Failure> failures;

        void fail(const fs::path &file, std::string reason);

        /// How many failures have been recorded, for a suite that wants to print its own count.
        size_t mark() const {
            return failures.size();
        }
        int since(size_t mark) const {
            return int(failures.size() - mark);
        }
    };

    extern Report report;

    // ----------------------------------------------------------------------------------------
    // Reading
    // ----------------------------------------------------------------------------------------

    std::string readFile(const fs::path &path, bool *ok = nullptr);

    /// The files in a directory, sorted, so that two runs can be compared line by line. The
    /// filesystem hands them over in whatever order it likes.
    std::vector<fs::path> filesIn(const fs::path &dir, std::string_view suffix = {});

    /// The same, through every directory below.
    std::vector<fs::path> filesUnder(const fs::path &dir, std::string_view suffix = {});

    bool startsWith(std::string_view s, std::string_view prefix);
    bool endsWith(std::string_view s, std::string_view suffix);

    /// A UTF-8 validator written here rather than borrowed, so that what the parser decides can be
    /// checked against something other than the routine the parser itself calls.
    bool isValidUtf8(std::string_view s);

    // ----------------------------------------------------------------------------------------
    // Checks
    // ----------------------------------------------------------------------------------------

    enum class Expectation {
        Accept,
        Reject,
        Either, ///< Implementation-defined. Counted and reported, never failed.
    };

    /// Reads a document and holds the parser to \a expectation. An accepted one then has to
    /// survive everything in checkValue().
    ///
    /// \param eitherAccepted Incremented when an implementation-defined document is accepted,
    ///        which is the only way to see what we chose.
    json::Value checkFile(const fs::path &path, Expectation expectation,
                        int *eitherAccepted = nullptr);

    /// Everything an accepted document owes us beyond parsing: its serialization parses back to an
    /// equal value, serializing that gives the same text, and its CBOR decodes to itself.
    void checkValue(const fs::path &path, const json::Value &value);

    /// A CBOR encoding written by another implementation, sitting beside the JSON, has to decode
    /// to the value we parsed. Does nothing when there is no such file.
    void checkForeignCbor(const fs::path &jsonPath, const json::Value &value);

    /// A file of one document per line, which is not JSON but is how several corpora ship their
    /// larger samples. Every line is held to \a expectation on its own.
    void checkLineDelimited(const fs::path &path, Expectation expectation);

    /// Parse, serialize, parse: the text has to come back byte for byte. Only for corpora whose
    /// documents are already written the way we write them.
    void checkExactRoundTrip(const fs::path &path);

    /// Whether any double in here is an infinity or a NaN.
    ///
    /// JSON has no way to write one. A parser that accepts \c 1e999 -- and the suites insist we
    /// do -- has to put something in the text when asked for it again, and what every
    /// implementation puts there is \c null. So these documents parse, and serialize, and simply
    /// do not come back as what they were. That is the format, not a defect, and the round-trip
    /// checks skip them on that ground.
    bool hasNonFinite(const json::Value &value);

}

#endif // STDC_TEST_CONFORMANCE_H

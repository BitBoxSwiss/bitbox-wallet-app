// SPDX-License-Identifier: MIT

#ifndef STDC_TEST_VECTORS_H
#define STDC_TEST_VECTORS_H

// Reading cbor-wg/cbor-test-vectors, whose test files are themselves CBOR.
//
// Decoding them with json::Value::fromCbor would be circular -- the reader would be the thing under
// test -- and it would not work anyway: a file describing what a tag decodes to has a tag in it,
// and we do not read tags. So the manifest is walked here by hand, structurally, taking each
// test's fields out without interpreting the items they hold.
//
// This walker is not a CBOR decoder and is not trying to be. It reads what these files contain:
// definite-length maps with text keys, arrays, byte strings, and booleans. Anything else it
// refuses rather than guesses at.

#include <cstdint>
#include <string>
#include <vector>

#include <stdcorelib/adt/array_view.h>

namespace vectors {

    using Bytes = stdc::array_view<uint8_t>;

    /// One entry of a file's "tests" array.
    struct Vector {
        std::string description;

        /// The bytes of the "encoded" byte string: the input a decoder is given.
        std::vector<uint8_t> encoded;
        bool hasEncoded = false;

        /// The CBOR of the "decoded" item, verbatim, still encoded. The file writes the same item
        /// a second time in preferred form, so decoding both and comparing says whether the two
        /// spellings mean the same thing to us.
        std::vector<uint8_t> decoded;
        bool hasDecoded = false;

        /// Whether every step is required to fail. Inherited from the file when the entry is
        /// silent.
        bool fail = false;

        /// Whether re-encoding the decoded item has to give "encoded" back byte for byte.
        bool roundtrip = true;
    };

    struct File {
        std::string title;
        std::string description;
        bool fail = false;
        std::vector<Vector> tests;
    };

    /// Reads one .cbor test file. Returns false and fills \a error when the file is not shaped the
    /// way the repository documents.
    bool readFile(Bytes data, File *out, std::string *error);

    /// Hex, for the older repository, which ships its vectors as a JSON array of hex strings.
    /// Returns false on an odd length or a character that is not a hex digit.
    bool fromHex(std::string_view text, std::vector<uint8_t> *out);

    std::string toHex(Bytes data);

}

#endif // STDC_TEST_VECTORS_H

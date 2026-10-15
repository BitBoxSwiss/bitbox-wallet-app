// SPDX-License-Identifier: MIT

#include "vectors.h"

#include <cstdio>

namespace vectors {

    namespace {

        /// Where the walk has got to, and what went wrong if it stopped.
        struct Walker {
            Bytes data;
            size_t pos = 0;
            std::string error;

            bool fail(const char *what) {
                if (error.empty()) {
                    error = std::string(what) + ", at byte " + std::to_string(pos);
                }
                return false;
            }

            bool take(uint8_t *out) {
                if (pos >= data.size()) {
                    return fail("the file ends early");
                }
                *out = data[pos++];
                return true;
            }

            /// The initial byte and whatever argument follows it. Indefinite lengths do not occur
            /// in these files, so meeting one is a reason to stop rather than a case to handle.
            bool head(uint8_t *major, uint64_t *arg) {
                uint8_t initial;
                if (!take(&initial)) {
                    return false;
                }
                *major = uint8_t(initial >> 5);

                const uint8_t minor = initial & 0x1F;
                if (minor < 24) {
                    *arg = minor;
                    return true;
                }
                if (minor > 27) {
                    return fail("an argument this walker does not read");
                }

                const int width = 1 << (minor - 24);
                if (pos + size_t(width) > data.size()) {
                    return fail("the file ends early");
                }
                uint64_t value = 0;
                for (int i = 0; i < width; ++i) {
                    value = (value << 8) | data[pos++];
                }
                *arg = value;
                return true;
            }

            /// Steps over one item, whatever it is, so that the walk can carry on past a value it
            /// has no interest in. This one does have to know about indefinite lengths: the items
            /// being stepped over are the test data, and some of them are streamed.
            bool skip() {
                uint8_t initial;
                if (pos >= data.size()) {
                    return fail("the file ends early");
                }
                initial = data[pos];

                if ((initial & 0x1F) == 31) {
                    const uint8_t major = uint8_t(initial >> 5);
                    if (major < 2 || major > 5) {
                        return fail("an indefinite length on a type that cannot have one");
                    }
                    pos++;
                    while (true) {
                        if (pos >= data.size()) {
                            return fail("the file ends early");
                        }
                        if (data[pos] == 0xFF) {
                            pos++;
                            return true;
                        }
                        if (!skip()) {
                            return false;
                        }
                    }
                }

                uint8_t major;
                uint64_t arg;
                if (!head(&major, &arg)) {
                    return false;
                }

                switch (major) {
                    case 0:
                    case 1:
                        return true;
                    case 2:
                    case 3:
                        if (arg > data.size() - pos) {
                            return fail("a string longer than the file");
                        }
                        pos += size_t(arg);
                        return true;
                    case 4:
                        for (uint64_t i = 0; i < arg; ++i) {
                            if (!skip())
                                return false;
                        }
                        return true;
                    case 5:
                        for (uint64_t i = 0; i < arg * 2; ++i) {
                            if (!skip())
                                return false;
                        }
                        return true;
                    case 6:
                        return skip(); // The tag's content.
                    default:
                        // Major type 7. The argument was the whole item.
                        return true;
                }
            }

            bool text(std::string *out) {
                uint8_t major;
                uint64_t arg;
                if (!head(&major, &arg)) {
                    return false;
                }
                if (major != 3) {
                    return fail("expected a text string");
                }
                if (arg > data.size() - pos) {
                    return fail("a string longer than the file");
                }
                out->assign(reinterpret_cast<const char *>(data.data() + pos), size_t(arg));
                pos += size_t(arg);
                return true;
            }

            bool bytes(std::vector<uint8_t> *out) {
                uint8_t major;
                uint64_t arg;
                if (!head(&major, &arg)) {
                    return false;
                }
                if (major != 2) {
                    return fail("expected a byte string");
                }
                if (arg > data.size() - pos) {
                    return fail("a string longer than the file");
                }
                out->assign(data.data() + pos, data.data() + pos + size_t(arg));
                pos += size_t(arg);
                return true;
            }

            bool boolean(bool *out) {
                uint8_t value;
                if (!take(&value)) {
                    return false;
                }
                if (value != 0xF4 && value != 0xF5) {
                    return fail("expected true or false");
                }
                *out = value == 0xF5;
                return true;
            }

            /// The head of a definite-length map or array, giving how many entries follow.
            bool container(uint8_t expected, uint64_t *count) {
                uint8_t major;
                if (!head(&major, count)) {
                    return false;
                }
                if (major != expected) {
                    return fail(expected == 4 ? "expected an array" : "expected a map");
                }
                return true;
            }

            /// Copies the item at the current position out whole, still encoded, and steps past
            /// it.
            bool raw(std::vector<uint8_t> *out) {
                const size_t start = pos;
                if (!skip()) {
                    return false;
                }
                out->assign(data.data() + start, data.data() + pos);
                return true;
            }
        };

        bool readVector(Walker &walker, bool fileFail, Vector *out) {
            uint64_t entries;
            if (!walker.container(5, &entries)) {
                return false;
            }
            out->fail = fileFail;

            for (uint64_t i = 0; i < entries; ++i) {
                std::string key;
                if (!walker.text(&key)) {
                    return false;
                }

                if (key == "description") {
                    if (!walker.text(&out->description))
                        return false;
                } else if (key == "encoded") {
                    if (!walker.bytes(&out->encoded))
                        return false;
                    out->hasEncoded = true;
                } else if (key == "decoded") {
                    if (!walker.raw(&out->decoded))
                        return false;
                    out->hasDecoded = true;
                } else if (key == "fail") {
                    if (!walker.boolean(&out->fail))
                        return false;
                } else if (key == "roundtrip") {
                    if (!walker.boolean(&out->roundtrip))
                        return false;
                } else if (!walker.skip()) {
                    return false;
                }
                // A key this runner has no use for was stepped over rather than refused, so that
                // a field added upstream does not stop the run.
            }
            return true;
        }

    }

    bool readFile(Bytes data, File *out, std::string *error) {
        Walker walker{data};

        uint64_t entries;
        if (!walker.container(5, &entries)) {
            *error = walker.error;
            return false;
        }

        for (uint64_t i = 0; i < entries; ++i) {
            std::string key;
            if (!walker.text(&key)) {
                *error = walker.error;
                return false;
            }

            bool ok = true;
            if (key == "title") {
                ok = walker.text(&out->title);
            } else if (key == "description") {
                ok = walker.text(&out->description);
            } else if (key == "fail") {
                ok = walker.boolean(&out->fail);
            } else if (key == "tests") {
                uint64_t count;
                ok = walker.container(4, &count);
                for (uint64_t t = 0; ok && t < count; ++t) {
                    Vector vector;
                    ok = readVector(walker, out->fail, &vector);
                    if (ok) {
                        out->tests.push_back(std::move(vector));
                    }
                }
            } else {
                ok = walker.skip();
            }

            if (!ok) {
                *error = walker.error;
                return false;
            }
        }

        if (walker.pos != data.size()) {
            *error = "bytes left over after the map";
            return false;
        }
        return true;
    }

    // ------------------------------------------------------------------------------------------
    // Hex
    // ------------------------------------------------------------------------------------------

    bool fromHex(std::string_view text, std::vector<uint8_t> *out) {
        if (text.size() % 2 != 0) {
            return false;
        }

        auto digit = [](char c, int *value) {
            if (c >= '0' && c <= '9') {
                *value = c - '0';
            } else if (c >= 'a' && c <= 'f') {
                *value = c - 'a' + 10;
            } else if (c >= 'A' && c <= 'F') {
                *value = c - 'A' + 10;
            } else {
                return false;
            }
            return true;
        };

        out->clear();
        out->reserve(text.size() / 2);
        for (size_t i = 0; i < text.size(); i += 2) {
            int high, low;
            if (!digit(text[i], &high) || !digit(text[i + 1], &low)) {
                return false;
            }
            out->push_back(uint8_t((high << 4) | low));
        }
        return true;
    }

    std::string toHex(Bytes data) {
        static const char digits[] = "0123456789abcdef";
        std::string out;
        out.reserve(data.size() * 2);
        for (uint8_t byte : data) {
            out += digits[byte >> 4];
            out += digits[byte & 0x0F];
        }
        return out;
    }

}

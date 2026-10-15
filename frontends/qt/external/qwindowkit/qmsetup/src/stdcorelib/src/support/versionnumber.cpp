// SPDX-License-Identifier: MIT

#include "versionnumber.h"

#include <cstdlib>
#include <charconv>

#include "algorithms.h"

namespace stdc {

    VersionNumber::VersionNumber() {
        m_numbers[0] = 0;
        m_numbers[1] = 0;
        m_numbers[2] = 0;
        m_numbers[3] = 0;
    }

    VersionNumber::VersionNumber(int major, int minor, int patch, int tweak) {
        m_numbers[0] = major;
        m_numbers[1] = minor;
        m_numbers[2] = patch;
        m_numbers[3] = tweak;
    }

    std::optional<VersionNumber> VersionNumber::fromString(const std::string_view &s) {
        VersionNumber res;
        size_t index = 0;
        size_t start = 0;
        for (;;) {
            if (index == res.m_numbers.size()) {
                // More components than there are places to put them, which is a version of
                // something else rather than a longer version of this.
                return std::nullopt;
            }

            auto stop = s.find('.', start);
            auto segment = s.substr(start, stop == std::string_view::npos ? stop : stop - start);
            // The same answer comes out of from_chars, which refuses an empty range. This is
            // here so that a default constructed string_view, whose data() is null, is not the
            // range handed to it.
            if (segment.empty()) {
                return std::nullopt;
            }
            // Checked here rather than left to from_chars, which reads a leading minus into an
            // int quite happily and would make "1.-2" a version.
            for (char c : segment) {
                if (c < '0' || c > '9') {
                    return std::nullopt;
                }
            }

            // Digits throughout, so the only thing left for from_chars to refuse is a number
            // too big for an int, and there is nothing it can leave behind.
            auto answer = std::from_chars(segment.data(), segment.data() + segment.size(),
                                          res.m_numbers[index]);
            if (answer.ec != std::errc{}) {
                return std::nullopt;
            }
            index++;

            if (stop == std::string_view::npos) {
                return res;
            }
            start = stop + 1;
        }
    }

    std::string VersionNumber::toString() const {
        if (tweak() != 0) {
            return std::to_string(major()) + "." + std::to_string(minor()) + "." +
                   std::to_string(patch()) + "." + std::to_string(tweak());
        }
        if (patch() != 0) {
            return std::to_string(major()) + "." + std::to_string(minor()) + "." +
                   std::to_string(patch());
        }
        return std::to_string(major()) + "." + std::to_string(minor());
    }

    bool VersionNumber::isEmpty() const {
        return major() == 0 && minor() == 0 && patch() == 0 && tweak() == 0;
    }

    bool VersionNumber::operator==(const VersionNumber &RHS) const {
        return major() == RHS.major() && minor() == RHS.minor() && patch() == RHS.patch() &&
               tweak() == RHS.tweak();
    }

    bool VersionNumber::operator!=(const VersionNumber &RHS) const {
        return !(*this == RHS);
    }

    bool VersionNumber::operator<(const VersionNumber &RHS) const {
        if (major() < RHS.major())
            return true;
        if (major() > RHS.major())
            return false;
        if (minor() < RHS.minor())
            return true;
        if (minor() > RHS.minor())
            return false;
        if (patch() < RHS.patch())
            return true;
        if (patch() > RHS.patch())
            return false;
        return tweak() < RHS.tweak();
    }

    bool VersionNumber::operator>(const VersionNumber &RHS) const {
        if (major() > RHS.major())
            return true;
        if (major() < RHS.major())
            return false;
        if (minor() > RHS.minor())
            return true;
        if (minor() < RHS.minor())
            return false;
        if (patch() > RHS.patch())
            return true;
        if (patch() < RHS.patch())
            return false;
        return tweak() > RHS.tweak();
    }

    bool VersionNumber::operator<=(const VersionNumber &RHS) const {
        return !(*this > RHS);
    }

    bool VersionNumber::operator>=(const VersionNumber &RHS) const {
        return !(*this < RHS);
    }

}

namespace std {

    size_t hash<stdc::VersionNumber>::operator()(const stdc::VersionNumber &key) const {
        // An arbitrary starting value, so that a version of all zeroes does not hash to zero.
        // It used to be typeid(key).hash_code(), which for a type with no virtual functions is a
        // constant the compiler already knows, so it bought nothing.
        size_t seed = 0x9E3779B9u; // fits a 32 bit size_t too
        seed = stdc::hash(key.major(), seed);
        seed = stdc::hash(key.minor(), seed);
        seed = stdc::hash(key.patch(), seed);
        seed = stdc::hash(key.tweak(), seed);
        return seed;
    }

}

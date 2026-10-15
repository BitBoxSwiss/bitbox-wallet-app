// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_VERSIONNUMBER_H
#define STDCORELIB_VERSIONNUMBER_H

#include <string>
#include <array>
#include <iostream>
#include <optional>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup utility
    /// @{

    class STDC_EXPORT VersionNumber {
    public:
        VersionNumber();
        explicit VersionNumber(int major, int minor = 0, int patch = 0, int tweak = 0);

        /// The version \a s spells, or nothing where it does not spell one.
        ///
        /// One to four components separated by dots, each of them digits and nothing else, each
        /// fitting an \c int. Leading zeros are read as the number they are, so \c 01.02 is
        /// 1.2.
        ///
        /// \note It used to answer with whatever it could get and zeros for the rest, so
        ///       \c abc and \c 0 were the same answer and \c 1.2.3.4.5 was 1.2.3.4. There was
        ///       no way to tell a version from a sentence.
        static std::optional<VersionNumber> fromString(const std::string_view &s);

    public:
        inline int major() const {
            return m_numbers[0];
        }

        inline int minor() const {
            return m_numbers[1];
        }

        inline int patch() const {
            return m_numbers[2];
        }

        inline int tweak() const {
            return m_numbers[3];
        }

        std::string toString() const;
        bool isEmpty() const;

        bool operator==(const VersionNumber &RHS) const;
        bool operator!=(const VersionNumber &RHS) const;
        bool operator<(const VersionNumber &RHS) const;
        bool operator>(const VersionNumber &RHS) const;
        bool operator<=(const VersionNumber &RHS) const;
        bool operator>=(const VersionNumber &RHS) const;

    private:
        std::array<int, 4> m_numbers;
    };

    /// @}

}

namespace std {

    /// \addtogroup utility
    /// @{

    template <>
    struct STDC_EXPORT hash<stdc::VersionNumber> {
        size_t operator()(const stdc::VersionNumber &key) const;
    };

    inline ostream &operator<<(std::ostream &out, const stdc::VersionNumber &c) {
        out << "VersionNumber(" << c.toString() << ")";
        return out;
    }

    /// @}

}

#endif // STDCORELIB_VERSIONNUMBER_H

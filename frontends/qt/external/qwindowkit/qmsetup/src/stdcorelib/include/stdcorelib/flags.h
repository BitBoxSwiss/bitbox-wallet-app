// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_FLAGS_H
#define STDCORELIB_FLAGS_H

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <initializer_list>
#include <type_traits>
#include <utility>

/// \defgroup utility Utilities
///
/// stdc::flags is type-safe bit flags over an enum, in the shape of \c QFlags. stdc::scope_guard
/// runs something on the way out unless \c dismiss() says otherwise. stdc::VersionNumber parses,
/// prints, compares and hashes a four part version, and answers with nothing for a string that is
/// not one.
///
/// \code
///     auto guard = stdc::make_scope_guard([&] { std::fclose(f); });
///     auto ver = stdc::VersionNumber::fromString("1.2.3").value_or(stdc::VersionNumber());
/// \endcode
///
/// \ref vla.h has \c STDC_VLA_ALLOC and \c STDC_VLA_NEW for stack arrays sized at run time, and
/// \ref pimpl.h the \c stdc_impl_t boilerplate the library uses on itself.

namespace stdc {

    /// \addtogroup utility
    /// @{

    class flag {
    public:
        constexpr explicit flag(int value) noexcept : m_value(value) {
        }

        constexpr operator int() const noexcept {
            return m_value;
        }

    private:
        int m_value;
    };

    class incompatible_flag {
    public:
        constexpr explicit incompatible_flag(int value) noexcept : m_value(value) {
        }

        constexpr operator int() const noexcept {
            return m_value;
        }

    private:
        int m_value;
    };

    namespace detail {

        template <size_t N>
        struct integer_for_size;

        template <>
        struct integer_for_size<1> {
            using Signed = int8_t;
            using Unsigned = uint8_t;
        };

        template <>
        struct integer_for_size<2> {
            using Signed = int16_t;
            using Unsigned = uint16_t;
        };

        template <>
        struct integer_for_size<4> {
            using Signed = int32_t;
            using Unsigned = uint32_t;
        };

        template <>
        struct integer_for_size<8> {
            using Signed = int64_t;
            using Unsigned = uint64_t;
        };

        template <class Enum>
        class flags_storage {
            static_assert(sizeof(Enum) <= sizeof(uint64_t),
                          "Only enumerations up to 64 bits are supported.");
            static_assert(std::is_enum<Enum>::value, "flags is only usable on enumeration types.");

            static constexpr size_t IntegerSize = std::max(sizeof(Enum), sizeof(int));
            using Integers = integer_for_size<IntegerSize>;

        protected:
            using Int = typename std::conditional<
                std::is_unsigned<typename std::underlying_type<Enum>::type>::value,
                typename Integers::Unsigned, typename Integers::Signed>::type;

            Int i = 0;

        public:
            constexpr flags_storage() noexcept = default;
            constexpr explicit flags_storage(std::in_place_t, Int value) noexcept : i(value) {
            }
        };

        template <class Enum, int Size = sizeof(flags_storage<Enum>)>
        struct flags_storage_helper : flags_storage<Enum> {
            using flags_storage<Enum>::flags_storage;
        };

        template <class Enum>
        struct flags_storage_helper<Enum, sizeof(int)> : flags_storage<Enum> {
            using flags_storage<Enum>::flags_storage;

            constexpr flags_storage_helper(flag f) noexcept
                : flags_storage<Enum>(std::in_place, f.operator int()) {
            }
        };

    }

    template <class Enum>
    class flags : public detail::flags_storage_helper<Enum> {
        using Base = detail::flags_storage_helper<Enum>;

    public:
        using enum_type = Enum;
        using Int = typename Base::Int;
        using Base::Base;

        constexpr flags() noexcept = default;
        constexpr flags(Enum value) noexcept : Base(std::in_place, Int(value)) {
        }

        constexpr flags(std::initializer_list<Enum> values) noexcept
            : Base(std::in_place, initializer_list_helper(values.begin(), values.end())) {
        }

        static constexpr flags fromInt(Int value) noexcept {
            return flags(std::in_place, value);
        }

        constexpr Int toInt() const noexcept {
            return i;
        }

        constexpr flags &operator&=(flags mask) noexcept {
            i &= mask.i;
            return *this;
        }

        constexpr flags &operator&=(Enum mask) noexcept {
            i &= Int(mask);
            return *this;
        }

        constexpr flags &operator|=(flags RHS) noexcept {
            i |= RHS.i;
            return *this;
        }

        constexpr flags &operator|=(Enum RHS) noexcept {
            i |= Int(RHS);
            return *this;
        }

        constexpr flags &operator^=(flags RHS) noexcept {
            i ^= RHS.i;
            return *this;
        }

        constexpr flags &operator^=(Enum RHS) noexcept {
            i ^= Int(RHS);
            return *this;
        }

        constexpr explicit operator Int() const noexcept {
            return i;
        }

        constexpr explicit operator bool() const noexcept {
            return i != Int(0);
        }

        constexpr flags operator|(flags RHS) const noexcept {
            return flags(std::in_place, i | RHS.i);
        }

        constexpr flags operator|(Enum RHS) const noexcept {
            return flags(std::in_place, i | Int(RHS));
        }

        constexpr flags operator^(flags RHS) const noexcept {
            return flags(std::in_place, i ^ RHS.i);
        }

        constexpr flags operator^(Enum RHS) const noexcept {
            return flags(std::in_place, i ^ Int(RHS));
        }

        constexpr flags operator&(flags RHS) const noexcept {
            return flags(std::in_place, i & RHS.i);
        }

        constexpr flags operator&(Enum RHS) const noexcept {
            return flags(std::in_place, i & Int(RHS));
        }

        constexpr flags operator~() const noexcept {
            return flags(std::in_place, ~i);
        }

        constexpr void operator+(flags) const noexcept = delete;
        constexpr void operator+(Enum) const noexcept = delete;
        constexpr void operator+(int) const noexcept = delete;
        constexpr void operator-(flags) const noexcept = delete;
        constexpr void operator-(Enum) const noexcept = delete;
        constexpr void operator-(int) const noexcept = delete;

        constexpr bool test_flag(Enum value) const noexcept {
            return test_flags(value);
        }

        constexpr bool test_flags(flags values) const noexcept {
            return values.i ? ((i & values.i) == values.i) : i == Int(0);
        }

        constexpr bool test_any_flag(Enum value) const noexcept {
            return test_any_flags(value);
        }

        constexpr bool test_any_flags(flags values) const noexcept {
            return (i & values.i) != Int(0);
        }

        constexpr flags &set_flag(Enum value, bool on = true) noexcept {
            return on ? (*this |= value) : (*this &= ~flags(value));
        }

        friend constexpr bool operator==(flags LHS, flags RHS) noexcept {
            return LHS.i == RHS.i;
        }

        friend constexpr bool operator!=(flags LHS, flags RHS) noexcept {
            return LHS.i != RHS.i;
        }

        friend constexpr bool operator==(flags LHS, Enum RHS) noexcept {
            return LHS == flags(RHS);
        }

        friend constexpr bool operator!=(flags LHS, Enum RHS) noexcept {
            return LHS != flags(RHS);
        }

        friend constexpr bool operator==(Enum LHS, flags RHS) noexcept {
            return flags(LHS) == RHS;
        }

        friend constexpr bool operator!=(Enum LHS, flags RHS) noexcept {
            return flags(LHS) != RHS;
        }

    private:
        static constexpr Int initializer_list_helper(
            typename std::initializer_list<Enum>::const_iterator it,
            typename std::initializer_list<Enum>::const_iterator end) noexcept {
            return it == end ? Int(0) : (Int(*it) | initializer_list_helper(it + 1, end));
        }

        using Base::i;
    };

    /// @}
}

#define STDC_DECLARE_FLAGS(Flags, Enum) using Flags = ::stdc::flags<Enum>;

#define STDC_DECLARE_OPERATORS_FOR_FLAGS(Flags)                                                    \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator|(          \
        typename Flags::enum_type LHS, typename Flags::enum_type RHS) noexcept {                   \
        return ::stdc::flags<typename Flags::enum_type>(LHS) | RHS;                                \
    }                                                                                              \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator|(          \
        typename Flags::enum_type LHS, ::stdc::flags<typename Flags::enum_type> RHS) noexcept {    \
        return RHS | LHS;                                                                          \
    }                                                                                              \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator&(          \
        typename Flags::enum_type LHS, typename Flags::enum_type RHS) noexcept {                   \
        return ::stdc::flags<typename Flags::enum_type>(LHS) & RHS;                                \
    }                                                                                              \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator&(          \
        typename Flags::enum_type LHS, ::stdc::flags<typename Flags::enum_type> RHS) noexcept {    \
        return RHS & LHS;                                                                          \
    }                                                                                              \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator^(          \
        typename Flags::enum_type LHS, typename Flags::enum_type RHS) noexcept {                   \
        return ::stdc::flags<typename Flags::enum_type>(LHS) ^ RHS;                                \
    }                                                                                              \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator^(          \
        typename Flags::enum_type LHS, ::stdc::flags<typename Flags::enum_type> RHS) noexcept {    \
        return RHS ^ LHS;                                                                          \
    }                                                                                              \
    constexpr inline void operator+(typename Flags::enum_type,                                     \
                                    typename Flags::enum_type) noexcept = delete;                  \
    constexpr inline void operator+(typename Flags::enum_type,                                     \
                                    ::stdc::flags<typename Flags::enum_type>) noexcept = delete;   \
    constexpr inline void operator+(int, ::stdc::flags<typename Flags::enum_type>) noexcept =      \
        delete;                                                                                    \
    constexpr inline void operator-(typename Flags::enum_type,                                     \
                                    typename Flags::enum_type) noexcept = delete;                  \
    constexpr inline void operator-(typename Flags::enum_type,                                     \
                                    ::stdc::flags<typename Flags::enum_type>) noexcept = delete;   \
    constexpr inline void operator-(int, ::stdc::flags<typename Flags::enum_type>) noexcept =      \
        delete;                                                                                    \
    constexpr inline void operator+(int, typename Flags::enum_type) noexcept = delete;             \
    constexpr inline void operator+(typename Flags::enum_type, int) noexcept = delete;             \
    constexpr inline void operator-(int, typename Flags::enum_type) noexcept = delete;             \
    constexpr inline void operator-(typename Flags::enum_type, int) noexcept = delete;             \
    [[maybe_unused]] constexpr inline ::stdc::flags<typename Flags::enum_type> operator~(          \
        typename Flags::enum_type value) noexcept {                                                \
        return ~Flags(value);                                                                      \
    }                                                                                              \
    [[maybe_unused]] constexpr inline void operator|(typename Flags::enum_type, int) noexcept =    \
        delete;

#endif // STDCORELIB_FLAGS_H

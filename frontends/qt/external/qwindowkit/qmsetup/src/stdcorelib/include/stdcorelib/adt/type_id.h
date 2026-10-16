// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_TYPE_ID_H
#define STDCORELIB_TYPE_ID_H

#include <atomic>
#include <cstddef>
#include <functional>
#include <string_view>
#include <type_traits>

#include <stdcorelib/stdc_global.h>

/// \defgroup types Type identity and registries
///
/// stdc::type_id names a type without \c typeid, and keeps that name the same across a shared
/// library boundary, which is the part \c std::type_index does not promise.
/// stdc::StaticRegistry and stdc::DynamicRegistry are what a plugin system registers into.

namespace stdc {

    /// \addtogroup types
    /// @{

    namespace detail {

        /// The compiler's own spelling of \a T, cut out of the signature of this function.
        ///
        /// Identity rests on this text. Every module that mentions \a T gets its own copy of
        /// everything else here, and the spelling is the only part they are guaranteed to agree
        /// about.
        ///
        /// \note The spelling is whatever the compiler writes, not a normalized form: MSVC says
        ///       \c "struct Foo" where GCC says \c "Foo". That costs nothing inside a process,
        ///       which never holds two compilers at once, but it does mean the name is not a
        ///       portable key to write into a file.
        template <class T>
        constexpr std::string_view type_name() {
#if defined(_MSC_VER)
            constexpr std::string_view signature = __FUNCSIG__;
            constexpr std::string_view opening = "type_name<";
            constexpr auto first = signature.find(opening) + opening.size();
            constexpr auto last = signature.rfind(">(void)");
#else
            constexpr std::string_view signature = __PRETTY_FUNCTION__;
            constexpr std::string_view opening = "T = ";
            constexpr auto first = signature.find(opening) + opening.size();
            // GCC lists the other template parameters after a semicolon, clang does not.
            constexpr auto semicolon = signature.find(';', first);
            constexpr auto last =
                semicolon == std::string_view::npos ? signature.rfind(']') : semicolon;
#endif
            static_assert(first < last, "cannot read the type name out of this compiler");
            return signature.substr(first, last - first);
        }

        /// One of these exists per type per module.
        ///
        /// \a name is the identity. It is settled at compile time, and two entries stand for the
        /// same type exactly when it matches.
        ///
        /// \a id is a cache of the one address this process uses for that name. There is no
        /// answer before the process has a table, and none is wanted until two modules meet, so
        /// it starts null and the first comparison that spans them fills it in.
        struct type_entry {
            std::string_view name;
            std::atomic<const void *> id;
        };

        /// Registers \a entry and returns the one address this process uses to stand for its
        /// name.
        ///
        /// An address rather than a number, because a number would have to come from a counter,
        /// and a build where two modules each hold a table would have two counters both starting
        /// at one. An entry keeps the first answer it is given, so entries numbered by different
        /// counters could collide and two unrelated types would compare equal. Addresses taken
        /// from different tables never do.
        ///
        /// \note The table lives in exactly one place, so this unifies modules that share one
        ///       copy of the library. Statically linking stdcorelib into two of them gives each
        ///       its own table, and then a type simply does not carry across, which is a refusal
        ///       rather than a wrong answer.
        STDC_EXPORT const void *register_type_id(type_entry &entry);

        /// Returns the canonical address cached in \a entry, registering it on the first call.
        inline const void *resolve_type_id(type_entry &entry) {
            if (const void *cached = entry.id.load(std::memory_order_acquire)) {
                return cached;
            }
            return register_type_id(entry);
        }

        template <class T>
        type_entry &entry_of() {
            static type_entry entry{type_name<T>(), nullptr};
            return entry;
        }

    }

    /// Which type something is, in a form that can be compared, stored, and passed between
    /// modules.
    ///
    /// What \c typeid would give, without needing RTTI and without depending on the loader having
    /// merged anything. Two ids compare equal when they name the same type, whichever module each
    /// of them was made in.
    ///
    /// \code
    ///   if (value.type() == type_id::of<Codec>()) {
    ///       ...
    ///   }
    /// \endcode
    ///
    /// \warning The type is taken exactly as written. \c Derived and \c Base are different ids,
    ///          and there is no way to ask whether one is the other.
    ///
    /// \note Comparing two ids made in the same module is a pointer comparison. The first
    ///       comparison that spans two of them consults a table in the library, once per type per
    ///       module, and remembers the answer.
    ///
    /// \sa any, DynamicRegistry
    class type_id {
    public:
        /// An id that stands for no type. Two such ids compare equal.
        constexpr type_id() = default;

        /// The id for \a T. Const and reference qualifiers are stripped, so \c int and
        /// \c const int& give the same one.
        template <class T>
        static type_id of() {
            return type_id(&detail::entry_of<std::decay_t<T>>());
        }

        /// The compiler's name for the type, or an empty view when there is no type.
        ///
        /// Meant for diagnostics and logging. The spelling differs between compilers, so it is
        /// not something to write down and read back.
        std::string_view name() const noexcept {
            return _entry ? _entry->name : std::string_view();
        }

        explicit operator bool() const noexcept {
            return _entry != nullptr;
        }

        friend bool operator==(type_id LHS, type_id RHS) {
            if (LHS._entry == RHS._entry) {
                return true;
            }
            if (!LHS._entry || !RHS._entry) {
                return false;
            }
            return detail::resolve_type_id(*LHS._entry) == detail::resolve_type_id(*RHS._entry);
        }

        friend bool operator!=(type_id LHS, type_id RHS) {
            return !(LHS == RHS);
        }

    private:
        explicit type_id(detail::type_entry *entry) noexcept : _entry(entry) {
        }

        // The one address standing for this type, which is what a hash has to be taken over so
        // that two ids comparing equal also hash equal.
        const void *canonical() const {
            return _entry ? detail::resolve_type_id(*_entry) : nullptr;
        }

        detail::type_entry *_entry = nullptr;

        friend struct std::hash<type_id>;
    };

    /// @}
}

template <>
struct std::hash<stdc::type_id> {
    size_t operator()(stdc::type_id id) const {
        return std::hash<const void *>()(id.canonical());
    }
};

#endif // STDCORELIB_TYPE_ID_H

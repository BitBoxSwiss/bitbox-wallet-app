// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_ALGORITHMS_H
#define STDCORELIB_ALGORITHMS_H

#include <cstddef>
#include <type_traits>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup containers
    /// @{

    template <typename, typename = void>
    struct has_key_type : std::false_type {};

    template <typename T>
    struct has_key_type<T, std::void_t<typename T::key_type>> : std::true_type {};

    template <typename, typename = void>
    struct has_mapped_type : std::false_type {};

    template <typename T>
    struct has_mapped_type<T, std::void_t<typename T::mapped_type>> : std::true_type {};

    template <typename T>
    struct is_map : std::conjunction<has_key_type<T>, has_mapped_type<T>> {};

    template <class ForwardIterator>
    void delete_all(ForwardIterator begin, ForwardIterator end) {
        while (begin != end) {
            delete *begin;
            ++begin;
        }
    }

    template <class Container>
    inline void delete_all(const Container &c) {
        if constexpr (is_map<Container>::value) {
            for (auto it = c.begin(); it != c.end(); ++it) {
                delete it->second;
            }
        } else {
            delete_all(c.begin(), c.end());
        }
    }

    // Folds `key` into `seed`, for building one hash out of several values. Order dependent.
    inline constexpr size_t hash(size_t key, size_t seed = 0) noexcept {
        if constexpr (sizeof(size_t) >= 8) {
            return seed ^ (key + size_t(0x9e3779b97f4a7c15ULL) + (seed << 12) + (seed >> 4));
        } else {
            return seed ^ (key + size_t(0x9e3779b9UL) + (seed << 6) + (seed >> 2));
        }
    }

    template <class Container, class T>
    inline bool contains(const Container &container, const T &key) {
#if __cplusplus >= 202002L
        return container.contains(key);
#else
        return container.count(key) != 0;
#endif
    }

    /// @}
}

#endif // STDCORELIB_ALGORITHMS_H

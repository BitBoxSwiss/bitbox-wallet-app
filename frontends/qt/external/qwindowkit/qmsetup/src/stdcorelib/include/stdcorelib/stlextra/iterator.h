// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_ITERATOR_H
#define STDCORELIB_ITERATOR_H

#include <iterator>
#include <type_traits>

namespace stdc {

    /// \addtogroup containers
    /// @{

    /// A reverse iterator that stores the position it denotes, not the one after it.
    ///
    /// \c std::reverse_iterator holds \c base() and dereferences a copy of \c base()-1, so the
    /// reference it returns points into a temporary that is gone by the end of the expression.
    /// That works for a pointer and breaks for any iterator that keeps the element in itself,
    /// which is what the registry key and value iterators do.
    ///
    /// \sa stdc::windows::RegKey
    template <class T>
    class reverse_iterator {
    public:
        using iterator_type = T;

        using _base_category = typename std::iterator_traits<iterator_type>::iterator_category;

#if __cplusplus >= 202002L
        using iterator_concept =
            std::conditional_t<std::random_access_iterator<T>, std::random_access_iterator_tag,
                               std::bidirectional_iterator_tag>;
        using iterator_category =
            std::conditional_t<std::derived_from<_base_category, std::random_access_iterator_tag>,
                               std::random_access_iterator_tag, _base_category>;
#else
        using iterator_category = _base_category;
#endif
        using value_type = typename std::iterator_traits<T>::value_type;
        using difference_type = typename std::iterator_traits<T>::difference_type;
        using pointer = typename std::iterator_traits<T>::pointer;
        using reference = typename std::iterator_traits<T>::reference;

        template <class>
        friend class reverse_iterator;

        constexpr reverse_iterator() = default;

        constexpr explicit reverse_iterator(T Base) noexcept : _it(std::move(--Base)) {
        }

        template <class T1>
        constexpr reverse_iterator(const reverse_iterator<T1> &RHS) : _it(RHS._it) {
        }

        template <class T1>
        constexpr reverse_iterator &operator=(const reverse_iterator<T1> &RHS) {
            _it = RHS._it;
            return *this;
        }

        [[nodiscard]] constexpr T base() const {
            T tmp = _it;
            ++tmp;
            return tmp;
        }

        [[nodiscard]] constexpr reference operator*() const {
            return *_it;
        }

        [[nodiscard]] constexpr pointer operator->() const {
            if constexpr (std::is_pointer_v<T>) {
                return _it;
            } else {
                return _it.operator->();
            }
        }

        constexpr reverse_iterator &operator++() {
            --_it;
            return *this;
        }

        constexpr reverse_iterator operator++(int) {
            reverse_iterator tmp = *this;
            --_it;
            return tmp;
        }

        constexpr reverse_iterator &operator--() {
            ++_it;
            return *this;
        }

        constexpr reverse_iterator operator--(int) {
            reverse_iterator tmp = *this;
            ++_it;
            return tmp;
        }

        [[nodiscard]] constexpr reverse_iterator operator+(const difference_type off) const {
            reverse_iterator tmp = *this;
            tmp._it -= off;
            return tmp;
        }

        constexpr reverse_iterator &operator+=(const difference_type off) {
            _it -= off;
            return *this;
        }

        [[nodiscard]] constexpr reverse_iterator operator-(const difference_type off) const {
            reverse_iterator tmp = *this;
            tmp._it += off;
            return tmp;
        }

        [[nodiscard]] constexpr reverse_iterator &operator-=(const difference_type off) {
            _it += off;
            return *this;
        }

        [[nodiscard]] constexpr reference operator[](const difference_type off) const {
            return _it[static_cast<difference_type>(-off)];
        }

        [[nodiscard]] constexpr bool operator==(const reverse_iterator &RHS) const {
            return _it == RHS._it;
        }

        [[nodiscard]] constexpr bool operator!=(const reverse_iterator &RHS) const {
            return _it != RHS._it;
        }

        [[nodiscard]] constexpr bool operator<(const reverse_iterator &RHS) const {
            return _it > RHS._it;
        }

        [[nodiscard]] constexpr bool operator<=(const reverse_iterator &RHS) const {
            return _it >= RHS._it;
        }

        [[nodiscard]] constexpr bool operator>(const reverse_iterator &RHS) const {
            return _it < RHS._it;
        }

        [[nodiscard]] constexpr bool operator>=(const reverse_iterator &RHS) const {
            return _it <= RHS._it;
        }

    protected:
        T _it{};
    };

    /// @}
}

#endif // STDCORELIB_ITERATOR_H

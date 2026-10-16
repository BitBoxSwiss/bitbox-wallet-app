// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_ARRAY_VIEW_H
#define STDCORELIB_ARRAY_VIEW_H

#include <array>
#include <optional>
#include <type_traits>
#include <vector>
#include <cassert>

/// \defgroup containers Containers and views
///
/// stdc::array_view is a read-only view over any contiguous container, so one parameter replaces a
/// pile of overloads. stdc::vlarray keeps its first N elements inline and stays off the heap while
/// it is small. stdc::linked_map remembers insertion order, over \c std::unordered_map or
/// \c std::map. stdc::aligned_allocator gives a container storage with a fixed minimum alignment.
/// stdc::any holds a value of any type and hands it back without RTTI.
///
/// \code
///     stdc::vlarray<int, 16> v;   // nothing allocated until the seventeenth element
/// \endcode

namespace stdc {

    /// \addtogroup containers
    /// @{

    /// A read-only view of a contiguous array, close to \c std::span<const \c T> from C++20.
    ///
    /// It converts implicitly from a \c std::vector, a \c std::array, a C array, a pointer and a
    /// length, or a single object, which is what makes it worth taking as a parameter instead of
    /// one overload per container.
    ///
    /// \warning It borrows and never owns. The array has to outlive the view, so binding one to
    ///          a temporary leaves it dangling at the end of the statement.
    template <class T>
    class array_view {
    public:
        using value_type = T;
        using pointer = value_type *;
        using const_pointer = const value_type *;
        using reference = value_type &;
        using const_reference = const value_type &;
        using iterator = const_pointer;
        using const_iterator = const_pointer;
        using reverse_iterator = std::reverse_iterator<iterator>;
        using const_reverse_iterator = std::reverse_iterator<const_iterator>;
        using size_type = size_t;
        using difference_type = ptrdiff_t;

    public:
        array_view() = default;

        array_view(std::nullopt_t) {
        }

        array_view(const T &item) : _data(&item), _size(1) {
        }

        constexpr array_view(const T *data, size_t length) : _data(data), _size(length) {
        }

        constexpr array_view(const T *begin, const T *end) : _data(begin), _size(end - begin) {
            assert(begin <= end);
        }

        template <template <class, class...> class V, class... A>
        array_view(const V<T, A...> &vec) : _data(vec.data()), _size(vec.size()) {
        }

        template <size_t N>
        constexpr array_view(const std::array<T, N> &Arr) : _data(Arr.data()), _size(N) {
        }

        template <size_t N>
        constexpr array_view(const T (&Arr)[N]) : _data(Arr), _size(N) {
        }

#if defined(__GNUC__) && __GNUC__ >= 9
// Disable gcc's warning in this constructor as it generates an enormous amount
// of messages. Anyone using ArrayRef(array_view) should already be aware of the fact that
// it does not do lifetime extension.
#  pragma GCC diagnostic push
#  pragma GCC diagnostic ignored "-Winit-list-lifetime"
#endif
        constexpr array_view(std::initializer_list<T> vec)
            : _data(vec.begin() == vec.end() ? (T *) nullptr : vec.begin()), _size(vec.size()) {
        }
#if defined(__GNUC__) && __GNUC__ >= 9
#  pragma GCC diagnostic pop
#endif

        template <typename T1>
        array_view(const array_view<T1 *> &RHS,
                   std::enable_if_t<std::is_convertible<T1 *const *, T const *>::value> * = nullptr)
            : _data(RHS.data()), _size(RHS.size()) {
        }

    public:
        iterator begin() const {
            return _data;
        }
        iterator end() const {
            return _data + _size;
        }
        reverse_iterator rbegin() const {
            return reverse_iterator(end());
        }
        reverse_iterator rend() const {
            return reverse_iterator(begin());
        }
        bool empty() const {
            return _size == 0;
        }
        const T *data() const {
            return _data;
        }
        size_t size() const {
            return _size;
        }

    public:
        const T &front() const {
            assert(!empty());
            return _data[0];
        }
        const T &back() const {
            assert(!empty());
            return _data[_size - 1];
        }
        bool equals(const array_view &RHS) const {
            if (_size != RHS._size)
                return false;
            return std::equal(begin(), end(), RHS.begin());
        }

        /// \name Slicing
        /// @{

        /// Drops the first \a i elements and keeps the \a j that follow.
        ///
        /// \pre <tt>i + j <= size()</tt>
        array_view<T> slice(size_t i, size_t j) const {
            assert(i + j <= size() && "Invalid specifier");
            return array_view<T>(data() + i, j);
        }

        /// Drops the first \a i elements and keeps the rest.
        array_view<T> slice(size_t i) const {
            return drop_front(i);
        }

        /// A view without the first \a i elements.
        ///
        /// \pre <tt>i <= size()</tt>
        array_view<T> drop_front(size_t i = 1) const {
            assert(size() >= i && "Dropping more elements than exist");
            return slice(i, size() - i);
        }

        /// A view without the last \a i elements.
        ///
        /// \pre <tt>i <= size()</tt>
        array_view<T> drop_back(size_t i = 1) const {
            assert(size() >= i && "Dropping more elements than exist");
            return slice(0, size() - i);
        }

        /// A view of the first \a i elements, or all of them if there are fewer.
        array_view<T> take_front(size_t i = 1) const {
            if (i >= size())
                return *this;
            return drop_back(size() - i);
        }

        /// A view of the last \a i elements, or all of them if there are fewer.
        array_view<T> take_back(size_t i = 1) const {
            if (i >= size())
                return *this;
            return drop_front(size() - i);
        }

        /// @}

        /// \name Operator overloads
        /// @{

        const T &operator[](size_t index) const {
            assert(index < _size && "Invalid index!");
            return _data[index];
        }

        /// Assigning a temporary would leave the view dangling, so both of these are deleted.
        ///
        /// The declaration is this involved so that <tt>view = {}</tt> keeps selecting the move
        /// assignment operator.
        template <typename T1>
        std::enable_if_t<std::is_same<T1, T>::value, array_view<T>> &
            operator=(T1 &&Temporary) = delete;

        /// \overload
        template <typename T1>
        std::enable_if_t<std::is_same<T1, T>::value, array_view<T>> &
            operator=(std::initializer_list<T1>) = delete;

        /// @}

        /// A copy of the elements, which the caller then owns.
        std::vector<T> vec() const {
            return std::vector<T>(_data, _data + _size);
        }

    private:
        const T *_data = nullptr;
        size_type _size = 0;
    };


    namespace detail {

        // The comparisons against a container are constrained to leave out array_view itself.
        // Since C++17 relaxed how a template template parameter matches, V binds to array_view
        // with the pack empty, so an array_view on both sides matched the container overload as
        // exactly as the one written for it and partial ordering had nothing to separate them.
        // MSVC picked one and clang called it ambiguous.
        template <class V, class T>
        using enable_if_not_array_view = std::enable_if_t<!std::is_same_v<V, array_view<T>>, int>;

    }

    template <typename T>
    inline bool operator==(array_view<T> LHS, array_view<T> RHS) {
        return LHS.equals(RHS);
    }

    template <template <class, class...> class V, typename T, class... A,
              detail::enable_if_not_array_view<V<T, A...>, T> = 0>
    inline bool operator==(const V<T, A...> &LHS, array_view<T> RHS) {
        return array_view<T>(LHS).equals(RHS);
    }

    template <template <class, class...> class V, typename T, class... A,
              detail::enable_if_not_array_view<V<T, A...>, T> = 0>
    inline bool operator==(array_view<T> LHS, const V<T, A...> &RHS) {
        return LHS.equals(array_view<T>(RHS));
    }

    template <typename T>
    inline bool operator!=(array_view<T> LHS, array_view<T> RHS) {
        return !(LHS == RHS);
    }

    template <template <class, class...> class V, typename T, class... A,
              detail::enable_if_not_array_view<V<T, A...>, T> = 0>
    inline bool operator!=(const V<T, A...> &LHS, array_view<T> RHS) {
        return !(LHS == RHS);
    }

    template <template <class, class...> class V, typename T, class... A,
              detail::enable_if_not_array_view<V<T, A...>, T> = 0>
    inline bool operator!=(array_view<T> LHS, const V<T, A...> &RHS) {
        return !(LHS == RHS);
    }

    /// @}
}

#endif // STDCORELIB_ARRAY_VIEW_H

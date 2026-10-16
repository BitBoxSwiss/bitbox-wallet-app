// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_VLARRAY_H
#define STDCORELIB_VLARRAY_H

#include <algorithm>
#include <cstddef>
#include <initializer_list>
#include <iterator>
#include <memory>
#include <type_traits>
#include <utility>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup containers
    /// @{

    /// The size-agnostic base of \c vlarray.
    ///
    /// Owns the pointer/size/capacity and the allocator, but not the inline buffer, so a single
    /// \c vlarray_base<T> & can refer to a \c vlarray<T, N> of any inline size N. Functions
    /// should take this type by reference.
    template <class T, class Alloc = std::allocator<T>>
    class vlarray_base {
        using AT = std::allocator_traits<Alloc>;

    public:
        using value_type = T;
        using allocator_type = Alloc;
        using size_type = std::size_t;
        using difference_type = std::ptrdiff_t;
        using reference = T &;
        using const_reference = const T &;
        using pointer = T *;
        using const_pointer = const T *;
        using iterator = T *;
        using const_iterator = const T *;
        using reverse_iterator = std::reverse_iterator<iterator>;
        using const_reverse_iterator = std::reverse_iterator<const_iterator>;

        vlarray_base(const vlarray_base &) = delete;
        vlarray_base(vlarray_base &&) = delete;

        vlarray_base &operator=(const vlarray_base &RHS) {
            assign(RHS);
            return *this;
        }
        vlarray_base &operator=(vlarray_base &&RHS) {
            assign(std::move(RHS));
            return *this;
        }

        /// \name Capacity
        /// @{

        [[nodiscard]] bool empty() const {
            return m_size == 0;
        }
        size_type size() const {
            return m_size;
        }
        size_type capacity() const {
            return m_capacity;
        }
        const Alloc &get_allocator() const {
            return m_alloc;
        }

        /// Ensures room for at least \a n elements without changing the size.
        void reserve(size_type n) {
            if (n > m_capacity)
                grow(n);
        }

        /// @}

        /// \name Element access
        /// @{

        reference operator[](size_type i) {
            return m_begin[i];
        }
        const_reference operator[](size_type i) const {
            return m_begin[i];
        }
        reference front() {
            return m_begin[0];
        }
        const_reference front() const {
            return m_begin[0];
        }
        reference back() {
            return m_begin[m_size - 1];
        }
        const_reference back() const {
            return m_begin[m_size - 1];
        }
        pointer data() {
            return m_begin;
        }
        const_pointer data() const {
            return m_begin;
        }

        // clang-format off
        iterator begin() { return m_begin; }
        const_iterator begin() const { return m_begin; }
        const_iterator cbegin() const { return m_begin; }
        iterator end() { return m_begin + m_size; }
        const_iterator end() const { return m_begin + m_size; }
        const_iterator cend() const { return m_begin + m_size; }
        reverse_iterator rbegin() { return reverse_iterator(end()); }
        const_reverse_iterator rbegin() const { return const_reverse_iterator(end()); }
        const_reverse_iterator crbegin() const { return const_reverse_iterator(end()); }
        reverse_iterator rend() { return reverse_iterator(begin()); }
        const_reverse_iterator rend() const { return const_reverse_iterator(begin()); }
        const_reverse_iterator crend() const { return const_reverse_iterator(begin()); }
        // clang-format on

        /// @}

        /// \name Adding elements
        /// @{

        void push_back(const T &value) {
            emplace_back(value);
        }
        void push_back(T &&value) {
            emplace_back(std::move(value));
        }

        /// Constructs an element in place.
        ///
        /// Safe even when the arguments alias an existing element (e.g. \c emplace_back(v[0])): on
        /// a reallocation the new element is built first, while the old buffer is still alive.
        template <class... Args>
        reference emplace_back(Args &&...args) {
            if (m_size == m_capacity) {
                grow_and_emplace_back(std::forward<Args>(args)...);
            } else {
                AT::construct(m_alloc, m_begin + m_size, std::forward<Args>(args)...);
                ++m_size;
            }
            return back();
        }

        template <class InputIt>
        void append(InputIt first, InputIt last) {
            for (; first != last; ++first)
                push_back(*first);
        }

        /// @}

        /// \name Inserting at a position
        ///
        /// Each insert appends the new element(s) at the end and then rotates them into place. The
        /// value is copied before any shifting happens, so inserting an element that lives inside
        /// the array (e.g. \c v.insert(v.begin(),v[3])) is well defined.
        /// @{

        iterator insert(const_iterator pos, const T &value) {
            size_type index = static_cast<size_type>(pos - m_begin);
            push_back(value);
            std::rotate(m_begin + index, m_begin + (m_size - 1), m_begin + m_size);
            return m_begin + index;
        }
        iterator insert(const_iterator pos, T &&value) {
            size_type index = static_cast<size_type>(pos - m_begin);
            push_back(std::move(value));
            std::rotate(m_begin + index, m_begin + (m_size - 1), m_begin + m_size);
            return m_begin + index;
        }

        iterator insert(const_iterator pos, size_type count, const T &value) {
            size_type index = static_cast<size_type>(pos - m_begin);
            if (count == 0)
                return m_begin + index;
            T copy(value); // independent of the array: reserve below may relocate `value`
            reserve(m_size + count);
            for (size_type i = 0; i < count; ++i, ++m_size)
                AT::construct(m_alloc, m_begin + m_size, copy);
            std::rotate(m_begin + index, m_begin + (m_size - count), m_begin + m_size);
            return m_begin + index;
        }

        template <class InputIt, class = std::enable_if_t<!std::is_integral_v<InputIt>>>
        iterator insert(const_iterator pos, InputIt first, InputIt last) {
            size_type index = static_cast<size_type>(pos - m_begin);
            size_type old_size = m_size;
            append(first, last);
            std::rotate(m_begin + index, m_begin + old_size, m_begin + m_size);
            return m_begin + index;
        }

        iterator insert(const_iterator pos, std::initializer_list<T> init) {
            return insert(pos, init.begin(), init.end());
        }

        /// @}

        /// \name Removing elements
        /// @{

        void pop_back() {
            --m_size;
            AT::destroy(m_alloc, m_begin + m_size);
        }

        iterator erase(const_iterator pos) {
            size_type index = static_cast<size_type>(pos - m_begin);
            std::move(m_begin + index + 1, m_begin + m_size, m_begin + index);
            pop_back();
            return m_begin + index;
        }

        iterator erase(const_iterator first, const_iterator last) {
            size_type from = static_cast<size_type>(first - m_begin);
            size_type to = static_cast<size_type>(last - m_begin);
            if (from == to)
                return m_begin + from;
            std::move(m_begin + to, m_begin + m_size, m_begin + from);
            size_type removed = to - from;
            destroy_range(m_size - removed, m_size);
            m_size -= removed;
            return m_begin + from;
        }

        /// Destroys every element but keeps the current buffer.
        void clear() {
            destroy_range(0, m_size);
            m_size = 0;
        }

        void resize(size_type n) {
            if (n < m_size) {
                destroy_range(n, m_size);
            } else if (n > m_size) {
                reserve(n);
                for (; m_size < n; ++m_size)
                    AT::construct(m_alloc, m_begin + m_size);
            }
            m_size = n;
        }
        void resize(size_type n, const T &value) {
            if (n < m_size) {
                destroy_range(n, m_size);
            } else if (n > m_size) {
                reserve(n);
                for (; m_size < n; ++m_size)
                    AT::construct(m_alloc, m_begin + m_size, value);
            }
            m_size = n;
        }

        /// @}

        /// \name Swap
        /// @{

        /// Swaps contents with \a RHS. Two heap-backed arrays just trade buffers. Otherwise the
        /// shared elements are swapped and the longer one's tail is moved over, since neither can
        /// trade away its own inline buffer.
        void swap(vlarray_base &RHS) {
            if (this == &RHS)
                return;

            if (!is_inline() && !RHS.is_inline() && allocators_equal(RHS)) {
                std::swap(m_begin, RHS.m_begin);
                std::swap(m_size, RHS.m_size);
                std::swap(m_capacity, RHS.m_capacity);
                return;
            }

            reserve(RHS.m_size);
            RHS.reserve(m_size);

            size_type shared = std::min(m_size, RHS.m_size);
            for (size_type i = 0; i < shared; ++i)
                std::swap(m_begin[i], RHS.m_begin[i]);

            vlarray_base &longer = (m_size >= RHS.m_size) ? *this : RHS;
            vlarray_base &shorter = (m_size >= RHS.m_size) ? RHS : *this;
            for (size_type i = shared; i < longer.m_size; ++i)
                AT::construct(shorter.m_alloc, shorter.m_begin + i, std::move(longer.m_begin[i]));

            size_type longer_size = longer.m_size;
            longer.destroy_range(shared, longer.m_size);
            longer.m_size = shared;
            shorter.m_size = longer_size;
        }

        /// @}

    protected:
        explicit vlarray_base(const Alloc &alloc) : m_alloc(alloc) {
        }

        // Frees the heap buffer (if any) on the way out. Derived adds no owning members.
        ~vlarray_base() {
            destroy_range(0, m_size);
            if (!is_inline())
                AT::deallocate(m_alloc, m_begin, m_capacity);
        }

        // Registers the derived object's inline buffer. Call once, right after construction.
        void adopt_inline_buffer(T *buffer, size_type capacity) {
            m_begin = buffer;
            m_capacity = capacity;
            m_inline_begin = buffer;
            m_inline_capacity = capacity;
        }

        void assign(const vlarray_base &RHS) {
            if (this == &RHS)
                return;
            clear();
            reserve(RHS.m_size);
            for (m_size = 0; m_size < RHS.m_size; ++m_size)
                AT::construct(m_alloc, m_begin + m_size, RHS.m_begin[m_size]);
        }

        void assign(vlarray_base &&RHS) {
            if (this == &RHS)
                return;
            reset_to_inline();
            bool may_steal = allocators_equal(RHS);
            if constexpr (AT::propagate_on_container_move_assignment::value) {
                m_alloc = std::move(RHS.m_alloc);
                may_steal = true;
            }
            if (!RHS.is_inline() && may_steal) {
                // Steal the heap buffer outright. Its elements come along with it.
                m_begin = RHS.m_begin;
                m_size = RHS.m_size;
                m_capacity = RHS.m_capacity;
                RHS.m_begin = RHS.m_inline_begin;
                RHS.m_capacity = RHS.m_inline_capacity;
                RHS.m_size = 0;
            } else {
                reserve(RHS.m_size);
                for (m_size = 0; m_size < RHS.m_size; ++m_size) {
                    AT::construct(m_alloc, m_begin + m_size, std::move(RHS.m_begin[m_size]));
                }
                if constexpr (AT::propagate_on_container_move_assignment::value) {
                    for (size_type i = 0; i < RHS.m_size; ++i) {
                        AT::destroy(m_alloc, RHS.m_begin + i);
                    }
                    RHS.m_size = 0;
                } else {
                    RHS.clear();
                }
            }
        }

    private:
        bool is_inline() const {
            return m_begin == m_inline_begin;
        }

        bool allocators_equal(const vlarray_base &RHS) const {
            if constexpr (AT::is_always_equal::value) {
                return true;
            } else {
                return m_alloc == RHS.m_alloc;
            }
        }

        void destroy_range(size_type from, size_type to) {
            for (size_type i = from; i < to; ++i)
                AT::destroy(m_alloc, m_begin + i);
        }

        size_type compute_new_capacity(size_type min_capacity) const {
            size_type c = m_capacity * 2;
            if (c < min_capacity)
                c = min_capacity;
            if (c < MinHeapCapacity)
                c = MinHeapCapacity;
            return c;
        }

        // Builds [0, m_size) in dst and destroys nothing, so a throw partway can take back what
        // it built and leave the array as it was. The caller frees dst. Strong for a type that
        // can be copied, since move_if_noexcept then copies; a move-only type is left as
        // std::vector leaves it, destructible and nothing more.
        void construct_range_at(T *dst) {
            size_type built = 0;
#ifdef STDC_HAS_EXCEPTIONS
            try {
#endif
                for (; built < m_size; ++built) {
                    AT::construct(m_alloc, dst + built, std::move_if_noexcept(m_begin[built]));
                }
#ifdef STDC_HAS_EXCEPTIONS
            } catch (...) {
                while (built > 0) {
                    AT::destroy(m_alloc, dst + --built);
                }
                throw;
            }
#endif
        }

        // Grows for reserve(): no new element, the elements just move to a bigger buffer.
        void grow(size_type min_capacity) {
            size_type new_capacity = compute_new_capacity(min_capacity);
            T *new_buffer = AT::allocate(m_alloc, new_capacity);
#ifdef STDC_HAS_EXCEPTIONS
            try {
#endif
                construct_range_at(new_buffer);
#ifdef STDC_HAS_EXCEPTIONS
            } catch (...) {
                AT::deallocate(m_alloc, new_buffer, new_capacity);
                throw;
            }
#endif
            destroy_range(0, m_size);
            if (!is_inline())
                AT::deallocate(m_alloc, m_begin, m_capacity);
            m_begin = new_buffer;
            m_capacity = new_capacity;
        }

        // Grows and appends. The new element is constructed first, before the old buffer is
        // touched, so arguments that reference an existing element stay valid.
        template <class... Args>
        void grow_and_emplace_back(Args &&...args) {
            size_type new_capacity = compute_new_capacity(m_size + 1);
            T *new_buffer = AT::allocate(m_alloc, new_capacity);
#ifdef STDC_HAS_EXCEPTIONS
            try {
#endif
                AT::construct(m_alloc, new_buffer + m_size, std::forward<Args>(args)...);
#ifdef STDC_HAS_EXCEPTIONS
            } catch (...) {
                AT::deallocate(m_alloc, new_buffer, new_capacity);
                throw;
            }
            try {
#endif
                construct_range_at(new_buffer);
#ifdef STDC_HAS_EXCEPTIONS
            } catch (...) {
                AT::destroy(m_alloc, new_buffer + m_size);
                AT::deallocate(m_alloc, new_buffer, new_capacity);
                throw;
            }
#endif
            destroy_range(0, m_size);
            if (!is_inline())
                AT::deallocate(m_alloc, m_begin, m_capacity);
            m_begin = new_buffer;
            m_capacity = new_capacity;
            ++m_size;
        }

        // Destroys the elements and releases any heap buffer, returning to the inline buffer.
        void reset_to_inline() {
            destroy_range(0, m_size);
            if (!is_inline()) {
                AT::deallocate(m_alloc, m_begin, m_capacity);
                m_begin = m_inline_begin;
                m_capacity = m_inline_capacity;
            }
            m_size = 0;
        }

        static constexpr size_type MinHeapCapacity = 4;

        T *m_begin = nullptr;
        size_type m_size = 0;
        size_type m_capacity = 0;
        T *m_inline_begin = nullptr;
        size_type m_inline_capacity = 0;
        STDC_NO_UNIQUE_ADDRESS Alloc m_alloc;
    };

    template <class T, class Alloc>
    inline void swap(vlarray_base<T, Alloc> &LHS, vlarray_base<T, Alloc> &RHS) {
        LHS.swap(RHS);
    }

    template <class T, class Alloc>
    inline bool operator==(const vlarray_base<T, Alloc> &LHS, const vlarray_base<T, Alloc> &RHS) {
        return LHS.size() == RHS.size() && std::equal(LHS.begin(), LHS.end(), RHS.begin());
    }

    template <class T, class Alloc>
    inline bool operator!=(const vlarray_base<T, Alloc> &LHS, const vlarray_base<T, Alloc> &RHS) {
        return !(LHS == RHS);
    }

    /// A dynamic array with N elements of inline (pre-allocated) storage.
    ///
    /// Behaves like a small \c std::vector that stays off the heap until it holds more than N
    /// elements. All the behavior lives in \c vlarray_base<T, Alloc>. This layer only adds the
    /// inline buffer, so a \c vlarray<T, N> binds to \c vlarray_base<T> & regardless of N.
    template <class T, std::size_t N = 4, class Alloc = std::allocator<T>>
    class vlarray : public vlarray_base<T, Alloc> {
        using Base = vlarray_base<T, Alloc>;
        using AllocTraits = std::allocator_traits<Alloc>;

    public:
        using size_type = typename Base::size_type;

        vlarray() : vlarray(Alloc()) {
        }
        explicit vlarray(const Alloc &alloc) : Base(alloc) {
            this->adopt_inline_buffer(inline_data(), N);
        }

        explicit vlarray(size_type size, const Alloc &alloc = Alloc()) : vlarray(alloc) {
            this->resize(size);
        }
        vlarray(size_type size, const T &value, const Alloc &alloc = Alloc()) : vlarray(alloc) {
            this->resize(size, value);
        }

        vlarray(const vlarray &RHS) : vlarray(RHS.get_allocator()) {
            this->assign(RHS);
        }
        vlarray(vlarray &&RHS) noexcept(std::is_nothrow_move_constructible_v<T> &&
                                        std::is_nothrow_copy_constructible_v<Alloc>)
            : vlarray(RHS.get_allocator()) {
            this->assign(std::move(RHS));
        }

        // Cross-size construction: accept any vlarray<T, M> through the common base.
        vlarray(const Base &RHS) : vlarray(RHS.get_allocator()) {
            this->assign(RHS);
        }
        vlarray(Base &&RHS) : vlarray(RHS.get_allocator()) {
            this->assign(std::move(RHS));
        }

        vlarray(std::initializer_list<T> init, const Alloc &alloc = Alloc()) : vlarray(alloc) {
            this->append(init.begin(), init.end());
        }

        template <class InputIt, class = std::enable_if_t<!std::is_integral_v<InputIt>>>
        vlarray(InputIt first, InputIt last, const Alloc &alloc = Alloc()) : vlarray(alloc) {
            this->append(first, last);
        }

        vlarray &operator=(const vlarray &RHS) {
            this->assign(RHS);
            return *this;
        }
        vlarray &operator=(vlarray &&RHS) noexcept(
            std::is_nothrow_move_constructible_v<T> &&
            (!AllocTraits::propagate_on_container_move_assignment::value ||
             std::is_nothrow_move_assignable_v<Alloc>) ) {
            this->assign(std::move(RHS));
            return *this;
        }
        vlarray &operator=(const Base &RHS) {
            this->assign(RHS);
            return *this;
        }
        vlarray &operator=(Base &&RHS) {
            this->assign(std::move(RHS));
            return *this;
        }
        vlarray &operator=(std::initializer_list<T> init) {
            this->clear();
            this->append(init.begin(), init.end());
            return *this;
        }

    private:
        T *inline_data() {
            return reinterpret_cast<T *>(m_buffer);
        }

        // Raw, uninitialized storage for N elements (at least one byte so N == 0 stays valid).
        alignas(T) unsigned char m_buffer[N ? N * sizeof(T) : 1];
    };

    /// @}
}

#endif // STDCORELIB_VLARRAY_H

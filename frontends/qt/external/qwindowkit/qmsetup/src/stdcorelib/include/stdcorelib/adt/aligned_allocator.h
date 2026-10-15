// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_ALIGNED_ALLOCATOR_H
#define STDCORELIB_ALIGNED_ALLOCATOR_H

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <type_traits>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup containers
    /// @{

    /// A stateless STL allocator that gives every allocation a fixed minimum alignment.
    ///
    /// Use it when a container's storage must meet an alignment stricter than its element type
    /// normally requests, such as a SIMD vector or a page-aligned byte buffer.
    ///
    /// \code
    ///     std::vector<float, stdc::aligned_allocator<float, 64>> samples;
    /// \endcode
    ///
    /// \note Alignment must be a power of two, at least alignof(void *), and sufficient for T.
    ///       Rebinding preserves the same alignment.
    template <class T, std::size_t Alignment>
    class aligned_allocator {
        static_assert(Alignment >= alignof(void *), "Alignment must be at least alignof(void *)");
        static_assert((Alignment & (Alignment - 1)) == 0, "Alignment must be a power of two");
        static_assert(Alignment >= alignof(T), "Alignment must satisfy alignof(T)");

    public:
        using value_type = T;
        using pointer = T *;
        using const_pointer = const T *;
        using reference = T &;
        using const_reference = const T &;
        using size_type = std::size_t;
        using difference_type = std::ptrdiff_t;

        using propagate_on_container_move_assignment = std::true_type;
        using is_always_equal = std::true_type;

        constexpr aligned_allocator() noexcept = default;

        template <class U>
        constexpr aligned_allocator(const aligned_allocator<U, Alignment> &) noexcept {
        }

        [[nodiscard]] T *allocate(size_type count) {
            if (count > max_size()) {
                allocationFailed();
            }

            const auto size = count * sizeof(T);
            if constexpr (Alignment > alignof(std::max_align_t)) {
                return static_cast<T *>(::operator new(size, std::align_val_t(Alignment)));
            } else {
                return static_cast<T *>(::operator new(size));
            }
        }

        void deallocate(T *pointer, size_type) noexcept {
            if constexpr (Alignment > alignof(std::max_align_t)) {
                ::operator delete(pointer, std::align_val_t(Alignment));
            } else {
                ::operator delete(pointer);
            }
        }

        constexpr size_type max_size() const noexcept {
            return std::numeric_limits<size_type>::max() / sizeof(T);
        }

        template <class U>
        struct rebind {
            using other = aligned_allocator<U, Alignment>;
        };

    private:
        [[noreturn]] static void allocationFailed() {
#ifdef STDC_HAS_EXCEPTIONS
            throw std::bad_alloc();
#else
            std::abort();
#endif
        }
    };

    template <class T1, std::size_t A1, class T2, std::size_t A2>
    constexpr bool operator==(const aligned_allocator<T1, A1> &,
                              const aligned_allocator<T2, A2> &) noexcept {
        return A1 == A2;
    }

    template <class T1, std::size_t A1, class T2, std::size_t A2>
    constexpr bool operator!=(const aligned_allocator<T1, A1> &lhs,
                              const aligned_allocator<T2, A2> &rhs) noexcept {
        return !(lhs == rhs);
    }

    /// @}
}

#endif // STDCORELIB_ALIGNED_ALLOCATOR_H

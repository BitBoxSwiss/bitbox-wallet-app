// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_ANY_H
#define STDCORELIB_ANY_H

#include <cstddef>
#include <exception>
#include <new>
#include <string_view>
#include <type_traits>
#include <utility>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/adt/type_id.h>

namespace stdc {

    /// \addtogroup containers
    /// @{

    namespace detail {

        /// How much of a value an any carries without reaching for the heap.
        ///
        /// Two pointers holds the things a value of unknown type usually turns out to be: a
        /// number, a flag, a pointer, a small struct of those. Anything wider is a pointer to the
        /// heap, which is what the whole object was before there was a buffer at all.
        constexpr size_t any_buffer_size = 2 * sizeof(void *);

        union any_storage {
            void *heap;
            // Not over aligned on purpose. Aligning the union to max_align_t would round the
            // whole any up to that, and a type needing more than a pointer's alignment can go on
            // the heap instead.
            alignas(void *) unsigned char buffer[any_buffer_size];
        };

        /// Whether a \a T lives in the buffer rather than on the heap.
        ///
        /// Moving an any moves whatever sits in its buffer, so a type that can throw while being
        /// moved would make that operation throw. Those go to the heap, where a move is a pointer
        /// handover and cannot fail.
        template <class T>
        constexpr bool any_fits_inline =
            sizeof(T) <= any_buffer_size && alignof(T) <= alignof(void *) &&
            std::is_nothrow_move_constructible_v<T>;

        template <class T, bool Inline = any_fits_inline<T>>
        struct any_handler;

        template <class T>
        struct any_handler<T, true> {
            template <class Arg>
            static void construct(any_storage &s, Arg &&arg) {
                ::new (static_cast<void *>(s.buffer)) T(std::forward<Arg>(arg));
            }
            static T *value(any_storage &s) noexcept {
                return std::launder(reinterpret_cast<T *>(s.buffer));
            }
            static void destroy(any_storage &s) noexcept {
                value(s)->~T();
            }
            static void copy(const any_storage &from, any_storage &to) {
                construct(to, *value(const_cast<any_storage &>(from)));
            }
            static void move(any_storage &from, any_storage &to) noexcept {
                construct(to, std::move(*value(from)));
                destroy(from);
            }
        };

        template <class T>
        struct any_handler<T, false> {
            template <class Arg>
            static void construct(any_storage &s, Arg &&arg) {
                s.heap = new T(std::forward<Arg>(arg));
            }
            static T *value(any_storage &s) noexcept {
                return static_cast<T *>(s.heap);
            }
            static void destroy(any_storage &s) noexcept {
                delete static_cast<T *>(s.heap);
            }
            static void copy(const any_storage &from, any_storage &to) {
                to.heap = new T(*static_cast<const T *>(from.heap));
            }
            static void move(any_storage &from, any_storage &to) noexcept {
                to.heap = from.heap; // nothing to move, the value never left the heap
                from.heap = nullptr;
            }
        };

        /// Named rather than a lambda in the table below. MSVC leaves a lambda's conversion to
        /// a function pointer out of a constant initializer, and the table then needs a guard.
        template <class T>
        type_id type_of() {
            return type_id::of<T>();
        }

        /// What an any needs to know about the type it is holding.
        ///
        /// One of these per type per module, reached through a pointer that is null exactly when
        /// the any is empty.
        /// No slot for reaching the value. Getting at it is any_cast's business, and any_cast is
        /// a template that already knows the type, so it calls any_handler<T>::value() straight.
        struct any_vtable {
            type_id (*type)();
            void (*destroy)(any_storage &) noexcept;
            void (*copy)(const any_storage &, any_storage &);
            void (*move)(any_storage &, any_storage &) noexcept;
        };

        template <class T>
        const any_vtable &vtable_of() noexcept {
            static const any_vtable table{
                &type_of<T>,
                &any_handler<T>::destroy,
                &any_handler<T>::copy,
                &any_handler<T>::move,
            };
            return table;
        }

    }

    class any;

    template <class T>
    const T *any_cast(const any *value) noexcept;

    template <class T>
    T *any_cast(any *value) noexcept;

    /// Holds a value of any copy constructible type, and remembers which type that was.
    ///
    /// The type is identified by the name the compiler gives it rather than by \c typeid, so this
    /// works with RTTI switched off, and a value keeps its identity across a shared library
    /// boundary where a scheme built on comparing addresses would not. \c std::any is the
    /// standard's answer to the same problem and is a fine choice when neither of those matters.
    ///
    /// \code
    ///   any value = std::string("text");
    ///   if (auto *s = any_cast<std::string>(&value)) {
    ///       use(*s);
    ///   }
    /// \endcode
    ///
    /// \warning Only the exact type comes back out. A value put in as \c Derived cannot be read
    ///          as \c Base, and const and reference qualifiers are stripped on the way in, so an
    ///          \c int and a \c const \c int& are the same type here.
    ///
    /// \note A value of up to two pointers that cannot throw while being moved is kept inside the
    ///       any. Anything else is on the heap. Either way the object is one buffer plus one
    ///       pointer, so a container of them stays small.
    ///
    /// \sa any_cast()
    class any {
    public:
        any() noexcept = default;

        ~any() {
            reset();
        }

        any(const any &RHS) {
            if (RHS._vtable) {
                RHS._vtable->copy(RHS._storage, _storage);
                _vtable = RHS._vtable;
            }
        }

        any(any &&RHS) noexcept {
            adopt(RHS);
        }

        /// Takes a value of any type other than \c any itself.
        ///
        /// The parameter is disabled for \c any so that copying picks the copy constructor, and
        /// for anything an \c any converts to, which would otherwise recurse while the compiler
        /// works out whether that type is copy constructible.
        template <class T, std::enable_if_t<!std::is_same_v<std::decay_t<T>, any> &&
                                                !std::is_convertible_v<any, std::decay_t<T>> &&
                                                std::is_copy_constructible_v<std::decay_t<T>>,
                                            int> = 0>
        any(T &&value) {
            detail::any_handler<std::decay_t<T>>::construct(_storage, std::forward<T>(value));
            _vtable = &detail::vtable_of<std::decay_t<T>>();
        }

        any &operator=(any RHS) noexcept {
            swap(RHS);
            return *this;
        }

        inline bool has_value() const noexcept {
            return _vtable != nullptr;
        }

        inline void reset() noexcept {
            if (_vtable) {
                _vtable->destroy(_storage);
                _vtable = nullptr;
            }
        }

        /// \note Not a pointer swap. A value living in the buffer has to be moved, so this is
        ///       three moves rather than nothing.
        ///
        /// ##QUESTION: Would separate inline and heap paths make this materially cheaper without
        /// complicating the storage invariants?
        ///
        /// \note Written out rather than through the assignment operator, which swaps and would
        ///       call straight back into here.
        void swap(any &RHS) noexcept {
            if (this == &RHS) {
                return;
            }
            any temp;
            temp.adopt(*this);
            adopt(RHS);
            RHS.adopt(temp);
        }

        /// Whether the value in here is a \a T.
        template <class T>
        bool holds() const {
            return _vtable && _vtable->type() == type_id::of<T>();
        }

        /// Which type is in here, or a default \c type_id when there is no value.
        ///
        /// \sa type_id::name(), for the compiler's spelling of it
        inline type_id type() const {
            return _vtable ? _vtable->type() : type_id();
        }

    private:
        // Takes the value out of from, leaving it empty. Only correct on an any that holds
        // nothing itself.
        void adopt(any &from) noexcept {
            if (from._vtable) {
                from._vtable->move(from._storage, _storage);
                _vtable = from._vtable;
                from._vtable = nullptr;
            }
        }

        detail::any_storage _storage{};
        const detail::any_vtable *_vtable = nullptr;

        template <class T>
        friend const T *any_cast(const any *value) noexcept;
        template <class T>
        friend T *any_cast(any *value) noexcept;
    };

    /// \name Reading the value back
    ///
    /// The pointer forms answer with \c nullptr when the type does not match, and are the ones to
    /// reach for. The value form is a convenience for when the type is already known.
    /// @{

    template <class T>
    const T *any_cast(const any *value) noexcept {
        using U = std::decay_t<T>;
        if (!value || !value->holds<U>()) {
            return nullptr;
        }
        return detail::any_handler<U>::value(const_cast<detail::any_storage &>(value->_storage));
    }

    template <class T>
    T *any_cast(any *value) noexcept {
        using U = std::decay_t<T>;
        if (!value || !value->holds<U>()) {
            return nullptr;
        }
        return detail::any_handler<U>::value(value->_storage);
    }

#ifdef STDC_HAS_EXCEPTIONS

    class bad_any_cast : public std::exception {
    public:
        inline const char *what() const noexcept override {
            return "stdc::bad_any_cast";
        }
    };

    /// \throws bad_any_cast when \a value does not hold a \a T
    template <class T>
    T any_cast(const any &value) {
        const auto *held = any_cast<std::remove_cv_t<std::remove_reference_t<T>>>(&value);
        if (!held) {
            throw bad_any_cast();
        }
        return static_cast<T>(*held);
    }

    /// \overload
    template <class T>
    T any_cast(any &value) {
        auto *held = any_cast<std::remove_cv_t<std::remove_reference_t<T>>>(&value);
        if (!held) {
            throw bad_any_cast();
        }
        return static_cast<T>(*held);
    }

#endif

    /// @}

    inline void swap(any &LHS, any &RHS) noexcept {
        LHS.swap(RHS);
    }

    /// @}
}

#endif // STDCORELIB_ANY_H

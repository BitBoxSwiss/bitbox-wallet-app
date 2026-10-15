// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_PIMPL_H
#define STDCORELIB_PIMPL_H

#include <memory>
#include <type_traits>

namespace stdc::pimpl::detail {

    // Unique Data
    template <class T, class T1 = T>
    inline const T *get_impl_helper(const std::unique_ptr<T1> &d) {
        return static_cast<const T *>(d.get());
    }

    template <class T, class T1 = T>
    inline T *get_impl_helper(std::unique_ptr<T1> &d) {
        return static_cast<T *>(d.get());
    }

    // Shared Data
    template <class T, class T1 = T>
    inline const T *get_impl_helper(const std::shared_ptr<T1> &d) {
        return static_cast<const T *>(d.get());
    }

    template <class T, class T1 = T>
    inline T *get_impl_helper(std::shared_ptr<T1> &d) {
        if (d.use_count() > 1) {
            d = std::make_shared<T>(*static_cast<T *>(d.get())); // detach
        }
        return static_cast<T *>(d.get());
    }

    // Raw pointer
    template <class T>
    inline T *get_impl_helper(T *ptr) {
        return ptr;
    }

    template <class T>
    inline const T *get_impl_helper(const T *ptr) {
        return ptr;
    }

    // Used by macros
    template <class ThisType>
    struct get_decl_trait {
        using ImplType = typename std::remove_pointer_t<ThisType>;
        using DeclType = typename ImplType::Decl;
        using type = std::conditional_t<std::is_const_v<ImplType>, const DeclType, DeclType>;
    };

}

#ifndef STDC_PIMPL_IMPL_MEMBER_VAR_NAME
#  define STDC_PIMPL_IMPL_MEMBER_VAR_NAME _impl
#endif

#ifndef STDC_PIMPL_DECL_MEMBER_VAR_NAME
#  define STDC_PIMPL_DECL_MEMBER_VAR_NAME _decl
#endif

#ifndef STDC_PIMPL_IMPL_LOCAL_VAR_NAME
#  define STDC_PIMPL_IMPL_LOCAL_VAR_NAME impl
#endif

#ifndef STDC_PIMPL_DECL_LOCAL_VAR_NAME
#  define STDC_PIMPL_DECL_LOCAL_VAR_NAME decl
#endif

#define stdc_impl_get(T)                                                                           \
    ::stdc::pimpl::detail::get_impl_helper<typename T::Impl>(                                      \
        static_cast<T *>(this)->STDC_PIMPL_IMPL_MEMBER_VAR_NAME)
#define stdc_decl_get(T) static_cast<T *>(STDC_PIMPL_DECL_MEMBER_VAR_NAME)

#define stdc_impl(T) auto &STDC_PIMPL_IMPL_LOCAL_VAR_NAME = *stdc_impl_get(T)
#define stdc_decl(T) auto &STDC_PIMPL_DECL_LOCAL_VAR_NAME = *stdc_decl_get(T)

/// \addtogroup utility
/// @{

/// Declares an \c impl reference to the current object's nested \c Impl object.
///
/// The class stores its implementation in an \c _impl raw pointer, \c std::unique_ptr, or
/// \c std::shared_ptr. The macro declares the reference as \c impl. These names can be changed
/// with \c STDC_PIMPL_IMPL_MEMBER_VAR_NAME and \c STDC_PIMPL_IMPL_LOCAL_VAR_NAME. The reference
/// is const when the member function is const.
///
/// \code
///     class Library {
///     public:
///         bool isLoaded() const;
///
///     private:
///         class Impl;
///         std::unique_ptr<Impl> _impl;
///     };
///
///     class Library::Impl {
///     public:
///         bool loaded = false;
///     };
///
///     bool Library::isLoaded() const {
///         stdc_impl_t;
///         return impl.loaded;
///     }
/// \endcode
#define stdc_impl_t stdc_impl(std::remove_pointer_t<decltype(this)>)

/// Declares a \c decl reference to the public object associated with an implementation object.
///
/// The implementation class names the public type as \c Decl and stores its address in \c _decl.
/// The member and local reference names can be changed with \c STDC_PIMPL_DECL_MEMBER_VAR_NAME
/// and \c STDC_PIMPL_DECL_LOCAL_VAR_NAME. The reference is const when the implementation member
/// function is const.
///
/// \code
///     class Worker {
///     public:
///         void finished();
///     };
///
///     class WorkerImpl {
///     public:
///         using Decl = Worker;
///
///         explicit WorkerImpl(Decl *decl) : _decl(decl) {
///         }
///
///         void notifyFinished() {
///             stdc_decl_t;
///             decl.finished();
///         }
///
///     private:
///         Decl *_decl;
///     };
/// \endcode
#define stdc_decl_t stdc_decl(::stdc::pimpl::detail::get_decl_trait<decltype(this)>::type)

/// @}

#endif // STDCORELIB_PIMPL_H

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_SCOPE_GUARD_H
#define STDCORELIB_SCOPE_GUARD_H

#include <functional>
#include <type_traits>
#include <utility>

#include <stdcorelib/stdc_global.h>

namespace stdc {

    /// \addtogroup utility
    /// @{

    template <class F>
    class scope_guard {
    public:
        explicit scope_guard(F &&f) noexcept(std::is_nothrow_move_constructible_v<F>)
            : m_func(std::move(f)) {
        }

        explicit scope_guard(const F &f) noexcept(std::is_nothrow_copy_constructible_v<F>)
            : m_func(f) {
        }

        scope_guard(scope_guard &&RHS) noexcept(std::is_nothrow_move_constructible_v<F>)
            : m_func(std::move(RHS.m_func)), m_active(std::exchange(RHS.m_active, false)) {
        }

        ~scope_guard() noexcept {
            if (m_active)
                m_func();
        }

        void dismiss() noexcept {
            m_active = false;
        }

    protected:
        F m_func;
        bool m_active = true;

        STDC_DISABLE_COPY(scope_guard)
    };

    template <class F>
    scope_guard(F (&)()) -> scope_guard<F (*)()>;

    /// A scope_guard over \a f, deducing what to hold it as.
    ///
    /// \code
    ///   auto guard = stdc::make_scope_guard([&] { std::fclose(file); });
    ///   ...
    ///   guard.dismiss(); // where the close is no longer wanted
    /// \endcode
    ///
    /// \note Nodiscard, since a guard nobody keeps is destroyed at the end of the full
    ///       expression and runs \a f there rather than at the end of the scope.
    template <typename F>
    [[nodiscard]] scope_guard<typename std::decay<F>::type> make_scope_guard(F &&f) {
        return scope_guard<typename std::decay<F>::type>(std::forward<F>(f));
    }

    /// @}
}

#endif // STDCORELIB_SCOPE_GUARD_H

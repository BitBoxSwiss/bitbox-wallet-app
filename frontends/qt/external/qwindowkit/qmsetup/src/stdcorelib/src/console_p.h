// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_CONSOLE_P_H
#define STDCORELIB_CONSOLE_P_H

#include <string>

#ifdef _WIN32
#  include <stdcorelib/platform/windows/stdc_windows.h>
#endif

#include <stdcorelib/console.h>

namespace stdc::console::detail {

    /// The attribute triple a terminal is in. A default-constructed one is both the state a
    /// terminal starts in and the state sgr_reset_sequence() returns it to.
    struct attributes {
        int style = nostyle;
        int fg = nocolor;
        int bg = nocolor;

        friend bool operator==(const attributes &LHS, const attributes &RHS) {
            return LHS.style == RHS.style && LHS.fg == RHS.fg && LHS.bg == RHS.bg;
        }
        friend bool operator!=(const attributes &LHS, const attributes &RHS) {
            return !(LHS == RHS);
        }
    };

    /// Returns the SGR escape sequence that takes a terminal from \a from to \a to, or an empty
    /// string when there is nothing to write.
    ///
    /// Only attributes that differ are emitted, and only ones being turned *on*: there is no code
    /// for clearing an individual attribute, so a caller that needs to drop one pairs this with
    /// sgr_reset_sequence() and re-applies what should stay. \c black has no code at all.
    STDC_EXPORT std::string sgr_sequence(const attributes &from, const attributes &to);

    /// Returns the sequence that puts a terminal back to its defaults, or an empty string when
    /// \a from already is the default.
    STDC_EXPORT std::string sgr_reset_sequence(const attributes &from);

#ifdef _WIN32
    /// Returns the legacy console attribute word for \a attrs, preserving unspecified colors from
    /// \a initial.
    STDC_EXPORT WORD legacy_attributes(const attributes &attrs, WORD initial);

    /// How many columns a console of these dimensions has.
    ///
    /// The visible window, not \c dwSize, which is the scrollback buffer. A buffer is routinely
    /// much wider than the window it is seen through, and text laid out to it would run off the
    /// side of the screen. Separate from width() so the choice can be checked against dimensions
    /// a test makes up, which is the only way to reach it: a console whose buffer is wider than
    /// its window has to be built to be found, and where the two are equal, as they are under
    /// Windows Terminal, reading either one passes.
    STDC_EXPORT int columns_of(const CONSOLE_SCREEN_BUFFER_INFO &info);
#endif

}

#endif // STDCORELIB_CONSOLE_P_H

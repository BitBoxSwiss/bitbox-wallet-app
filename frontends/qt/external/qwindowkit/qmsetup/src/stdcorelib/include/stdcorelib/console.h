// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_CONSOLE_H
#define STDCORELIB_CONSOLE_H

#include <cstdarg>
#include <cstdio>

#include <stdcorelib/str.h>

namespace stdc {

    /// \addtogroup text
    /// @{

    namespace console {

        /// Text attributes, combined with \c |.
        enum style {
            nostyle = 0x0, ///< no attribute at all
            bold = 0x1,
            italic = 0x2,
            underline = 0x4,
            strikethrough = 0x8,
        };

        /// The eight base colors, each with a brighter variant.
        ///
        /// Unlike \ref style these do not combine. Pass one, not a bitwise or of several.
        /// \c intensified is the exception, being the bit the \c light names already carry.
        enum color {
            nocolor = 0,        ///< leave the terminal's own color alone
            intensified = 0x10, ///< the brightness bit, on its own

            red = 0x1,
            green = 0x2,
            blue = 0x4,
            yellow = red | green,
            purple = red | blue,
            cyan = green | blue,
            white = red | green | blue,
            black = 0x8,
            lightred = intensified | red,
            lightgreen = intensified | green,
            lightblue = intensified | blue,
            lightyellow = intensified | yellow,
            lightpurple = intensified | purple,
            lightcyan = intensified | cyan,
            lightwhite = intensified | white,
            lightblack = intensified | black,
        };

        /// \name Color mode
        /// @{

        /// How styling reaches the target.
        enum color_mode {
            automatic,      ///< decide per target, styling it only when it is a terminal
            never,          ///< never emit styling, whatever the target
            vt,             ///< always emit ANSI escape sequences
            windows_legacy, ///< always drive the Windows console API, meaning \c never elsewhere
        };

        /// Returns the mode the process is set to.
        /// \sa set_color_mode()
        STDC_EXPORT color_mode get_color_mode();

        /// Overrides the mode process wide.
        ///
        /// This is where a \c --color=always or \c NO_COLOR flag belongs.
        ///
        /// \param mode the mode to force, or \c automatic to go back to deciding per target
        /// \note Also drops what has been detected about the targets seen so far. Call this again
        ///       with the current mode after a \c freopen() to force them to be probed anew.
        STDC_EXPORT void set_color_mode(color_mode mode);

        /// Returns the mode that will actually be used for \a file.
        ///
        /// \param file the target to resolve against, which is probed on the first call and
        ///        remembered afterwards
        /// \return one of \c never, \c vt or \c windows_legacy, never \c automatic
        STDC_EXPORT color_mode resolve_color_mode(FILE *file);

        /// @}

        /// \name Geometry
        /// @{

        /// How many columns wide the terminal behind \a file is.
        ///
        /// \param file the target to ask about
        /// \param fallback what to answer when there is no terminal there to ask, which is what
        ///        a pipe and a file get
        /// \note Asked afresh every call rather than remembered, since a terminal is resized
        ///       while the program using it runs.
        /// \note \c COLUMNS wins where it is set, which is how a shell says so and the only say
        ///       a caller has when the output is not going to a terminal at all.
        STDC_EXPORT int width(FILE *file = stdout, int fallback = 80);

        /// How many columns \a utf8 takes up when written to a terminal.
        ///
        /// Neither its length in bytes nor its length in characters: one CJK ideograph occupies
        /// two columns, and a combining mark occupies none.
        STDC_EXPORT int display_width(const std::string_view &utf8);

        /// \overload
        ///
        /// For one code point, so that text can be measured while it is being walked rather than
        /// a character at a time through the string form.
        STDC_EXPORT int display_width(char32_t c);

        /// @}

        /// \name General output
        /// @{

        /// Writes \a buf to \a file with the given attributes, then puts them back.
        ///
        /// The string is taken as UTF-8 and transcoded for a Windows console.
        ///
        /// \param style a bitwise or of \ref style values, or \c nostyle
        /// \param fg one \ref color value, or \c nocolor
        /// \param bg likewise, for the background
        /// \param buf the text, which is written whether or not the attributes are
        /// \param file the target
        /// \return the number of bytes of \a buf written, escape sequences not counted
        /// \note Whether the attributes are emitted at all rests on resolve_color_mode() for
        ///       \a file, so a redirected stream receives the text alone.
        STDC_EXPORT int fputs(int style, int fg, int bg, const char *buf, FILE *file);

        /// \overload
        STDC_EXPORT int fputs(int style, int fg, int bg, const std::string_view &buf, FILE *file);

        /// Like fputs(), to \c stdout and followed by a newline.
        STDC_EXPORT int puts(int style, int fg, int bg, const char *buf);

        /// \overload
        STDC_EXPORT int puts(int style, int fg, int bg, const std::string_view &buf);

        /// Like fputs(), with printf-style formatting.
        STDC_EXPORT int fprintf(int style, int fg, int bg, FILE *file, const char *fmt, ...)
            STDC_PRINTF_FORMAT(5, 6);

        STDC_EXPORT int vfprintf(int style, int fg, int bg, FILE *file, const char *fmt,
                                 va_list args);

        STDC_EXPORT int printf(int style, int fg, int bg, const char *fmt, ...)
            STDC_PRINTF_FORMAT(4, 5);

        STDC_EXPORT int vprintf(int style, int fg, int bg, const char *fmt, va_list args);

        /// Like fputs(), with formatN() placeholders (\c %1, \c %2, ...) rather than printf
        /// conversions.
        /// \sa formatN()
        template <class... Args>
        inline int print(int style, int fg, int bg, const std::string_view &format,
                         Args &&...args) {
            return console::fputs(style, fg, bg, formatN(format, args...), stdout);
        }

        template <class... Args>
        inline int println(int style, int fg, int bg, const std::string_view &format,
                           Args &&...args) {
            return console::puts(style, fg, bg, formatN(format, std::forward<Args>(args)...));
        }

        /// \overload
        inline int println() {
            return std::putchar('\n');
        }

        /// @}

        /// \name Plain output
        /// @{

        /// The same writers with no attributes at all.
        ///
        /// \note Still worth preferring over \c std::fputs on Windows, where the console needs
        ///       UTF-8 text transcoded before it will render.
        inline int u8fputs(const char *buf, FILE *file) {
            return console::fputs(nostyle, nocolor, nocolor, buf, file);
        }

        /// \overload
        inline int u8fputs(const std::string_view &buf, FILE *file) {
            return console::fputs(nostyle, nocolor, nocolor, buf, file);
        }

        inline int u8puts(const char *buf) {
            return console::puts(nostyle, nocolor, nocolor, buf);
        }

        /// \overload
        inline int u8puts(const std::string_view &buf) {
            return console::puts(nostyle, nocolor, nocolor, buf);
        }

        STDC_EXPORT int u8fprintf(FILE *file, const char *fmt, ...) STDC_PRINTF_FORMAT(2, 3);

        STDC_EXPORT int u8vfprintf(FILE *file, const char *fmt, va_list args);

        STDC_EXPORT int u8printf(const char *fmt, ...) STDC_PRINTF_FORMAT(1, 2);

        STDC_EXPORT int u8vprintf(const char *fmt, va_list args);

        template <class... Args>
        inline int u8print(const std::string_view &format, Args &&...args) {
            return u8fputs(formatN(format, std::forward<Args>(args)...), stdout);
        }

        template <class... Args>
        inline int u8println(const std::string_view &format, Args &&...args) {
            return u8puts(formatN(format, std::forward<Args>(args)...));
        }

        /// \overload
        inline int u8println() {
            return std::putchar('\n');
        }

        /// @}

        /// \name Messages
        /// @{

        /// One line each in a conventional color, for programs that want the four usual
        /// severities without picking colors themselves.
        ///
        /// All four go to \c stdout. For severities that route by destination, and for category
        /// filtering, use the logging facility instead.
        ///
        /// \sa formatN(), stdc::Logger
        template <class... Args>
        inline int debug(const std::string_view &format, Args &&...args) {
            return println(nostyle, lightblue, nocolor, format, std::forward<Args>(args)...);
        }

        template <class... Args>
        inline int success(const std::string_view &format, Args &&...args) {
            return println(nostyle, lightgreen, nocolor, format, std::forward<Args>(args)...);
        }

        template <class... Args>
        inline int warning(const std::string_view &format, Args &&...args) {
            return println(nostyle, yellow, nocolor, format, std::forward<Args>(args)...);
        }

        template <class... Args>
        inline int critical(const std::string_view &format, Args &&...args) {
            return println(nostyle, red, nocolor, format, std::forward<Args>(args)...);
        }

        /// @}
    }

    using console::u8printf;
    using console::u8vprintf;
    using console::u8print;
    using console::u8println;

    namespace console {

        /// \name Inline color markup
        /// @{

        /// Writes \a buf, reading \c ${...} as attribute changes rather than as text.
        ///
        /// The alternative to threading \a style, \a fg and \a bg arguments through every call.
        /// A group holds one or more names separated by spaces, and \c $$ writes a literal \c $.
        /// Nested \c ${...} names are not supported and are ignored.
        /// The names are:
        ///   \li a color: \c red, \c green, \c blue, \c yellow, \c purple, \c cyan, \c white,
        ///       \c black or \c nocolor, each also available with a \c light prefix
        ///   \li the same again behind \c @, which sets the background instead of the foreground
        ///   \li a style: \c bold, \c italic, \c underline, \c strikethrough or \c nostyle
        ///   \li \c intensified, or \c \@intensified, to brighten whichever color is in effect
        ///   \li \c reset, or \c clear, to drop back to plain text
        ///
        /// \param buf the text and the markup within it
        /// \param file the target
        /// \return the number of bytes written, the markup and any escape sequences not counted
        /// \note A name that is none of the above is dropped and changes nothing, so a typo
        ///       costs the styling rather than the text.
        /// \note Attributes start out plain on every call and are restored when it returns, so
        ///       they never leak into what is written next.
        ///
        /// \code
        ///   cprintln("${lightgreen}ok ${@blue bold}on blue ${reset}plain, 50$$ off");
        /// \endcode
        ///
        /// \sa fputs(), which takes the same attributes as arguments
        STDC_EXPORT int cfputs(const char *buf, FILE *file);

        /// \overload
        STDC_EXPORT int cfputs(const std::string_view &buf, FILE *file);

        /// Like cfputs(), to \c stdout and followed by a newline.
        STDC_EXPORT int cputs(const char *buf);

        /// \overload
        STDC_EXPORT int cputs(const std::string_view &buf);

        /// Like cfputs(), with printf-style formatting.
        ///
        /// \warning The markup is read after the formatting, so a \c %s expanding to text that
        ///          holds \c ${ or \c $$ has it eaten rather than printed. Write text you do not
        ///          control with u8fprintf() instead.
        STDC_EXPORT int cfprintf(FILE *file, const char *fmt, ...) STDC_PRINTF_FORMAT(2, 3);

        STDC_EXPORT int cvfprintf(FILE *file, const char *fmt, va_list args);

        STDC_EXPORT int cprintf(const char *fmt, ...) STDC_PRINTF_FORMAT(1, 2);

        STDC_EXPORT int cvprintf(const char *fmt, va_list args);

        /// Like cfputs(), with formatN() placeholders (\c %1, \c %2, ...).
        template <class... Args>
        inline int cprint(const std::string_view &format, Args &&...args) {
            return cfputs(formatN(format, std::forward<Args>(args)...), stdout);
        }

        template <class... Args>
        inline int cprintln(const std::string_view &format, Args &&...args) {
            return cputs(formatN(format, std::forward<Args>(args)...));
        }

        /// @}
    }

    using console::cprintf;
    using console::cvprintf;
    using console::cprint;
    using console::cprintln;

    /// @}
}

#endif // STDCORELIB_CONSOLE_H

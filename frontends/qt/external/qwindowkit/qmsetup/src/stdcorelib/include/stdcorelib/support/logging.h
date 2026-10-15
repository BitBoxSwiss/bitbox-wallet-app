// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_LOGGING_H
#define STDCORELIB_LOGGING_H

#include <stdcorelib/str.h>

/// \defgroup logging Logging
///
/// Named categories with per-level switches and Qt-style filter rules.
///
/// \code
///     static stdc::LogCategory lc("app.io");
///
///     lc.stdcWarning("cannot read %1", path);
///     lc.stdcDebugF("offset=%zu", off);   // the printf-style variant
///     stdcInfo("no category in scope, so this goes to the default one");
///
///     lc.setFilterRules("*.debug = false\n"        // silence debug everywhere
///                       "app.io = false\n"         // silence this category
///                       "app.io.warning = true");  // except for its warnings
/// \endcode
///
/// \c Logger::setLogCallback() replaces the sink, which is how records reach a file or a UI instead
/// of the terminal.

namespace stdc {

    /// \addtogroup logging
    /// @{

    class LogContext {
    public:
        inline LogContext() noexcept = default;
        inline LogContext(const char *fileName, int lineNumber, const char *functionName,
                          const char *categoryName) noexcept
            : line(lineNumber), file(fileName), function(functionName), category(categoryName) {
        }

        int line = 0;
        const char *file = nullptr;
        const char *function = nullptr;
        const char *category = nullptr;
    };

    class STDC_EXPORT Logger {
    public:
        enum Level {
            Trace = 1,
            Debug,
            Success,
            Information,
            Warning,
            Critical,
            Fatal,
        };

        inline Logger(LogContext context) : _context(std::move(context)) {
        }

        inline Logger(const char *file, int line, const char *function, const char *category)
            : _context(file, line, function, category) {
        }

        template <class... Args>
        inline void trace(const std::string_view &format, Args &&...args) {
            print(Trace, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        inline void debug(const std::string_view &format, Args &&...args) {
            print(Debug, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        inline void success(const std::string_view &format, Args &&...args) {
            print(Success, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        inline void info(const std::string_view &format, Args &&...args) {
            print(Information, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        inline void warning(const std::string_view &format, Args &&...args) {
            print(Warning, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        inline void critical(const std::string_view &format, Args &&...args) {
            print(Critical, stdc::formatN(format, std::forward<Args>(args)...));
        }

        template <class... Args>
        [[noreturn]] inline void fatal(const std::string_view &format, Args &&...args) {
            print(Fatal, stdc::formatN(format, std::forward<Args>(args)...));
            abort();
        }

        template <class... Args>
        inline void log(int level, const std::string_view &format, Args &&...args) {
            print(level, stdc::formatN(format, std::forward<Args>(args)...));
        }

        void print(int level, const std::string_view &message);

        void printf(int level, const char *fmt, ...);

        [[noreturn]] static void abort();

    public:
        using LogCallback = void (*)(int, const LogContext &, const std::string_view &);

        static LogCallback logCallback();

        /// Replaces the sink every record goes to.
        ///
        /// \param callback the new sink, or \c nullptr to put the built-in one back
        static void setLogCallback(LogCallback callback);

    protected:
        LogContext _context;
    };

    /// A named channel with independently switchable levels, after Qt's \c QLoggingCategory.
    ///
    /// Each category registers itself on construction and picks up whatever filter rules are
    /// already in effect.
    ///
    /// Disabling the fatal level suppresses its record but does not suppress process termination.
    ///
    /// \sa setFilterRules()
    class STDC_EXPORT LogCategory {
    public:
        explicit LogCategory(const char *name);
        ~LogCategory();

        inline const char *name() const {
            return _name;
        }
        inline bool isLevelEnabled(int level) const {
            return levelEnabled[level];
        }
        inline void setLevelEnabled(int level, bool enabled) {
            levelEnabled[level] = enabled;
        }

        using LogCategoryFilter = void (*)(LogCategory *);

        /// The filter in force, which is the default one where none was installed.
        ///
        /// \return never \c nullptr. setLogFilter() takes one to mean the default rather than
        ///         none, so there is no state in which nothing is filtering.
        static LogCategoryFilter logFilter();

        /// Replaces the category filter and re-runs it over every registered category.
        ///
        /// \param filter the new filter, or \c nullptr to restore the default one
        /// \note A custom filter takes over entirely, so setFilterRules() has no effect unless
        ///       that filter chooses to consult the rules itself.
        static void setLogFilter(LogCategoryFilter filter);

        static std::string filterRules();

        /// Installs Qt-style filter rules controlling which levels each category emits.
        ///
        /// Rules are separated by newlines or \c ;, and a \c # starts a comment line. Each rule
        /// reads <tt>category[.level] = true|false</tt>, where:
        ///   \li category may carry a single leading and/or trailing \c * wildcard, and
        ///       otherwise matches exactly
        ///   \li level is one of \c trace, \c debug, \c success, \c info, \c warning,
        ///       \c critical or \c fatal, and omitting it affects every level
        ///
        /// Rules apply in order over an all-enabled baseline, so a later match wins.
        ///
        /// \code
        ///   *.debug = false          // silence debug everywhere
        ///   stdc.io = false          // silence the stdc.io category
        ///   stdc.io.warning = true   // except for its warnings
        /// \endcode
        ///
        /// \note This affects every category in the process, not just this one, despite being a
        ///       member. A malformed rule is skipped rather than reported.
        void setFilterRules(std::string rules);

        static LogCategory &defaultCategory();

        template <int Level, class... Args>
        void log(const char *fileName, int lineNumber, const char *functionName,
                 const std::string_view &format, Args &&...args) const {
            if (isLevelEnabled(Level)) {
                Logger(fileName, lineNumber, functionName, _name)
                    .log(Level, format, std::forward<Args>(args)...);
            }
            if constexpr (Level == stdc::Logger::Fatal) {
                Logger::abort();
            }
        }

        template <int Level, class... Args>
        void logf(const char *fileName, int lineNumber, const char *functionName, const char *fmt,
                  Args &&...args) const {
            if (isLevelEnabled(Level)) {
                Logger(fileName, lineNumber, functionName, _name)
                    .printf(Level, fmt, std::forward<Args>(args)...);
            }
            if constexpr (Level == stdc::Logger::Fatal) {
                Logger::abort();
            }
        }

        inline const LogCategory &stdcGetLogCategory() const {
            return *this;
        }

    protected:
        const char *_name;

        union {
            bool levelEnabled[8];
            uint64_t enabled;
        };
    };

    /// @}
}

/// What the macros below fall back to when no LogCategory is in scope. A category of your own
/// provides a member of the same name, which unqualified lookup finds first.
///
/// \internal
static inline const stdc::LogCategory &stdcGetLogCategory() {
    return stdc::LogCategory::defaultCategory();
}

/// Logs one record at \a LEVEL, tagged with the file, line and function it came from.
///
/// Written on a category it goes to that one, written bare it goes to the default category. The
/// message uses formatN() placeholders (\c %1, \c %2, ...), and the \c F variants below take
/// printf conversions instead.
///
/// \warning This expands to an ordinary call, so the arguments are evaluated whether the level
///          is enabled or not. Unlike Qt's \c qCDebug, which short circuits, anything expensive
///          belongs behind an isLevelEnabled() check of your own.
///
/// \code
///   stdc::LogCategory lc("app.io");
///   lc.stdcWarning("cannot read %1", path);
///   lc.stdcWarningF("cannot read %s", path.c_str());
///
///   stdcWarning("something to say about nothing in particular");
/// \endcode
#define stdcLog(LEVEL, ...)                                                                        \
    stdcGetLogCategory().log<stdc::Logger::LEVEL>(__FILE__, __LINE__, __FUNCTION__, __VA_ARGS__)
#define stdcTrace(...)    stdcLog(Trace, __VA_ARGS__)
#define stdcDebug(...)    stdcLog(Debug, __VA_ARGS__)
#define stdcSuccess(...)  stdcLog(Success, __VA_ARGS__)
#define stdcInfo(...)     stdcLog(Information, __VA_ARGS__)
#define stdcWarning(...)  stdcLog(Warning, __VA_ARGS__)
#define stdcCritical(...) stdcLog(Critical, __VA_ARGS__)
#define stdcFatal(...)    stdcLog(Fatal, __VA_ARGS__)

#define stdcLogF(LEVEL, ...)                                                                       \
    stdcGetLogCategory().logf<stdc::Logger::LEVEL>(__FILE__, __LINE__, __FUNCTION__, __VA_ARGS__)
#define stdcTraceF(...)    stdcLogF(Trace, __VA_ARGS__)
#define stdcDebugF(...)    stdcLogF(Debug, __VA_ARGS__)
#define stdcSuccessF(...)  stdcLogF(Success, __VA_ARGS__)
#define stdcInfoF(...)     stdcLogF(Information, __VA_ARGS__)
#define stdcWarningF(...)  stdcLogF(Warning, __VA_ARGS__)
#define stdcCriticalF(...) stdcLogF(Critical, __VA_ARGS__)
#define stdcFatalF(...)    stdcLogF(Fatal, __VA_ARGS__)

#endif // STDCORELIB_LOGGING_H

// SPDX-License-Identifier: MIT

#include "logging.h"

#include <cassert>
#include <cstdarg>
#include <cstdlib>
#include <optional>
#include <shared_mutex>
#include <mutex>
#include <unordered_set>
#include <vector>

#include "console.h"

#ifdef _WIN32
#  include "stdc_windows.h"
#  ifdef _MSC_VER
#    include <intrin.h>
#  endif
#endif

namespace stdc {

    static void defaultLogCallback(int level, const LogContext &context,
                                   const std::string_view &message);

    static void defaultLogCategoryFilter(LogCategory *category);

    /// A single parsed entry of the filter-rules string. A leading or trailing '*' in the
    /// category pattern is folded into the match mode. A level of 0 means every level.
    struct LoggingRule {
        enum MatchMode {
            Exact,    // "foo"
            Prefix,   // "foo*"
            Suffix,   // "*foo"
            Contains, // "*foo*"
        };

        std::string text; // the pattern with its wildcards stripped
        MatchMode mode = Exact;
        int level = 0;
        bool enable = false;

        bool matchesCategory(const std::string_view &name) const {
            switch (mode) {
                case Prefix:
                    return str::starts_with(name, text);
                case Suffix:
                    return str::ends_with(name, text);
                case Contains:
                    return str::contains(name, text);
                default:
                    return name == text;
            }
        }

        bool appliesToLevel(int lv) const {
            return level == 0 || level == lv;
        }
    };

    /// Returns the level a trailing `.<token>` names, or 0 if it names none.
    static int levelFromToken(const std::string_view &token) {
        if (token == "trace")
            return Logger::Trace;
        if (token == "debug")
            return Logger::Debug;
        if (token == "success")
            return Logger::Success;
        if (token == "info" || token == "information")
            return Logger::Information;
        if (token == "warning")
            return Logger::Warning;
        if (token == "critical")
            return Logger::Critical;
        if (token == "fatal")
            return Logger::Fatal;
        return 0;
    }

    static std::optional<bool> parseBool(const std::string_view &value) {
        std::string v = str::to_lower(std::string(value));
        if (v == "true" || v == "1")
            return true;
        if (v == "false" || v == "0")
            return false;
        return std::nullopt;
    }

    /// Parses one `category[.level] = bool` rule. Returns nothing if the line is malformed.
    static std::optional<LoggingRule> parseRule(const std::string_view &line) {
        auto eq = line.find('=');
        if (eq == std::string_view::npos)
            return std::nullopt;

        std::string_view pattern = str::trim(line.substr(0, eq));
        auto value = parseBool(str::trim(line.substr(eq + 1)));
        if (pattern.empty() || !value)
            return std::nullopt;

        LoggingRule rule;
        rule.enable = *value;

        // A trailing `.<token>` selects a level only when it names one.
        if (auto dot = pattern.rfind('.'); dot != std::string_view::npos) {
            if (int level = levelFromToken(pattern.substr(dot + 1))) {
                rule.level = level;
                pattern = pattern.substr(0, dot);
            }
        }

        bool left = str::starts_with(pattern, '*');
        bool right = str::ends_with(pattern, '*');
        if (left)
            pattern = str::drop_front(pattern);
        if (right && !pattern.empty())
            pattern = str::drop_back(pattern);

        if (left && right)
            rule.mode = LoggingRule::Contains;
        else if (left)
            rule.mode = LoggingRule::Suffix;
        else if (right)
            rule.mode = LoggingRule::Prefix;
        else
            rule.mode = LoggingRule::Exact;

        // Only the ends may carry a wildcard, so a leftover one is unsupported.
        if (str::contains(pattern, '*'))
            return std::nullopt;
        if (rule.mode == LoggingRule::Exact && pattern.empty())
            return std::nullopt;

        rule.text = std::string(pattern);
        return rule;
    }

    /// Parses a whole rules string. Entries are separated by newlines or ';', and a '#' starts a
    /// comment line.
    static std::vector<LoggingRule> parseRules(const std::string_view &rules) {
        std::vector<LoggingRule> result;
        for (const auto &rawLine : str::split(rules, "\n")) {
            for (const auto &rawEntry : str::split(rawLine, ";")) {
                std::string_view entry = str::trim(rawEntry);
                if (entry.empty() || str::starts_with(entry, '#'))
                    continue;
                if (auto rule = parseRule(entry))
                    result.push_back(std::move(*rule));
            }
        }
        return result;
    }

    class LogRegistry {
    public:
        static inline Logger::LogCallback callback = defaultLogCallback;
        static inline LogCategory::LogCategoryFilter categoryFilter = defaultLogCategoryFilter;

        std::string filterRules;
        std::vector<LoggingRule> rules;
        std::shared_mutex mutex;

        std::unordered_set<LogCategory *> categories;

        void updateFilterRules() {
            for (const auto &category : categories) {
                categoryFilter(category);
            }
        }

        static inline LogRegistry *instance() {
            static LogRegistry registry;
            return &registry;
        }
    };

    static void defaultLogCallback(int level, const LogContext &context,
                                   const std::string_view &message) {
        (void) context;

        // The default sink only emits Success and above. Anything lower needs a callback of the
        // caller's own, whatever the category filter says.
        if (level < Logger::Success) {
            return;
        }

        // Information sits above Success in the enum, so it arrives here rather than being
        // dropped above, and print() takes an int that need not be a Level at all. Neither is a
        // reason to lose the message, so anything without a color of its own goes to stdout
        // plain.
        FILE *out = stdout;
        auto color = console::nocolor;
        switch (level) {
            case Logger::Success:
                color = console::lightgreen;
                break;
            case Logger::Warning:
                out = stderr;
                color = console::yellow;
                break;
            case Logger::Critical:
            case Logger::Fatal:
                out = stderr;
                color = console::red;
                break;
            default:
                break;
        }
        console::fputs(console::nostyle, color, console::nocolor, message, out);
    }

    static void defaultLogCategoryFilter(LogCategory *category) {
        // The registry calls this with its lock held, so LogRegistry::rules is read without
        // taking it again.
        auto &reg = *LogRegistry::instance();
        std::string_view name = category->name() ? category->name() : "";

        // Start from the constructor's all-enabled baseline and apply the rules in order, so a
        // later match overrides an earlier one.
        for (int level = Logger::Trace; level <= Logger::Fatal; ++level) {
            category->setLevelEnabled(level, true);
        }
        for (const auto &rule : reg.rules) {
            if (!rule.matchesCategory(name)) {
                continue;
            }
            for (int level = Logger::Trace; level <= Logger::Fatal; ++level) {
                if (rule.appliesToLevel(level)) {
                    category->setLevelEnabled(level, rule.enable);
                }
            }
        }
    }

    void Logger::print(int level, const std::string_view &message) {
        LogRegistry::callback(level, _context, message);
    }

    void Logger::printf(int level, const char *fmt, ...) {
        va_list args;
        va_start(args, fmt);
        std::string message = stdc::vasprintf(fmt, args);
        va_end(args);
        LogRegistry::callback(level, _context, message);
    }

    // https://github.com/qt/qtbase/blob/v6.8.0/src/corelib/global/qassert.cpp#L25
    void Logger::abort() {
#ifdef _WIN32
        // std::abort() is not dependable here. The MSVC runtime routes it through _exit(3) when
        // the abort behavior is _WRITE_ABORT_MSG, which a debug build defaults to, and MinGW's
        // is little more than _exit(3) to begin with. Both of those run the static destructors
        // of objects living in DLLs, which [support.start.term] says must not happen. End the
        // process directly instead.
#  ifdef _MSC_VER
        if (::IsProcessorFeaturePresent(PF_FASTFAIL_AVAILABLE)) {
            __fastfail(FAST_FAIL_FATAL_APP_EXIT);
        }
#  else
        ::RaiseFailFastException(nullptr, nullptr, 0);
#  endif
        ::TerminateProcess(::GetCurrentProcess(), STATUS_FATAL_APP_EXIT);
#else
        std::abort();
#endif
        // Neither branch returns, but the compiler cannot see that through the API.
        std::abort();
    }

    Logger::LogCallback Logger::logCallback() {
        return LogRegistry::callback;
    }

    void Logger::setLogCallback(LogCallback callback) {
        LogRegistry::callback = callback ? callback : defaultLogCallback;
    }

    LogCategory::LogCategory(const char *name) : _name(name) {
        enabled = 0x0101010101010101ULL;

        auto &reg = *LogRegistry::instance();
        std::unique_lock lock(reg.mutex);
        reg.categories.insert(this);
        reg.categoryFilter(this); // rules already in effect apply to the new category
    }

    LogCategory::~LogCategory() {
        auto &reg = *LogRegistry::instance();
        std::unique_lock lock(reg.mutex);
        reg.categories.erase(this);
    }

    LogCategory::LogCategoryFilter LogCategory::logFilter() {
        auto &reg = *LogRegistry::instance();
        std::shared_lock lock(reg.mutex);
        return LogRegistry::categoryFilter;
    }

    void LogCategory::setLogFilter(LogCategoryFilter filter) {
        auto &reg = *LogRegistry::instance();
        std::unique_lock lock(reg.mutex);

        if (!filter)
            filter = defaultLogCategoryFilter;

        LogRegistry::categoryFilter = filter;
        reg.updateFilterRules();
    }

    std::string LogCategory::filterRules() {
        auto &reg = *LogRegistry::instance();
        std::shared_lock lock(reg.mutex);
        return reg.filterRules;
    }

    void LogCategory::setFilterRules(std::string rules) {
        auto &reg = *LogRegistry::instance();
        std::unique_lock lock(reg.mutex);
        reg.rules = parseRules(rules);
        reg.filterRules = std::move(rules);
        reg.updateFilterRules();
    }

    LogCategory &LogCategory::defaultCategory() {
        static LogCategory category("default");
        return category;
    }

}

// SPDX-License-Identifier: MIT

#include "str.h"
#include "str_p.h"

#include "vlarray.h"

#ifdef _WIN32
#  include "winapi.h"
#  include "winextra.h"
#endif

#include <cstring>
#include <cstdarg>

#include "path.h"
#include "utf.h"

namespace stdc {

    namespace str {

        bool varexp_split(const std::string_view &s, vlarray_base<varexp_part> &result) {
            varexp_part buf{
                varexp_part_type::literal,
                s.data(),
                0,
            };
            for (size_t i = 0; i < s.size();) {
                if (s[i] == '$' && i + 1 < s.size()) {
                    if (s[i + 1] == '{') {
                        size_t start = i + 2;
                        size_t j = start;

                        bool nested = false;
                        int braceCount = 1;
                        while (j < s.size() && braceCount > 0) {
                            if (s[j] == '$' && j + 1 < s.size() && s[j + 1] == '{') {
                                braceCount++;
                                nested = true;
                                j += 2;
                                continue;
                            }
                            if (s[j] == '}') {
                                braceCount--;
                            }
                            j++;
                        }

                        if (braceCount != 0) {
                            return false; // Invalid expression
                        }

                        if (buf.size > 0) {
                            result.push_back(buf);
                            buf.size = 0;
                        }
                        result.push_back({
                            nested ? varexp_part_type::nested_variable : varexp_part_type::variable,
                            s.data() + start,
                            j - 1 - start,
                        });
                        buf.data = s.data() + j; // even if j == s.size(), it will be fine
                        buf.type = varexp_part_type::literal;
                        i = j;
                        continue;
                    }
                    if (s[i] == '$') {
                        buf.type = varexp_part_type::literal_with_dollar;
                        buf.size += 2;
                        i += 2;
                    }
                } else {
                    buf.size++;
                    i++;
                }
            }

            if (buf.size > 0) {
                result.push_back(buf);
            }
            return true;
        }

        std::string varexp_post(const std::string_view &s) {
            std::string result;
            result.reserve(s.size());
            for (size_t i = 0; i < s.size(); ++i) {
                if (s[i] == '$' && i + 1 < s.size() && s[i + 1] == '$') {
                    result += '$';
                    ++i;
                } else {
                    result += s[i];
                }
            }
            return result;
        }

    }

    namespace str {

        std::string join(const array_view<std::string> &v, const std::string_view &delimiter) {
            if (v.empty())
                return {};

            size_t length = 0;
            for (const auto &item : v) {
                length += item.size();
            }
            length += delimiter.size() * (v.size() - 1);

            std::string res;
            res.reserve(length);
            for (int i = 0; i < v.size() - 1; ++i) {
                res.append(v[i]);
                res.append(delimiter);
            }
            res.append(v.back());
            return res;
        }

        std::string join(const array_view<std::string_view> &v, const std::string_view &delimiter) {
            if (v.empty())
                return {};

            size_t length = 0;
            for (const auto &item : v) {
                length += item.size();
            }
            length += delimiter.size() * (v.size() - 1);

            std::string res;
            res.reserve(length);
            for (int i = 0; i < v.size() - 1; ++i) {
                res.append(v[i]);
                res.append(delimiter);
            }
            res.append(v.back());
            return res;
        }

        std::vector<std::string_view> split(const std::string_view &s,
                                            const std::string_view &delimiter) {
            std::vector<std::string_view> tokens;
            std::string::size_type start = 0;
            std::string::size_type end = s.find(delimiter);
            while (end != std::string::npos) {
                tokens.push_back(s.substr(start, end - start));
                start = end + delimiter.size();
                end = s.find(delimiter, start);
            }
            tokens.push_back(s.substr(start));
            return tokens;
        }

        std::vector<std::string> split(std::string &&s, const std::string_view &delimiter) {
            std::vector<std::string> tokens;
            std::string::size_type start = 0;
            std::string::size_type end = s.find(delimiter);
            while (end != std::string::npos) {
                tokens.push_back(s.substr(start, end - start));
                start = end + delimiter.size();
                end = s.find(delimiter, start);
            }
            tokens.push_back(s.substr(start));
            return tokens;
        }

        std::wstring conv<std::wstring>::from_utf8(const char *s, int size) {
            return utf::utf8_to_wide(size < 0 ? std::string_view(s) : std::string_view(s, size),
                                     utf::fail);
        }

        std::string conv<std::wstring>::to_utf8(const wchar_t *s, int size) {
            return utf::wide_to_utf8(size < 0 ? std::wstring_view(s) : std::wstring_view(s, size),
                                     utf::fail);
        }

#ifdef _WIN32

        std::wstring conv<std::wstring>::from_ansi(const char *s, int size) {
            std::string_view sv = size < 0 ? std::string_view(s) : std::string_view(s, size);
            if (sv.empty()) {
                return {};
            }
            return winapi::kernel32::MultiByteToWideChar(CP_ACP, MB_ERR_INVALID_CHARS, sv);
        }

        std::string conv<std::wstring>::to_ansi(const wchar_t *s, int size) {
            std::wstring_view sv = size < 0 ? std::wstring_view(s) : std::wstring_view(s, size);
            if (sv.empty()) {
                return {};
            }
            // NOTE: WC_ERR_INVALID_CHARS is only accepted for CP_UTF8 and CP_GB18030. Passing it
            // for any other CP_ACP code page makes WideCharToMultiByte fail with
            // ERROR_INVALID_FLAGS, which would turn every conversion into an empty string.
            return winapi::kernel32::WideCharToMultiByte(CP_ACP, 0, sv);
        }
#endif

        std::string conv<std::filesystem::path>::normalize_separators(const std::string &utf8_path,
                                                                      bool native) {
            std::string res = utf8_path;
#if _WIN32
            if (native) {
                std::replace(res.begin(), res.end(), '/', '\\');
            } else {
                std::replace(res.begin(), res.end(), '\\', '/');
            }
#else
            (void) native;
            std::replace(res.begin(), res.end(), '\\', '/');
#endif
            return res;
        }

        std::string format(const std::string_view &fmt, const array_view<std::string> &args) {
            struct Part {
                const char *data;
                size_t size;
            };
            vlarray<Part, 10> parts;

            const auto &push_back = [&parts](const char *data, size_t size) {
                parts.push_back({data, size});
            };

            auto segment_start = fmt.data();
            auto format_end = fmt.data() + fmt.size();
            const auto &is_end = [format_end](const char *p) {
                return p == format_end; //
            };

            auto p = segment_start;
            while (p != format_end) {
                if (*p == '%' && !is_end(p + 1)) {
                    auto next = *(p + 1);
                    if (next == '%') { // Literal '%'
                        if (p > segment_start) {
                            push_back(segment_start, p - segment_start);
                        }
                        push_back("%", 1); // Add '%'
                        p += 2;
                        segment_start = p; // Skip "%%"
                        continue;
                    }
                    if (is_digit(next)) {
                        int index = next - '0';
                        auto q = p + 2;
                        while (!is_end(q) && is_digit(*q)) {
                            index = index * 10 + (*q - '0');
                            q++;
                        }
                        index--; // %1 -> index 0
                        if (index >= 0 && index < args.size()) {
                            if (p > segment_start) {
                                push_back(segment_start, p - segment_start);
                            }
                            push_back(args[index].data(), args[index].size());
                            segment_start = q;
                        } else {
                            // Invalid index, as literal
                        }
                        p = q;
                        continue;
                    }
                }
                p++;
            }
            if (p > segment_start) {
                push_back(segment_start, p - segment_start); // Add last part
            }

            size_t total_length = 0;
            for (int i = 0; i < parts.size(); i++) {
                total_length += parts[i].size;
            }

            // Construct result
            std::string res;
            res.resize(total_length);

            auto dest = res.data();
            for (int i = 0; i < parts.size(); i++) {
                memcpy(dest, parts[i].data, parts[i].size);
                dest += parts[i].size;
            }
            return res;
        }

        std::string varexp(const std::string_view &s,
                           const std::function<std::string(const std::string_view &)> &find) {
            vlarray<varexp_part, 10> parts;
            if (!varexp_split(s, parts)) {
                return {};
            }

            std::string result;
            for (const auto &part : parts) {
                switch (part.type) {
                    case varexp_part_type::literal:
                    case varexp_part_type::literal_with_dollar:
                        result += std::string_view(part.data, part.size);
                        break;
                    case varexp_part_type::variable:
                        result += find(std::string_view(part.data, part.size));
                        break;
                    case varexp_part_type::nested_variable:
                        result += find(varexp(std::string_view(part.data, part.size), find));
                        break;
                }
            }
            return varexp_post(result);
        }

        std::string asprintf(const char *fmt, ...) {
            va_list args;
            va_start(args, fmt);
            auto result = vasprintf(fmt, args);
            va_end(args);
            return result;
        }

        std::string vasprintf(const char *fmt, va_list args) {
            static constexpr int STACK_BUFFER_SIZE = 4096;

            // A va_list can only be walked once, and the long path below has to walk it again.
            va_list args_copy;
            va_copy(args_copy, args);

            char stack_buffer[STACK_BUFFER_SIZE];
            int len = std::vsnprintf(stack_buffer, STACK_BUFFER_SIZE, fmt, args);
            if (len < 0) {
                va_end(args_copy);
                return {};
            }

            if (len < STACK_BUFFER_SIZE) {
                return std::string(stack_buffer, len);
            }

            // vsnprintf reported how much room it wanted, so the second pass is the last one.
            std::string heap_buffer;
            heap_buffer.resize(len + 1); // the terminator vsnprintf insists on writing
            len = std::vsnprintf(heap_buffer.data(), len + 1, fmt, args_copy);
            heap_buffer.resize(len);

            return heap_buffer;
        }

        // Named for what it does rather than after the C function. MinGW's string.h says
        // "#define strcasecmp _stricmp", so a header declaring one of its own is rewritten or
        // not depending on which include the translation unit saw first: the call does not
        // compile where the declaration was read without the macro, and where both were read
        // with it the symbol is one the library never exported.
        int compare_insensitive(const std::string_view &LHS, const std::string_view &RHS) {
            size_t shared = (std::min) (LHS.size(), RHS.size());
            for (size_t i = 0; i < shared; ++i) {
                // As unsigned, or a byte above 0x7F sorts before every letter where char is
                // signed.
                auto a = static_cast<unsigned char>(to_lower(LHS[i]));
                auto b = static_cast<unsigned char>(to_lower(RHS[i]));
                if (a != b) {
                    return a < b ? -1 : 1;
                }
            }
            if (LHS.size() == RHS.size()) {
                return 0;
            }
            return LHS.size() < RHS.size() ? -1 : 1;
        }

    }

#ifdef _WIN32
    struct windows_utf8_category_impl : std::error_category {
    public:
        const char *name() const noexcept override {
            return "system_utf8";
        }

        std::string message(int ev) const override {
            return wstring_conv::to_utf8(windows::systemError(ev, 0));
        }

        std::error_condition default_error_condition(int ev) const noexcept override {
            return std::system_category().default_error_condition(ev);
        }

        bool equivalent(int ev, const std::error_condition &cond) const noexcept override {
            return std::system_category().equivalent(ev, cond);
        }

        bool equivalent(const std::error_code &code, int ev) const noexcept override {
            return std::system_category().equivalent(code, ev);
        }
    };

    const std::error_category &windows_utf8_category() noexcept {
        static windows_utf8_category_impl instance;
        return instance;
    }
#endif

}

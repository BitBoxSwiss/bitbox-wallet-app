// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_PATH_H
#define STDCORELIB_PATH_H

#include <string>
#include <filesystem>

#include <stdcorelib/str.h>

namespace stdc {

    /// \addtogroup platform
    /// @{

    namespace path {

        /// Builds a path from UTF-8.
        ///
        /// \note \c std::filesystem::path reads a narrow string in the ANSI code page on
        ///       Windows, which mangles anything outside it. Go through here instead.
        inline std::filesystem::path from_utf8(const std::string_view &s) {
#ifdef _WIN32
            return wstring_conv::from_utf8(s);
#else
            return s;
#endif
        }

        /// The other direction. \c path::string() is the lossy one on Windows, for the same
        /// reason.
        inline std::string to_utf8(const std::filesystem::path &path) {
#ifdef _WIN32
            return wstring_conv::to_utf8(path.wstring());
#else
            return path.string();
#endif
        }

        inline std::string to_utf8(const std::filesystem::path::string_type &path) {
#ifdef _WIN32
            return wstring_conv::to_utf8(path);
#else
            return path;
#endif
        }

        /// \c std::filesystem::canonical without the throw.
        ///
        /// \return the resolved path, or an empty one on failure
        /// \pre \a path exists. This one reads the file system and resolves symlinks.
        /// \sa clean_path(), which does not
        inline std::filesystem::path canonical(const std::filesystem::path &path) {
            std::error_code ec;
            return std::filesystem::canonical(path, ec);
        }

        /// Resolves <tt>\.</tt> and <tt>\.\.</tt> lexically, without reading the file system, so
        /// it works on a path that does not exist.
        ///
        /// \warning A symlink followed by \c .. therefore lands somewhere canonical() would not,
        ///          since the lexical answer ignores where the link actually pointed.
        STDC_EXPORT std::filesystem::path clean_path(const std::filesystem::path &path);

        /// Rewrites the separators as \c /, or as the platform's own when \a native is set.
        inline std::string normalize_separators(const std::filesystem::path &path,
                                                bool native = false) {
            return str::conv<std::filesystem::path>::normalize_separators(to_utf8(path), native);
        }

    }

    using path::clean_path;
    using path::normalize_separators;

    /// @}
}

#endif // STDCORELIB_PATH_H

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_SYSTEMPATHS_H
#define STDCORELIB_SYSTEMPATHS_H

#include <filesystem>
#include <optional>

#include <stdcorelib/stdc_global.h>

namespace stdc::system {

    /// \addtogroup platform
    /// @{

    /// Finds the user-level directories where applications normally store files.
    class STDC_EXPORT SystemPaths {
    public:
        /// The small set of writable directories shared by the supported desktop platforms.
        enum Directory {
            HomeDirectory,    ///< The current user's home directory.
            TempDirectory,    ///< Files that can be discarded after use.
            ConfigDirectory,  ///< User-level application configuration.
            AppDataDirectory, ///< Persistent user-level application data.
            CacheDirectory,   ///< Data that an application can regenerate.
            StateDirectory,   ///< Persistent state that is neither configuration nor main data.
        };

        /// Returns the writable base directory for \a directory.
        ///
        /// The result does not include an organization or application name. The function does
        /// not create the directory, and a valid result need not exist yet.
        ///
        /// \return an absolute native path, or empty when the operating system cannot provide one
        static std::optional<std::filesystem::path> writableDirectory(Directory directory);

    private:
        SystemPaths() = delete;
    };

    /// @}

}

#endif // STDCORELIB_SYSTEMPATHS_H

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_SHAREDLIBRARY_H
#define STDCORELIB_SHAREDLIBRARY_H

#include <memory>
#include <filesystem>
#include <system_error>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/flags.h>

namespace stdc {

    /// \addtogroup process
    /// @{

    /// Loads a shared library at run time and resolves symbols from it. \c LoadLibraryEx on
    /// Windows, \c dlopen elsewhere.
    ///
    /// The library is unloaded when the object goes away, unless release() has given up
    /// ownership of the handle.
    ///
    /// \code
    ///   SharedLibrary lib;
    ///   if (!lib.open("/usr/lib/x86_64-linux-gnu/libc.so.6")) {
    ///       return lib.errorMessage();
    ///   }
    ///   auto fn = reinterpret_cast<void *(*) (size_t)>(lib.resolve("malloc"));
    /// \endcode
    class STDC_EXPORT SharedLibrary {
    public:
        SharedLibrary();
        ~SharedLibrary();

        SharedLibrary(SharedLibrary &&RHS) noexcept;
        SharedLibrary &operator=(SharedLibrary &&RHS) noexcept;

    public:
        /// Passed to open(). Most of these name a \c dlopen flag, one or two name what the
        /// platform's own loader is asked for instead, and any of them is ignored where the
        /// platform has nothing to ask.
        enum LoadHint {
            /// Resolves all undefined symbols while loading the library. Maps to \c RTLD_NOW
            /// on POSIX.
            ResolveAllSymbolsHint = 0x01,
            /// Makes the library's symbols available to libraries loaded later. Maps to
            /// \c RTLD_GLOBAL on POSIX.
            ExportExternalSymbolsHint = 0x02,
            /// Reserved for loading a member of an archive library. Currently ignored.
            LoadArchiveMemberHint = 0x04,
            /// Keeps the library loaded for the life of the process. Uses \c RTLD_NODELETE on
            /// POSIX and pins the module on Windows. Without a safe loader flag, as on macOS,
            /// open() calls release() after loading succeeds. Pinning failure does not fail open().
            PreventUnloadHint = 0x08,
            /// Prefers this library's symbols over previously loaded global symbols when
            /// resolving references. Maps to \c RTLD_DEEPBIND where available.
            DeepBindHint = 0x10,
            /// Searches the directory the library sits in while resolving its own dependencies,
            /// which is what a plugin keeping its private libraries beside it needs. Windows only,
            /// asking for \c LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR.
            SearchLibraryLoadDirectoryHint = 0x20,
        };
        STDC_DECLARE_FLAGS(LoadHints, LoadHint)

    public:
        /// \name Loading
        /// @{

        /// Loads \a path.
        ///
        /// \param path the library to load
        /// \param hints what to ask the loader for
        /// \retval false nothing was loaded, with the reason in errorMessage()
        /// \note An object that is already open is left alone and this fails, so close() first
        ///       to swap one library for another.
        bool open(const std::filesystem::path &path, LoadHints hints = {});

        /// Unloads the library.
        ///
        /// \note The OS only really unloads it once the last user has let go, so code and
        ///       statics from it may well still be mapped afterwards.
        bool close();

        /// The address exported under \a name.
        ///
        /// \return the symbol's address, or null with the reason in errorMessage()
        /// \pre The library is open.
        void *resolve(const char *name) const;

        /// Gives up ownership, so the destructor will not unload.
        ///
        /// \note The handle stays valid and nobody will close it, which is the point and also
        ///       the leak if that was not intended.
        void release();

        /// @}

    public:
        /// \name Failures
        ///
        /// Both answer for whichever operation ran last, and both are cleared as the next one
        /// begins.
        /// @{

        /// The reason the last operation on this object failed, or empty if it succeeded.
        ///
        /// Captured where the failure happened rather than read from the system on demand, so
        /// nothing that ran in between can have overwritten it.
        std::string errorMessage() const;

        /// The same failure as a code.
        ///
        /// \note The \c dl functions report no code, so a failed open() is answered from the
        ///       path instead. A symbol that is not there has no path to ask, and is reported
        ///       in words alone.
        std::error_code errorCode() const;

        /// @}

    public:
        /// \name Properties
        /// @{

        bool isOpen() const;

        /// The path this was opened with, empty if it is not open.
        std::filesystem::path path() const;

        /// The underlying \c HMODULE or \c dlopen handle, for the platform calls this class does
        /// not wrap.
        void *handle() const;

        /// @}

    public:
        /// \name Paths
        ///
        /// What can be asked or said about where a library is, without one being open.
        /// @{

        /// Whether \a path has a suffix this platform can load: \c .dll on Windows, \c .dylib on
        /// macOS, and \c .so with an optional numeric version behind it elsewhere.
        ///
        /// \note This reads the name only. It says nothing about whether the file exists or is
        ///       loadable.
        static bool isLibrary(const std::filesystem::path &path);

        /// Where the system should look for a library's own dependencies, as far as each
        /// system lets that be said at run time. This is not one behavior with three spellings,
        /// so what it is worth is written out per platform.
        ///
        /// \li <b>Windows</b>: \c SetDllDirectoryW. Every \c LoadLibrary this process makes
        ///     afterwards looks here, which is what lets a plugin outside the usual directories
        ///     find the libraries next to it. This is the case the function was written for.
        /// \li <b>Linux</b>: \c LD_LIBRARY_PATH is set, and the loader read it once when the
        ///     process started. So this <b>does not change where this process looks</b>. What
        ///     it changes is the environment a child inherits, which is worth something and is
        ///     not what the name suggests. Measured, not assumed: a library whose dependency
        ///     sits only in the new directory still fails to load after this returns, and the
        ///     same binary loads it when the variable was set before it started.
        /// \li <b>macOS</b>: \c DYLD_LIBRARY_PATH is set. This <b>does not change where this
        ///     process looks</b>. Like Linux, it only changes the environment a child inherits.
        ///     Measured with a dependent library that failed after a run time call and loaded
        ///     when the same path was present at process startup.
        ///
        /// A plugin that has to find its own neighbors on every platform wants an rpath of
        /// \c $ORIGIN or <tt>\@loader_path</tt>, which is a property of the plugin rather than
        /// anything a caller can set from here.
        ///
        /// \return what was set before, so it can be put back. An empty path unsets the
        ///         variable rather than setting it to nothing, so putting back what a process
        ///         that never had one hands out leaves it without one.
        static std::filesystem::path setLibraryPath(const std::filesystem::path &path);

        /// The path of the library that \a addr falls inside, which answers where a given
        /// function came from.
        ///
        /// \sa resolve()
        static std::filesystem::path locateLibraryPath(const void *addr);

        /// @}

    protected:
        class Impl;
        std::unique_ptr<Impl> _impl;
    };

    STDC_DECLARE_OPERATORS_FOR_FLAGS(SharedLibrary::LoadHints)

    /// @}
}

#endif // STDCORELIB_SHAREDLIBRARY_H

// SPDX-License-Identifier: MIT

#include "sharedlibrary.h"

#include <algorithm>
#include <tuple>

#ifdef _WIN32
#  include "winapi.h"
#  include "winextra.h"
#else
#  include <dlfcn.h>
#  include <limits.h>
#  include <string.h>

// dyld can keep an image mapped after dlclose(), but Objective-C plugins can then run in an
// unsafe half-unloaded state. Retain the loader reference instead, as Qt does on Darwin.
#  ifdef __APPLE__
#    undef RTLD_NODELETE
#  endif
#endif

#include "str.h"
#include "pimpl.h"

#ifdef __APPLE__
#  define PRIOR_LIBRARY_PATH_KEY "DYLD_LIBRARY_PATH"
#else
#  define PRIOR_LIBRARY_PATH_KEY "LD_LIBRARY_PATH"
#endif

namespace fs = std::filesystem;

namespace stdc {

    class SharedLibrary::Impl {
    public:
        void *hDll = nullptr;
        fs::path path;

        bool released = false;

        // Why the last operation failed, captured where it failed. Cleared at the start of
        // every operation, so it never outlives the call it belongs to.
        //
        // The system error has to be read at the point of failure rather than later: on Windows
        // GetLastError() is thread global and any call in between overwrites it, and dlerror()
        // clears itself as soon as it is read.
        mutable std::string error;
        mutable std::error_code errorCode;

        ~Impl();

        static inline int nativeLoadHints(LoadHints loadHints);
        static void clearSysError();

        void clearError() const {
            error.clear();
            errorCode.clear();
        }
        void captureSysError(const fs::path *file) const;

        /// Loads \a file and, only where that worked, records what was loaded.
        bool open(const fs::path &file, LoadHints hints);
        bool close();
        void *resolve(const char *name) const;
    };

    SharedLibrary::Impl::~Impl() {
        // What release() is for. Impl::close() is the unload itself and asks nothing, so an
        // object destroyed after release() used to unload anyway, and the flag only did
        // anything for a caller who went on to call the public close() as well.
        if (released) {
            return;
        }
        std::ignore = close();
    }

    inline int SharedLibrary::Impl::nativeLoadHints(LoadHints loadHints) {
#ifdef _WIN32
        return 0;
#else
        int dlFlags = 0;
        if (loadHints.test_flag(ResolveAllSymbolsHint)) {
            dlFlags |= RTLD_NOW;
        } else {
            dlFlags |= RTLD_LAZY;
        }
        if (loadHints.test_flag(ExportExternalSymbolsHint)) {
            dlFlags |= RTLD_GLOBAL;
        }
#  if !defined(Q_OS_CYGWIN)
        else {
            dlFlags |= RTLD_LOCAL;
        }
#  endif
#  if defined(RTLD_DEEPBIND)
        if (loadHints.test_flag(DeepBindHint)) {
            dlFlags |= RTLD_DEEPBIND;
        }
#  endif
#  if defined(RTLD_NODELETE)
        // The POSIX half of PreventUnloadHint, which used to be dropped here. glibc has this,
        // so a Linux caller asking for it was not being told the platform had no equivalent,
        // it was being ignored.
        if (loadHints.test_flag(PreventUnloadHint)) {
            dlFlags |= RTLD_NODELETE;
        }
#  endif
        return dlFlags;
#endif
    }

#ifdef _WIN32
    /// Turns a failure to load into an error code for the duration of one call.
    ///
    /// LoadLibraryW answers a file that is not a PE image with a modal dialog rather than with a
    /// return value, and a program with nobody at the keyboard waits on it forever. Measured: a
    /// CI job sat on one for sixteen minutes before it was cancelled.
    ///
    /// \note The mode belongs to this thread only, so nothing else in the process is affected
    ///       while a library is being loaded.
    class ImageDialogGuard {
    public:
        ImageDialogGuard() {
            _restore = ::SetThreadErrorMode(SEM_FAILCRITICALERRORS | SEM_NOOPENFILEERRORBOX,
                                            &_previous) != 0;
        }

        ~ImageDialogGuard() {
            if (_restore) {
                std::ignore = ::SetThreadErrorMode(_previous, nullptr);
            }
        }

    private:
        DWORD _previous = 0;
        bool _restore = false;

        STDC_DISABLE_COPY_MOVE(ImageDialogGuard)
    };
#endif

    // Run before a call whose failure we want to report, so that what captureSysError() reads
    // afterwards belongs to that call. dlerror() holds whatever the last dl call left and hands
    // it to whoever asks first, and GetLastError() is not cleared on success.
    void SharedLibrary::Impl::clearSysError() {
#ifdef _WIN32
        ::SetLastError(ERROR_SUCCESS);
#else
        std::ignore = dlerror();
#endif
    }

    // The code and the sentence for one failure, taken together so they describe the same call.
    //
    // Windows reports a code. The dl functions report a sentence and leave errno alone, measured
    // rather than assumed, so a code has to come from the file itself. One stat on a path that
    // already failed answers three of the four cases. A symbol has no file to ask about.
    void SharedLibrary::Impl::captureSysError(const fs::path *file) const {
#ifdef _WIN32
        (void) file;
        // Not system_category, whose message() goes through FormatMessageA and arrives in the
        // machine's code page. This one is UTF-8 and defers every comparison to it anyway.
        errorCode = std::error_code(int(::GetLastError()), windows_utf8_category());
        error = errorCode.message();
#else
        auto reported = dlerror();
        error = reported ? reported : std::string();
        errorCode = {};
        if (!file) {
            return;
        }
        std::error_code ec;
        auto status = fs::status(*file, ec);
        if (ec || !fs::exists(status)) {
            errorCode = std::make_error_code(std::errc::no_such_file_or_directory);
        } else if (fs::is_directory(status)) {
            errorCode = std::make_error_code(std::errc::is_a_directory);
        } else if ((status.permissions() & fs::perms::owner_read) == fs::perms::none) {
            errorCode = std::make_error_code(std::errc::permission_denied);
        } else {
            errorCode = std::make_error_code(std::errc::executable_format_error);
        }
#endif
    }

    bool SharedLibrary::Impl::open(const fs::path &file, LoadHints hints) {
        std::error_code ec;
        auto absPath = fs::absolute(file, ec);
        if (ec) {
            error = ec.message();
            errorCode = ec;
            return false;
        }
#ifdef _WIN32
        // MinGW's filesystem::absolute() preserves forward slashes from a CMake target path.
        // LoadLibraryExW can open that path, but LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR then fails to
        // derive the directory used to find its dependencies. The native separators make both
        // parts of the operation agree on the directory.
        absPath.make_preferred();
#endif
        clearSysError();

#ifdef _WIN32
        ImageDialogGuard noDialog;
#endif
        auto handle =
#ifdef _WIN32
            // Asking for any LOAD_LIBRARY_SEARCH_* flag turns the standard search order off
            // whole, so the default directories have to be named again beside the one being
            // added. Without the hint this stays LoadLibraryW, since the two do not search the
            // same places and a caller that asked for nothing gets what it always got.
            hints.test_flag(SearchLibraryLoadDirectoryHint)
                ? ::LoadLibraryExW(absPath.c_str(), nullptr,
                                   LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR |
                                       LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)
                : ::LoadLibraryW(absPath.c_str())
#else
            dlopen(absPath.c_str(), Impl::nativeLoadHints(hints))
#endif
            ;
        if (!handle) {
            captureSysError(&absPath);
            return false;
        }

#ifdef _WIN32
        if (hints.test_flag(PreventUnloadHint)) {
            // prevent the unloading of this component
            HMODULE hmod;
            std::ignore = ::GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_PIN |
                                                   GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                                               reinterpret_cast<const wchar_t *>(handle), &hmod);
        }
#endif

        hDll = handle;
        if (auto resolved = fs::canonical(absPath, ec); !ec) {
            path = resolved;
        } else {
            path = absPath;
        }
        return true;
    }

    bool SharedLibrary::Impl::close() {
        if (!hDll) {
            return true;
        }
        clearSysError();

        if (!
#ifdef _WIN32
            ::FreeLibrary(reinterpret_cast<HMODULE>(hDll))
#else
            (dlclose(hDll) == 0)
#endif
        ) {
            captureSysError(nullptr);
            return false;
        }

        hDll = nullptr;
        return true;
    }

    void *SharedLibrary::Impl::resolve(const char *name) const {
        if (!hDll) {
            return nullptr;
        }
        clearSysError();

        auto addr =
#ifdef _WIN32
            ::GetProcAddress(reinterpret_cast<HMODULE>(hDll), name)
#else
            dlsym(hDll, name)
#endif
            ;
        if (!addr) {
            captureSysError(nullptr);
        }
        return reinterpret_cast<void *>(addr);
    }

    SharedLibrary::SharedLibrary() : _impl(new Impl()) {
    }

    SharedLibrary::~SharedLibrary() = default;

    SharedLibrary::SharedLibrary(SharedLibrary &&RHS) noexcept = default;

    SharedLibrary &SharedLibrary::operator=(SharedLibrary &&RHS) noexcept = default;

    bool SharedLibrary::open(const fs::path &path, LoadHints hints) {
        stdc_impl_t;
        impl.clearError();
        if (impl.hDll) {
            impl.error = "library already open";
            impl.errorCode = std::make_error_code(std::errc::device_or_resource_busy);
            return false;
        }
        if (!impl.open(path, hints)) {
            return false;
        }
#if !defined(_WIN32) && !defined(RTLD_NODELETE)
        // There is no safe loader flag to request, so retain the dlopen reference instead.
        if (hints.test_flag(PreventUnloadHint)) {
            release();
        }
#endif
        return true;
    }

    bool SharedLibrary::close() {
        stdc_impl_t;
        impl.clearError();
        if (impl.released) {
            impl.released = false;
            impl.hDll = nullptr;
            impl.path.clear();
            return true;
        }
        if (impl.close()) {
            impl.path.clear();
            return true;
        }
        return false;
    }

    void *SharedLibrary::resolve(const char *name) const {
        stdc_impl_t;
        impl.clearError();
        if (!impl.hDll) {
            impl.error = "library not open";
            impl.errorCode = std::make_error_code(std::errc::operation_not_permitted);
            return nullptr;
        }
        return impl.resolve(name);
    }

    void SharedLibrary::release() {
        stdc_impl_t;
        impl.released = true;
    }

    std::string SharedLibrary::errorMessage() const {
        stdc_impl_t;
        return impl.error;
    }

    std::error_code SharedLibrary::errorCode() const {
        stdc_impl_t;
        return impl.errorCode;
    }

    bool SharedLibrary::isOpen() const {
        stdc_impl_t;
        return impl.hDll != nullptr;
    }

    fs::path SharedLibrary::path() const {
        stdc_impl_t;
        return impl.path;
    }

    void *SharedLibrary::handle() const {
        stdc_impl_t;
        return impl.hDll;
    }

#if !defined(_WIN32) && !defined(__APPLE__)
    static bool checkVersionSuffix(const std::string_view &suffix) {
        if (suffix.empty() || suffix.front() == '.' || suffix.back() == '.') {
            return false;
        }
        size_t start = 0;
        while (start < suffix.size()) {
            size_t dotPos = suffix.find('.', start);
            std::string_view part;
            if (dotPos == std::string::npos) {
                part = suffix.substr(start);
                start = suffix.size();
            } else {
                part = suffix.substr(start, dotPos - start);
                start = dotPos + 1;
            }
            if (part.empty() ||
                !std::all_of(part.begin(), part.end(), [](char c) { return str::is_digit(c); })) {
                return false;
            }
        }
        return true;
    }
#endif

    bool SharedLibrary::isLibrary(const fs::path &path) {
#if defined(_WIN32)
        return str::ends_with(path.wstring(), L".dll", true);
#elif defined(__APPLE__)
        return str::ends_with(path.string(), ".dylib", true);
#else
        auto fileName = path.string();
        size_t soPos;
        if (fileName.size() >= 3 && (soPos = fileName.rfind(".so")) != std::string::npos) {
            // Whatever follows the .so, which is either nothing or a version.
            std::string_view suffix = std::string_view(fileName).substr(soPos + 3);
            if (suffix.empty()) {
                return true; // plain .so
            }
            return suffix.front() == '.' && suffix.size() > 1 &&
                   checkVersionSuffix(suffix.substr(1));
        }
        return false;
#endif
    }

    fs::path SharedLibrary::setLibraryPath(const fs::path &path) {
#ifdef _WIN32
        std::wstring org = winapi::kernel32::GetDllDirectoryW();
        std::ignore = ::SetDllDirectoryW(path.c_str());
#else
        std::string org;
        if (const char *env = std::getenv(PRIOR_LIBRARY_PATH_KEY); env) {
            org = env;
        }
        // An empty path takes the variable away rather than setting it to nothing. A process
        // that started without one hands back an empty path here, and handing that back was
        // the one thing a caller does with what this returns, so the two have to agree.
        if (path.empty()) {
            if (unsetenv(PRIOR_LIBRARY_PATH_KEY) != 0) {
                return {};
            }
        } else if (setenv(PRIOR_LIBRARY_PATH_KEY, path.string().c_str(), 1) != 0) {
            return {};
        }
#endif
        return org;
    }

    fs::path SharedLibrary::locateLibraryPath(const void *addr) {
#ifdef _WIN32
        HMODULE hModule = nullptr;
        if (!::GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                                      GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                                  (LPCWSTR) addr, &hModule)) {
            return {};
        }
        return winapi::kernel32::GetModuleFileNameW(hModule);
#else
        Dl_info dl_info{};
        if (!addr || dladdr(const_cast<void *>(addr), &dl_info) == 0 || !dl_info.dli_fname) {
            return {};
        }
        return dl_info.dli_fname;
#endif
    }

}

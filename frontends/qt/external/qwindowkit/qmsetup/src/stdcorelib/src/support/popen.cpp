// SPDX-License-Identifier: MIT

#include "popen.h"
#include "popen_p.h"

#include <fcntl.h>

#ifdef _WIN32
#  include <io.h>
#  include "stdc_windows.h"
#else
#  include <csignal>
#  include <pwd.h>
#  include <unistd.h>
#endif

#include <thread>

#include "pimpl.h"
#include "str.h"

namespace stdc {

    /// A streambuf over a FILE *. MSVC offers this as basic_filebuf(FILE *) and libstdc++ as
    /// __gnu_cxx::stdio_filebuf. Neither is portable, so we write it once here.
    ///
    /// Building on stdio rather than the OS handle keeps the text mode translation that
    /// _fdopen already set up, and leaves buffering to the C library.
    class Popen::Stream::Buf : public std::streambuf {
    public:
        ~Buf() override {
            close();
        }

        void open(FILE *file) {
            close();
            _file = file;
            setg(_buf, _buf, _buf);
        }

        bool isOpen() const {
            return _file != nullptr;
        }

        FILE *file() const {
            return _file;
        }

        void close() {
            if (!_file) {
                return;
            }
            // fclose flushes what is waiting to be written, so a flush in front of it buys
            // nothing on a stream that was written to. On one that was read it is worse than
            // nothing: fflush is defined for output, and for input only where the stream can
            // seek, which a pipe cannot. Nothing here holds bytes of its own either, since the
            // put area is never set and every write goes straight to the FILE.
            std::fclose(_file);
            _file = nullptr;
            setg(_buf, _buf, _buf);
        }

    protected:
        int_type underflow() override {
            if (!_file) {
                return traits_type::eof();
            }
            if (gptr() < egptr()) {
                return traits_type::to_int_type(*gptr());
            }
            size_t n = std::fread(_buf, 1, sizeof(_buf), _file);
            if (n == 0) {
                return traits_type::eof();
            }
            setg(_buf, _buf, _buf + n);
            return traits_type::to_int_type(*gptr());
        }

        std::streamsize xsputn(const char *s, std::streamsize n) override {
            if (!_file) {
                return 0;
            }
            return std::streamsize(std::fwrite(s, 1, size_t(n), _file));
        }

        int_type overflow(int_type c) override {
            if (!_file) {
                return traits_type::eof();
            }
            if (c != traits_type::eof()) {
                auto ch = traits_type::to_char_type(c);
                if (std::fwrite(&ch, 1, 1, _file) != 1) {
                    return traits_type::eof();
                }
            }
            return c;
        }

        int sync() override {
            return (_file && std::fflush(_file) == 0) ? 0 : -1;
        }

    private:
        FILE *_file = nullptr;
        char _buf[4096]{};
    };

    // No buffer until there is a pipe to put in it. Every Popen holds three of these and most
    // runs open one or none, so building the buffer here spends four kilobytes apiece on streams
    // nobody asked for. A null streambuf leaves the stream in badbit, which is what a stream
    // that was never opened should report anyway.
    Popen::Stream::Stream() : std::iostream(nullptr) {
    }

    Popen::Stream::~Stream() = default;

    void Popen::Stream::open(FILE *file) {
        if (!_buf) {
            _buf.reset(new Buf());
            rdbuf(_buf.get());
        }
        _buf->open(file);
        clear();
    }

    void Popen::Stream::close() {
        if (_buf) {
            _buf->close();
        }
    }

    bool Popen::Stream::isOpen() const {
        return _buf && _buf->isOpen();
    }

    FILE *Popen::Stream::file() const {
        return _buf ? _buf->file() : nullptr;
    }

    Popen::Impl::Impl() = default;

    Popen::Impl::~Impl() {
        if (_child_created && !returnCode) {
            std::ignore = kill_impl();
            std::ignore = _wait();
        }
        _cleanup();
    }

    static FILE *Popen_fdopen(int fd, const char *modes) {
#ifdef _WIN32
        return _fdopen(fd, modes);
#else
        return fdopen(fd, modes);
#endif
    }

    static int Popen_close_fd(int fd) {
#ifdef _WIN32
        return _close(fd);
#else
        return close(fd);
#endif
    }

    void Popen::Impl::clear_error() {
        errorCode.clear();
        error_msg.clear();
        error_api = nullptr;
    }

    std::string Popen::Impl::message() const {
        // The system call first: knowing that a start failed at "fork" rather than at "open"
        // says more than the errno does on its own.
        if (error_api) {
            return formatN("%1: %2", error_api, errorCode.message());
        }
        if (!error_msg.empty()) {
            return error_msg;
        }
        if (errorCode) {
            return errorCode.message();
        }
        return {};
    }

    bool Popen::Impl::done() {
        clear_error();

        if (_child_created || _detached_started) {
            return true;
        }
        pid = -1;
        returnCode.reset();
        _closed_child_pipe_fds = false;

        // Nothing downstream can make an argv out of nothing, and both platforms only found out
        // about it inside the child, where the answer was an assertion in a debug build and an
        // out of range read in a release one.
        if (args.empty()) {
            errorCode = std::make_error_code(std::errc::invalid_argument);
            error_msg = "no program to run: args is empty";
            return false;
        }

        // A std::string can hold a NUL and neither exec nor CreateProcess can carry one: both
        // read to the first one and stop. So a caller could be told the child started and be
        // wrong about what it was given, which is the one thing an argument vector is for.
        // Refused here rather than in either platform, since it is the same lie on both.
        const auto has_nul = [](const std::string &text) {
            return text.find('\0') != std::string::npos;
        };
        for (const auto &arg : args) {
            if (has_nul(arg)) {
                errorCode = std::make_error_code(std::errc::invalid_argument);
                error_msg = "an argument contains a NUL, which no platform can pass on";
                return false;
            }
        }
        if (env) {
            for (const auto &pair : *env) {
                if (pair.first.empty()) {
                    errorCode = std::make_error_code(std::errc::invalid_argument);
                    error_msg = "an environment variable has no name";
                    return false;
                }
                if (has_nul(pair.first) || has_nul(pair.second)) {
                    errorCode = std::make_error_code(std::errc::invalid_argument);
                    error_msg =
                        formatN("environment variable \"%1\" contains a NUL", pair.first.c_str());
                    return false;
                }
                // The name is everything before the first one, so a name carrying its own would
                // arrive as a different variable.
                if (pair.first.find('=') != std::string::npos) {
                    errorCode = std::make_error_code(std::errc::invalid_argument);
                    error_msg = formatN("illegal environment variable name: %1", pair.first);
                    return false;
                }
            }
        }

        const auto is_pipe = [](const IODev &dev) {
            return dev.kind == IODev::Builtin && dev.data.builtin == IOType::Pipe;
        };
        if (detached && (is_pipe(stdin_dev) || is_pipe(stdout_dev) || is_pipe(stderr_dev))) {
            errorCode = std::make_error_code(std::errc::invalid_argument);
            error_msg = "Pipe is not supported for a detached process";
            return false;
        }

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L847
        if (stdout_dev.kind == 1 && stdout_dev.data.builtin == IOType::StandardOutput) {
            errorCode = std::make_error_code(std::errc::invalid_argument);
            error_msg = "StandardOutput can only be used for stderr";
            return false;
        }

        // ###FIXME: do we need to check?
        if (stdin_dev.kind == 1 && stdin_dev.data.builtin == IOType::StandardOutput) {
            errorCode = std::make_error_code(std::errc::invalid_argument);
            error_msg = "StandardOutput can only be used for stderr";
            return false;
        }

#ifndef _WIN32
        if (!passFds.empty() && !closeFds) {
            fprintf(stderr, "stdc::Popen: %s\n", "passFds overriding closeFds.");
            closeFds = true;
        }
#endif

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L881
        // We don't need to handle string encodings in C++.

#ifndef _WIN32
        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L912
        //
        // -1 means "leave it alone", which is also what setregid() and setreuid() take.
        int gid = group;
        std::vector<int> gids = extraGroups;
        int uid = -1;
        if (user.has_value) {
            if (user.is_name) {
                errno = 0;
                struct passwd *pw = getpwnam(user.str.c_str());
                if (!pw) {
                    errorCode = errno ? std::error_code(errno, std::system_category())
                                      : std::make_error_code(std::errc::invalid_argument);
                    error_msg = formatN("no such user: %1", user.str);
                    return false;
                }
                uid = int(pw->pw_uid);
            } else {
                uid = user.num;
            }
        }
#endif

        // Input and output objects. The general principle is like
        // this:
        //
        // Parent                   Child
        // ------                   -----
        // p2cwrite   ---stdin--->  p2cread
        // c2pread    <--stdout---  c2pwrite
        // errread    <--stderr---  errwrite
        //
        // On POSIX, the child objects are file descriptors.  On
        // Windows, these are Windows file handles.  The parent objects
        // are file descriptors on both platforms.  The parent objects
        // are -1 when not using PIPEs. The child objects are -1
        // when not redirecting.
        //
        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1003
#ifdef _WIN32
        Handle p2cread = InvalidHandle, p2cwrite_h = InvalidHandle;
        Handle c2pread_h = InvalidHandle, c2pwrite = InvalidHandle;
        Handle errread_h = InvalidHandle, errwrite = InvalidHandle;
        if (!_get_handles(p2cread, p2cwrite_h, c2pread_h, c2pwrite, errread_h, errwrite)) {
            return false;
        }

        // Convert the parent's handles to CRT descriptors. _open_osfhandle takes ownership only
        // on success, so keep the raw handles until each conversion has completed.
        int p2cwrite = -1, c2pread = -1, errread = -1;
        const int binary_or_text = text ? _O_TEXT : _O_BINARY;
        if (p2cwrite_h != InvalidHandle) {
            p2cwrite = _open_osfhandle((intptr_t) p2cwrite_h, _O_WRONLY | binary_or_text);
            if (p2cwrite != -1)
                p2cwrite_h = InvalidHandle;
        }
        if (c2pread_h != InvalidHandle) {
            c2pread = _open_osfhandle((intptr_t) c2pread_h, _O_RDONLY | binary_or_text);
            if (c2pread != -1)
                c2pread_h = InvalidHandle;
        }
        if (errread_h != InvalidHandle) {
            errread = _open_osfhandle((intptr_t) errread_h, _O_RDONLY | binary_or_text);
            if (errread != -1)
                errread_h = InvalidHandle;
        }
        if ((p2cwrite_h != InvalidHandle && p2cwrite == -1) ||
            (c2pread_h != InvalidHandle && c2pread == -1) ||
            (errread_h != InvalidHandle && errread == -1)) {
            errorCode = errno ? std::error_code(errno, std::generic_category())
                              : std::make_error_code(std::errc::bad_file_descriptor);
            error_api = "_open_osfhandle";
            if (p2cwrite != -1)
                _close(p2cwrite);
            if (c2pread != -1)
                _close(c2pread);
            if (errread != -1)
                _close(errread);
            if (p2cwrite_h != InvalidHandle)
                ::CloseHandle(p2cwrite_h);
            if (c2pread_h != InvalidHandle)
                ::CloseHandle(c2pread_h);
            if (errread_h != InvalidHandle)
                ::CloseHandle(errread_h);
            _close_pipe_fds_1(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
            return false;
        }
#else
        Handle p2cread = InvalidHandle, p2cwrite = InvalidHandle;
        Handle c2pread = InvalidHandle, c2pwrite = InvalidHandle;
        Handle errread = InvalidHandle, errwrite = InvalidHandle;
        if (!_get_handles(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite)) {
            return false;
        }
#endif
        // Turn all descriptors into FILE objects transactionally. A failed fdopen leaves its
        // descriptor owned by the caller, so every partial result needs explicit cleanup.
        FILE *stdin_file = p2cwrite == -1 ? nullptr : Popen_fdopen(p2cwrite, text ? "w" : "wb");
        FILE *stdout_file = c2pread == -1 ? nullptr : Popen_fdopen(c2pread, text ? "r" : "rb");
        FILE *stderr_file = errread == -1 ? nullptr : Popen_fdopen(errread, text ? "r" : "rb");
        if ((p2cwrite != -1 && !stdin_file) || (c2pread != -1 && !stdout_file) ||
            (errread != -1 && !stderr_file)) {
            errorCode = errno ? std::error_code(errno, std::generic_category())
                              : std::make_error_code(std::errc::io_error);
            error_api = "fdopen";
            if (stdin_file)
                std::fclose(stdin_file);
            else if (p2cwrite != -1)
                Popen_close_fd(p2cwrite);
            if (stdout_file)
                std::fclose(stdout_file);
            else if (c2pread != -1)
                Popen_close_fd(c2pread);
            if (stderr_file)
                std::fclose(stderr_file);
            else if (errread != -1)
                Popen_close_fd(errread);
            _close_pipe_fds_1(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
            return false;
        }
        if (stdin_file)
            stdin_stream.open(stdin_file);
        if (stdout_file)
            stdout_stream.open(stdout_file);
        if (stderr_file)
            stderr_stream.open(stderr_file);

#ifdef _WIN32
        bool result = _execute_child(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
#else
        bool result = _execute_child(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite, //
                                     gid, gids, uid);
#endif

        if (!result) {
            // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1049
            close_std_files();
            if (!_closed_child_pipe_fds) {
                _close_pipe_fds_1(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
            }
            // A POSIX exec failure briefly created and then reaped a child. Externally start()
            // still failed, so restore the pre-start state and allow a corrected retry.
            if (returnCode) {
                _child_created = false;
            }
        }
        return result;
    }

    void Popen::Impl::close_std_files() {
        stdout_stream.close();
        stderr_stream.close();
        stdin_stream.close();
    }

}

namespace stdc {

    Popen::Popen() : _impl(new Impl()) {
    }

    Popen::~Popen() = default;

    Popen::Popen(Popen &&RHS) noexcept : _impl(std::move(RHS._impl)) {
    }

    // Not a swap. Moving releases this object's child at the assignment and leaves RHS empty,
    // instead of handing the old child to RHS for its destructor to kill at some later point.
    Popen &Popen::operator=(Popen &&RHS) noexcept {
        _impl = std::move(RHS._impl);
        return *this;
    }

    Popen &Popen::executable(std::filesystem::path executable) {
        stdc_impl_t;
        impl.executable = std::move(executable);
        return *this;
    }

    Popen &Popen::args(std::vector<std::string> args) {
        stdc_impl_t;
        impl.args = std::move(args);
        return *this;
    }

    Popen &Popen::shell(bool shell) {
        stdc_impl_t;
        impl.shell = shell;
        return *this;
    }

    Popen &Popen::cwd(std::filesystem::path cwd) {
        stdc_impl_t;
        impl.cwd = std::move(cwd);
        return *this;
    }

    Popen &Popen::env(std::optional<std::map<std::string, std::string>> env) {
        stdc_impl_t;
        impl.env = std::move(env);
        return *this;
    }

    Popen &Popen::standardInput(IODev dev) {
        stdc_impl_t;
        impl.stdin_dev = dev;
        return *this;
    }

    Popen &Popen::standardOutput(IODev dev) {
        stdc_impl_t;
        impl.stdout_dev = dev;
        return *this;
    }

    Popen &Popen::standardError(IODev dev) {
        stdc_impl_t;
        impl.stderr_dev = dev;
        return *this;
    }

    Popen &Popen::text(bool text) {
        stdc_impl_t;
        impl.text = text;
        return *this;
    }

    Popen &Popen::closeFds(bool closeFds) {
        stdc_impl_t;
        impl.closeFds = closeFds;
        return *this;
    }

    Popen &Popen::detached(bool detached) {
        stdc_impl_t;
        if (!impl._child_created && !impl._detached_started)
            impl.detached = detached;
        return *this;
    }

    Popen &Popen::pipeSize(int pipeSize) {
        stdc_impl_t;
        impl.pipeSize = pipeSize;
        return *this;
    }

#ifdef _WIN32
    Popen &Popen::startupInfo(std::optional<StartupInfo> startupInfo) {
        stdc_impl_t;
        impl.startupInfo = std::move(startupInfo);
        return *this;
    }

    Popen &Popen::creationFlags(int creationFlags) {
        stdc_impl_t;
        impl.creationFlags = creationFlags;
        return *this;
    }
#else
    Popen &Popen::preExec(std::function<void()> preExec) {
        stdc_impl_t;
        impl.preExec = std::move(preExec);
        return *this;
    }

    Popen &Popen::restoreSignals(bool restoreSignals) {
        stdc_impl_t;
        impl.restoreSignals = restoreSignals;
        return *this;
    }

    Popen &Popen::startNewSession(bool startNewSession) {
        stdc_impl_t;
        impl.startNewSession = startNewSession;
        return *this;
    }

    Popen &Popen::passFds(std::vector<int> passFds) {
        stdc_impl_t;
        impl.passFds = std::move(passFds);
        return *this;
    }

    Popen &Popen::group(int group) {
        stdc_impl_t;
        impl.group = group;
        return *this;
    }

    Popen &Popen::extraGroups(std::vector<int> extraGroups) {
        stdc_impl_t;
        impl.extraGroups = std::move(extraGroups);
        return *this;
    }

    Popen &Popen::user(int user) {
        stdc_impl_t;
        auto &info = impl.user;
        info.has_value = true;
        info.is_name = false;
        info.num = user;
        return *this;
    }

    Popen &Popen::user(const char *user) {
        stdc_impl_t;
        auto &info = impl.user;
        info.has_value = true;
        info.is_name = true;
        info.str = user ? user : "";
        return *this;
    }

    Popen &Popen::umask(int umask) {
        stdc_impl_t;
        impl.umask = umask;
        return *this;
    }

    Popen &Popen::processGroup(int processGroup) {
        stdc_impl_t;
        impl.processGroup = processGroup;
        return *this;
    }
#endif

    bool Popen::start() {
        stdc_impl_t;

        bool result = impl.done();
        if (result) {
            return true;
        }

        // A start that did not happen leaves no process behind. On unix a failing exec is
        // reported by a child that has already been forked and reaped, which would otherwise
        // show up here as the exit status of a process the caller never got, and as a pid.
        // Windows never had either, so this is also what makes the two agree.
        impl.pid = -1;
        impl.returnCode.reset();

        // A failure that named nothing would leave errorMessage() empty and read as success. There
        // should be none, so this is a backstop rather than an expected path.
        if (impl.message().empty()) {
            impl.error_msg = "unknown error";
        }
        return false;
    }

    bool Popen::poll() {
        stdc_impl_t;
        return impl._internal_poll();
    }

    bool Popen::wait(int timeout) {
        stdc_impl_t;
        // we don't wait for the next Ctrl+C like python
        return impl._wait(timeout);
    }

    std::tuple<std::string, std::string> Popen::communicate(const std::string &input, int timeout) {
        stdc_impl_t;
        return impl.communicate_impl(input, timeout);
    }

    bool Popen::sendSignal(int sig) {
        stdc_impl_t;
        return impl.send_signal_impl(sig);
    }

    bool Popen::terminate() {
        stdc_impl_t;
        return impl.terminate_impl();
    }

    bool Popen::kill() {
        stdc_impl_t;
        return impl.kill_impl();
    }

    std::error_code Popen::errorCode() const {
        stdc_impl_t;
        return impl.errorCode;
    }

    std::string Popen::errorMessage() const {
        stdc_impl_t;
        return impl.message();
    }

    const std::filesystem::path &Popen::executable() const {
        stdc_impl_t;
        return impl.executable;
    }

    array_view<std::string> Popen::args() const {
        stdc_impl_t;
        return impl.args;
    }

    Popen::Stream &Popen::standardInput() const {
        stdc_impl_t;
        return impl.stdin_stream;
    }

    Popen::Stream &Popen::standardOutput() const {
        stdc_impl_t;
        return impl.stdout_stream;
    }

    Popen::Stream &Popen::standardError() const {
        stdc_impl_t;
        return impl.stderr_stream;
    }

    int Popen::pid() const {
        stdc_impl_t;
        return impl.pid;
    }

    bool Popen::detached() const {
        stdc_impl_t;
        return impl.detached;
    }

    std::optional<int> Popen::returnCode() const {
        stdc_impl_t;
        return impl.returnCode;
    }

}

// SPDX-License-Identifier: MIT

#include "popen.h"
#include "popen_p.h"

#include <fcntl.h>
#include <unistd.h>
#include <limits.h>
#include <grp.h>
#include <poll.h>
#include <sys/wait.h>
#include <sys/stat.h>

#include <csignal>
#include <cassert>
#include <cerrno>
#include <cstring>
#include <cstdlib>
#include <algorithm>
#include <array>
#include <chrono>
#include <tuple>
#include <limits>
#include <mutex>
#include <thread>
#include <vector>

#include "str.h"
#include "scope_guard.h"
#include "system.h"

namespace stdc {

#ifndef __APPLE__
    /// Keeps a broken pipe from ending the process, for as long as it lives.
    ///
    /// The poll loop below asks whether the child is still reading before writing anything, so
    /// almost every broken pipe is answered by not writing at all. What is left is the gap
    /// between poll saying the descriptor is writable and the write happening: the child can
    /// exit in there, and then write raises SIGPIPE and ends the process. Nothing about poll
    /// closes that gap, so it is closed here.
    ///
    /// The signal is blocked for this thread rather than ignored for the process. A disposition
    /// is process wide, and two threads saving and restoring one race: the first to leave puts
    /// back what it found and takes the protection away from the second, which is still writing,
    /// and the last to leave installs what the first had already installed. Measured, both
    /// halves. A mask is this thread's own, so neither happens.
    ///
    /// Blocking leaves the signal pending instead of delivering it, so it has to be taken off
    /// again before the mask goes back. One that was already pending on the way in is left
    /// alone: it was not ours to swallow.
    ///
    /// \note Apple has no sigtimedwait to take it off with, and so does none of this. It sets
    ///       \c F_SETNOSIGPIPE on the descriptor instead, which is better still.
    class sigpipe_guard {
    public:
        sigpipe_guard() {
            sigemptyset(&_pipe_only);
            sigaddset(&_pipe_only, SIGPIPE);

            sigset_t pending;
            sigemptyset(&pending);
            _was_pending = sigpending(&pending) == 0 && sigismember(&pending, SIGPIPE) == 1;
            _installed = pthread_sigmask(SIG_BLOCK, &_pipe_only, &_old_mask) == 0;
        }

        ~sigpipe_guard() {
            if (!_installed) {
                return;
            }
            if (!_was_pending) {
                const timespec no_wait{};
                while (sigtimedwait(&_pipe_only, nullptr, &no_wait) == -1 && errno == EINTR) {
                }
            }
            pthread_sigmask(SIG_SETMASK, &_old_mask, nullptr);
        }

    private:
        sigset_t _pipe_only{};
        sigset_t _old_mask{};
        bool _installed = false;
        bool _was_pending = false;

        STDC_DISABLE_COPY_MOVE(sigpipe_guard)
    };
#endif

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L2094
    //
    // A pipe blocks its writer once full, so stdout and stderr cannot be drained one after the
    // other, and neither can be drained after the child exits: the child would still be blocked
    // writing the one nobody is taking. All three streams have to move at once.
    //
    // Here that is one poll loop and no threads. Python does the same on this platform and uses
    // threads only on Windows, where an anonymous pipe cannot be waited on. Threads would work
    // here too, and did, at the price of three of them per call and a signal disposition that
    // two concurrent calls would fight over.
    //
    // \note Reads go straight to the descriptor. Anything a caller already pulled out through
    //       standardInput(), standardOutput() or standardError() into the stream's own buffer
    //       is theirs and is not seen here, which was true of the thread version as well.
    std::tuple<std::string, std::string> Popen::Impl::communicate_impl(const std::string &input,
                                                                       int timeout) {
        clear_error();

        // Same answer as the other five, rather than the no_such_process the check below would
        // give. A detached child exists, it is just not ours to talk to.
        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return {};
        }
        if (!_child_created) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return {};
        }

        // Whatever the caller wrote through the stream goes out ahead of the input given here,
        // in the order they wrote it.
        if (stdin_stream.isOpen()) {
            stdin_stream.flush();
        }

        int in_fd = stdin_stream.isOpen() ? ::fileno(stdin_stream.file()) : -1;
        int out_fd = stdout_stream.isOpen() ? ::fileno(stdout_stream.file()) : -1;
        int err_fd = stderr_stream.isOpen() ? ::fileno(stderr_stream.file()) : -1;

        // Non-blocking, so that neither a full pipe nor an empty one can hold the loop still
        // while another stream has something to say.
        for (int fd : {in_fd, out_fd, err_fd}) {
            if (fd < 0) {
                continue;
            }
            int flags = ::fcntl(fd, F_GETFL, 0);
            if (flags >= 0) {
                std::ignore = ::fcntl(fd, F_SETFL, flags | O_NONBLOCK);
            }
        }

#ifdef __APPLE__
        // A broken pipe answers with EPIPE and raises nothing, for this descriptor alone. Better
        // than the signal mask the other platforms use, since not even this thread changes, and
        // the descriptor is one of ours: where a caller handed in its own, the stream is not
        // open and there is nothing here to write to.
        if (in_fd >= 0) {
            std::ignore = ::fcntl(in_fd, F_SETNOSIGPIPE, 1);
        }
#endif

        std::string out, err;
        size_t written = 0;
        bool timed_out = false;

        const auto started = std::chrono::steady_clock::now();
        const auto &remaining = [&]() -> int {
            if (timeout < 0) {
                return -1;
            }
            auto spent = std::chrono::duration_cast<std::chrono::milliseconds>(
                             std::chrono::steady_clock::now() - started)
                             .count();
            return spent >= timeout ? 0 : int(timeout - spent);
        };

        // Nothing to say, so the child is told that now rather than after the loop. A child
        // reading to end of input would otherwise wait for a close that never comes.
        if (in_fd >= 0 && input.empty()) {
            stdin_stream.close();
            in_fd = -1;
        }

        const auto &drain = [](int fd, std::string &dest) {
            // Until it would block. One readable event can carry more than one bufferful.
            char buf[4096];
            for (;;) {
                ssize_t n = ::read(fd, buf, sizeof(buf));
                if (n > 0) {
                    dest.append(buf, size_t(n));
                    continue;
                }
                if (n == 0) {
                    return false; // end of it
                }
                if (errno == EINTR) {
                    continue;
                }
                return errno == EAGAIN || errno == EWOULDBLOCK;
            }
        };

        _communication_started = true;

#ifndef __APPLE__
        // Held across the whole loop rather than taken and put back around each write, which
        // would be two system calls per turn of it.
        sigpipe_guard guard;
#endif

        while (in_fd >= 0 || out_fd >= 0 || err_fd >= 0) {
            struct pollfd fds[3]{};
            int count = 0;
            int in_slot = -1, out_slot = -1, err_slot = -1;
            if (in_fd >= 0) {
                fds[count] = {in_fd, POLLOUT, 0};
                in_slot = count++;
            }
            if (out_fd >= 0) {
                fds[count] = {out_fd, POLLIN, 0};
                out_slot = count++;
            }
            if (err_fd >= 0) {
                fds[count] = {err_fd, POLLIN, 0};
                err_slot = count++;
            }

            int ready = ::poll(fds, nfds_t(count), remaining());
            if (ready < 0) {
                if (errno == EINTR) {
                    continue;
                }
                errorCode = std::error_code(errno, std::generic_category());
                error_api = "poll";
                break;
            }
            if (ready == 0) {
                timed_out = true;
                break;
            }

            if (in_slot >= 0 && fds[in_slot].revents) {
                // The reader is gone, so there is nothing to write to. Answering it here is
                // what makes the guard above a backstop rather than the whole answer.
                if (fds[in_slot].revents & (POLLERR | POLLHUP | POLLNVAL)) {
                    stdin_stream.close();
                    in_fd = -1;
                } else {
                    ssize_t n = ::write(in_fd, input.data() + written, input.size() - written);
                    if (n > 0) {
                        written += size_t(n);
                    } else if (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
                        // EPIPE, if the child went between the poll and the write.
                        stdin_stream.close();
                        in_fd = -1;
                    }
                    // End of input is what lets a child reading to the end finish.
                    if (in_fd >= 0 && written == input.size()) {
                        stdin_stream.close();
                        in_fd = -1;
                    }
                }
            }
            if (out_slot >= 0 && fds[out_slot].revents && !drain(out_fd, out)) {
                out_fd = -1;
            }
            if (err_slot >= 0 && fds[err_slot].revents && !drain(err_fd, err)) {
                err_fd = -1;
            }
        }

        // A timeout kills the child rather than leaving it behind.
        if (timed_out || !_wait(remaining())) {
            auto wait_error = errorCode;
            std::ignore = kill_impl();
            std::ignore = _wait();
            errorCode =
                wait_error.value() != 0 ? wait_error : std::make_error_code(std::errc::timed_out);
        }

        close_std_files();
        return {out, err};
    }

    static inline std::error_code make_last_error_code() {
        return std::error_code(errno, std::system_category());
    }

    static void set_cloexec(int fd, bool on) {
        int flags = fcntl(fd, F_GETFD);
        if (flags == -1) {
            return;
        }
        int wanted = on ? (flags | FD_CLOEXEC) : (flags & ~FD_CLOEXEC);
        if (wanted != flags) {
            fcntl(fd, F_SETFD, wanted);
        }
    }

    static bool make_pipe(int &read_fd, int &write_fd) {
        int fds[2];
#ifdef __linux__
        if (pipe2(fds, O_CLOEXEC) != 0) {
            return false;
        }
#else
        if (pipe(fds) != 0) {
            return false;
        }
        set_cloexec(fds[0], true);
        set_cloexec(fds[1], true);
#endif
        read_fd = fds[0];
        write_fd = fds[1];
        return true;
    }

    void Popen::Impl::_reap() {
        // Nothing to release here: waitpid() has already reaped the child.
    }

    void Popen::Impl::_cleanup() {
        close_std_files();
        _reap();
    }

    bool Popen::Impl::_get_devnull() {
        int devnull = open("/dev/null", O_RDWR | O_CLOEXEC);
        if (devnull == -1) {
            errorCode = make_last_error_code();
            error_api = "open";
            return false;
        }
        _devnull = devnull;
        return true;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1723
    bool Popen::Impl::_get_handles(int &p2cread, int &p2cwrite, int &c2pread, int &c2pwrite,
                                   int &errread, int &errwrite) {
        if (stdin_dev.kind == 0 && stdout_dev.kind == 0 && stderr_dev.kind == 0) {
            return true;
        }

        p2cread = -1, p2cwrite = -1;
        c2pread = -1, c2pwrite = -1;
        errread = -1, errwrite = -1;

        // descriptors we opened ourselves, to be closed if a later step fails
        std::array<int, 10> err_close_fds;
        int err_close_fds_cnt = 0;
        auto err_close_fd_guard = make_scope_guard([&]() {
            for (int i = 0; i < err_close_fds_cnt; i++) {
                close(err_close_fds[i]);
            }
            if (_devnull != InvalidHandle) {
                close(_devnull);
                _devnull = InvalidHandle;
            }
        });
        const auto &push_err_close_fd = [&](int fd) { err_close_fds[err_close_fds_cnt++] = fd; };

        // create a pipe
        const auto &create_pipe = [this](int &read_fd, int &write_fd) {
            if (!make_pipe(read_fd, write_fd)) {
                errorCode = make_last_error_code();
                error_api = "pipe";
                return false;
            }
            return true;
        };

        // open or return devnull
        const auto &open_devnull = [this](int &fd) {
            if (_devnull == InvalidHandle && !_get_devnull()) {
                return false;
            }
            fd = _devnull;
            return true;
        };

        // take a descriptor from the caller, which stays theirs to close
        const auto &convert_from_fd = [this](int &target, int fd) {
            if (fd == -1) {
                errorCode = std::make_error_code(std::errc::bad_file_descriptor);
                error_api = "fileno";
                return false;
            }
            target = fd;
            return true;
        };

        //
        // transaction start
        //

        // stdin
        switch (stdin_dev.kind) {
            case IODev::None:
                break;
            case IODev::Builtin: {
                switch (stdin_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(p2cread, p2cwrite)) {
                            return false;
                        }
                        push_err_close_fd(p2cread);
                        push_err_close_fd(p2cwrite);
#ifdef F_SETPIPE_SZ
                        if (pipeSize > 0) {
                            fcntl(p2cwrite, F_SETPIPE_SZ, pipeSize);
                        }
#endif
                        break;
                    };
                    case DeviceNull: {
                        if (!open_devnull(p2cread)) {
                            return false;
                        }
                        break;
                    };
                    default: {
                        errorCode = std::make_error_code(std::errc::invalid_argument);
                        error_msg = formatN("invalid stdin type: %1", int(stdin_dev.data.builtin));
                        return false;
                    }
                }
                break;
            }
            case IODev::FileDescriptor: {
                if (!convert_from_fd(p2cread, stdin_dev.data.fd)) {
                    return false;
                }
                break;
            }
            case IODev::CFile: {
                if (!convert_from_fd(p2cread, fileno(stdin_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }

        // stdout
        switch (stdout_dev.kind) {
            case IODev::None: {
                break;
            }
            case IODev::Builtin: {
                switch (stdout_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(c2pread, c2pwrite)) {
                            return false;
                        }
                        push_err_close_fd(c2pread);
                        push_err_close_fd(c2pwrite);
#ifdef F_SETPIPE_SZ
                        if (pipeSize > 0) {
                            fcntl(c2pwrite, F_SETPIPE_SZ, pipeSize);
                        }
#endif
                        break;
                    };
                    case DeviceNull: {
                        if (!open_devnull(c2pwrite)) {
                            return false;
                        }
                        break;
                    };
                    default: {
                        errorCode = std::make_error_code(std::errc::invalid_argument);
                        error_msg =
                            formatN("invalid stdout type: %1", int(stdout_dev.data.builtin));
                        return false;
                    }
                }
                break;
            }
            case IODev::FileDescriptor: {
                if (!convert_from_fd(c2pwrite, stdout_dev.data.fd)) {
                    return false;
                }
                break;
            }
            case IODev::CFile: {
                if (!convert_from_fd(c2pwrite, fileno(stdout_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }

        // stderr
        switch (stderr_dev.kind) {
            case IODev::None: {
                break;
            }
            case IODev::Builtin: {
                switch (stderr_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(errread, errwrite)) {
                            return false;
                        }
                        push_err_close_fd(errread);
                        push_err_close_fd(errwrite);
#ifdef F_SETPIPE_SZ
                        if (pipeSize > 0) {
                            fcntl(errwrite, F_SETPIPE_SZ, pipeSize);
                        }
#endif
                        break;
                    };
                    case DeviceNull: {
                        if (!open_devnull(errwrite)) {
                            return false;
                        }
                        break;
                    };
                    case StandardOutput: {
                        if (c2pwrite != -1) {
                            errwrite = c2pwrite;
                        } else if (!convert_from_fd(errwrite, fileno(stdout))) {
                            return false;
                        }
                        break;
                    };
                }
                break;
            }
            case IODev::FileDescriptor: {
                if (!convert_from_fd(errwrite, stderr_dev.data.fd)) {
                    return false;
                }
                break;
            }
            case IODev::CFile: {
                if (!convert_from_fd(errwrite, fileno(stderr_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }

        //
        // transaction end
        //

        err_close_fd_guard.dismiss();
        return true;
    }

    void Popen::Impl::_close_pipe_fds(Handle p2cread, int p2cwrite, int c2pread, Handle c2pwrite,
                                      int errread, Handle errwrite) {
        _close_pipe_fds_1(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
        _closed_child_pipe_fds = true;
    }

    void Popen::Impl::_close_pipe_fds_1(Handle p2cread, int p2cwrite, int c2pread, Handle c2pwrite,
                                        int errread, Handle errwrite) {
        // Unlike Windows, nothing here was duplicated, so a descriptor the caller handed us is
        // still theirs. Close an end only when both ends are set, which is true of the pipes we
        // made and of nothing else.
        if (p2cread != -1 && p2cwrite != -1 && p2cread != _devnull) {
            close(p2cread);
        }
        if (c2pwrite != -1 && c2pread != -1 && c2pwrite != _devnull) {
            close(c2pwrite);
        }
        if (errwrite != -1 && errread != -1 && errwrite != _devnull) {
            close(errwrite);
        }
        if (_devnull != InvalidHandle) {
            close(_devnull);
            _devnull = InvalidHandle;
        }
    }

    struct Popen::Impl::ChildArgs {
        // null terminated arrays, all owned by the caller
        char *const *exec_array;
        char *const *argv;
        char *const *envp; // null to keep our own environment

        const char *cwd; // null to stay put

        // ascending, and the child must not close these
        const int *fds_to_keep;
        size_t fds_to_keep_len;

        int p2cread, p2cwrite;
        int c2pread, c2pwrite;
        int errread, errwrite;
        int errpipe_read, errpipe_write;

        int gid, uid; // -1 to leave alone
        const int *extra_gids;
        int extra_gids_len; // 0 to leave alone
    };

    // https://github.com/python/cpython/blob/v3.13.13/Modules/_posixsubprocess.c#L575
    //
    // Closes every descriptor at or above start_fd except the ones to keep, which must be sorted.
    static void close_open_fds(int start_fd, const int *keep, size_t keep_len) {
        long open_max = sysconf(_SC_OPEN_MAX);
        if (open_max < 0 || open_max > 1 << 20) {
            open_max = 1 << 20;
        }
        size_t k = 0;
        for (int fd = start_fd; fd < int(open_max); ++fd) {
            while (k < keep_len && keep[k] < fd) {
                ++k;
            }
            if (k < keep_len && keep[k] == fd) {
                continue;
            }
            close(fd);
        }
    }

    static void write_all(int fd, const char *data, size_t size) {
        while (size > 0) {
            ssize_t n = write(fd, data, size);
            if (n <= 0) {
                if (n < 0 && errno == EINTR) {
                    continue;
                }
                return;
            }
            data += n;
            size -= size_t(n);
        }
    }

    static void write_str(int fd, const char *str) {
        write_all(fd, str, strlen(str));
    }

    /// Writes value as lowercase hex. snprintf is not async signal safe, this is.
    static void write_hex(int fd, int value) {
        char buf[sizeof(int) * 2 + 1];
        char *cur = buf + sizeof(buf);
        do {
            *--cur = "0123456789abcdef"[value % 16];
            value /= 16;
        } while (value != 0 && cur != buf);
        write_all(fd, cur, size_t(buf + sizeof(buf) - cur));
    }

    // https://github.com/python/cpython/blob/v3.13.13/Modules/_posixsubprocess.c#L663
    void Popen::Impl::_child_exec(const ChildArgs &ca) {
        // Tells the parent the failure happened before exec, so the message is not a bad path.
        const char *errMsg = "noexec";
        int first_exec_errno = 0;

        // Returns only on failure, with errno set.
        const auto &run = [&]() {
            for (size_t i = 0; i < ca.fds_to_keep_len; ++i) {
                // errpipe_write is in this list but must stay close-on-exec. Its closing is what
                // tells the parent that exec succeeded.
                if (ca.fds_to_keep[i] != ca.errpipe_write) {
                    set_cloexec(ca.fds_to_keep[i], false);
                }
            }

            // close the parent's ends
            if (ca.p2cwrite != -1) {
                close(ca.p2cwrite);
            }
            if (ca.c2pread != -1) {
                close(ca.c2pread);
            }
            if (ca.errread != -1) {
                close(ca.errread);
            }
            close(ca.errpipe_read);

            // A child end that already sits on 0, 1 or 2 would be overwritten by a later dup2.
            int c2pwrite = ca.c2pwrite;
            int errwrite = ca.errwrite;
            if (c2pwrite == 0) {
                c2pwrite = dup(c2pwrite);
                if (c2pwrite < 0) {
                    return;
                }
                set_cloexec(c2pwrite, true);
            }
            while (errwrite == 0 || errwrite == 1) {
                errwrite = dup(errwrite);
                if (errwrite < 0) {
                    return;
                }
                set_cloexec(errwrite, true);
            }

            // dup2 clears FD_CLOEXEC, but it is a no-op when the two are equal, so clear it here.
            if (ca.p2cread == 0) {
                set_cloexec(0, false);
            } else if (ca.p2cread != -1 && dup2(ca.p2cread, 0) < 0) {
                return;
            }
            if (c2pwrite == 1) {
                set_cloexec(1, false);
            } else if (c2pwrite != -1 && dup2(c2pwrite, 1) < 0) {
                return;
            }
            if (errwrite == 2) {
                set_cloexec(2, false);
            } else if (errwrite != -1 && dup2(errwrite, 2) < 0) {
                return;
            }

            if (ca.cwd) {
                if (chdir(ca.cwd) == -1) {
                    errMsg = "noexec:chdir";
                    return;
                }
            }

            if (umask >= 0) {
                ::umask(mode_t(umask));
            }

            if (restoreSignals) {
                // What CPython's _Py_RestoreSignals() undoes.
                signal(SIGPIPE, SIG_DFL);
                signal(SIGXFSZ, SIG_DFL);
            }

            if (startNewSession && setsid() == -1) {
                return;
            }
            if (processGroup >= 0 && setpgid(0, processGroup) == -1) {
                return;
            }
            if (ca.extra_gids_len > 0 &&
                setgroups(size_t(ca.extra_gids_len),
                          reinterpret_cast<const gid_t *>(ca.extra_gids)) == -1) {
                return;
            }
            if (ca.gid != -1 && setregid(gid_t(ca.gid), gid_t(ca.gid)) == -1) {
                return;
            }
            if (ca.uid != -1 && setreuid(uid_t(ca.uid), uid_t(ca.uid)) == -1) {
                return;
            }

            errMsg = "";
            if (preExec) {
                // This is where the user has asked us to deadlock their program.
                preExec();
            }

            // After preExec, which may have opened descriptors of its own.
            if (closeFds) {
                close_open_fds(3, ca.fds_to_keep, ca.fds_to_keep_len);
            }

            // The parent built the candidate list from PATH, so this is the search.
            for (int i = 0; ca.exec_array[i]; ++i) {
                if (ca.envp) {
                    execve(ca.exec_array[i], ca.argv, ca.envp);
                } else {
                    execv(ca.exec_array[i], ca.argv);
                }
                if (errno != ENOENT && errno != ENOTDIR && first_exec_errno == 0) {
                    first_exec_errno = errno;
                }
            }
        };
        run();

        // Report the first exec error rather than the last.
        int saved_errno = first_exec_errno ? first_exec_errno : errno;
        if (saved_errno) {
            write_str(ca.errpipe_write, "OSError:");
            write_hex(ca.errpipe_write, saved_errno);
            write_str(ca.errpipe_write, ":");
        } else {
            write_str(ca.errpipe_write, "SubprocessError:0:");
        }
        // strerror is not async signal safe. The parent looks the number up instead.
        write_str(ca.errpipe_write, errMsg);
    }

    int Popen::Impl::_fork_exec(const ChildArgs &ca) {
        if (detached) {
            int pidpipe_read = -1, pidpipe_write = -1;
            if (!make_pipe(pidpipe_read, pidpipe_write)) {
                return -1;
            }

            pid_t launcher = fork();
            if (launcher == 0) {
                close(pidpipe_read);
                if (setsid() == -1) {
                    write_str(ca.errpipe_write, "OSError:");
                    write_hex(ca.errpipe_write, errno);
                    write_str(ca.errpipe_write, ":setsid");
                    _exit(255);
                }

                pid_t child = fork();
                if (child == 0) {
                    close(pidpipe_write);
                    _child_exec(ca);
                    _exit(255);
                }
                if (child == -1) {
                    write_str(ca.errpipe_write, "OSError:");
                    write_hex(ca.errpipe_write, errno);
                    write_str(ca.errpipe_write, ":fork");
                    _exit(255);
                }

                const char *data = reinterpret_cast<const char *>(&child);
                size_t left = sizeof(child);
                while (left != 0) {
                    ssize_t written = write(pidpipe_write, data, left);
                    if (written < 0 && errno == EINTR)
                        continue;
                    if (written <= 0)
                        _exit(255);
                    data += written;
                    left -= size_t(written);
                }
                close(pidpipe_write);
                _exit(0);
            }

            int saved_errno = errno;
            close(pidpipe_write);
            if (launcher == -1) {
                close(pidpipe_read);
                errno = saved_errno;
                return -1;
            }

            pid_t child = -1;
            char *data = reinterpret_cast<char *>(&child);
            size_t left = sizeof(child);
            while (left != 0) {
                ssize_t count = read(pidpipe_read, data, left);
                if (count < 0 && errno == EINTR)
                    continue;
                if (count <= 0)
                    break;
                data += count;
                left -= size_t(count);
            }
            close(pidpipe_read);

            int status = 0;
            pid_t waited;
            do {
                waited = waitpid(launcher, &status, 0);
            } while (waited == -1 && errno == EINTR);
            if (waited != launcher) {
                return 0;
            }
            return left == 0 && WIFEXITED(status) && WEXITSTATUS(status) == 0 ? int(child) : 0;
        }

        pid_t child = fork();
        if (child == 0) {
            _child_exec(ca);
            _exit(255);
        }
        return int(child);
    }

    /// The directories PATH names, or the standard ones when it says nothing.
    static std::vector<std::string>
        exec_search_path(const std::optional<std::map<std::string, std::string>> &env) {
        std::string path;
        if (env) {
            auto it = env->find("PATH");
            if (it == env->end()) {
                // The child's environment was replaced and carries no PATH, so there is nowhere
                // to look. Falling back to ours would search a directory list the caller took
                // away on purpose.
                return {};
            }
            path = it->second;
        } else if (const char *parent_path = getenv("PATH")) {
            path = parent_path;
        } else {
            path = "/bin:/usr/bin";
        }

        std::vector<std::string> dirs;
        size_t start = 0;
        while (start <= path.size()) {
            size_t end = path.find(':', start);
            if (end == std::string::npos) {
                end = path.size();
            }
            // An empty entry means the working directory. Skipping it is what a shell's secure
            // PATH does, and searching it here would be a surprise.
            if (end > start) {
                dirs.push_back(path.substr(start, end - start));
            }
            start = end + 1;
        }
        return dirs;
    }

    // https://github.com/llvm/llvm-project/blob/llvmorg-21.1.8/llvm/lib/Support/Unix/Program.inc#L549
    bool system::command_line_fits(const std::vector<std::string> &args) {
        static const long arg_max = sysconf(_SC_ARG_MAX);
        if (arg_max == -1) {
            // The system declines to name a limit, so there is nothing here to check against.
            return true;
        }

        // The baseline xargs uses, brought down to what this system says where that is smaller
        // and up to what POSIX guarantees where it is not.
        long effective = 128 * 1024;
        if (effective > arg_max) {
            effective = arg_max;
        } else if (effective < _POSIX_ARG_MAX) {
            effective = _POSIX_ARG_MAX;
        }

        // Half of it. The environment is counted against the same limit and is not this
        // function's to see.
        const size_t room = size_t(effective / 2);

        size_t length = 0;
        for (const auto &arg : args) {
            // Linux refuses any single argument of this length whatever the total is, and names
            // the limit nowhere a program can read it. Checked everywhere rather than only
            // there, since it is high enough that nothing legitimate reaches it.
            if (arg.size() >= 32 * 4096) {
                return false;
            }
            length += arg.size() + 1;
            if (length > room) {
                return false;
            }
        }
        return true;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1827
    bool Popen::Impl::_execute_child(int p2cread, int p2cwrite, int c2pread, int c2pwrite,
                                     int errread, int errwrite, int gid,
                                     const std::vector<int> &gids, int uid) {
        assert(!args.empty());
        std::filesystem::path child_executable = executable;

        // The argv for this start rather than the configuration, the same way the executable
        // above is taken by value. A start that failed can be corrected and tried again, which
        // it cannot be once the first attempt has left /bin/sh -c standing in front of the
        // caller's command: the second start would insert it again and run something else.
        std::vector<std::string> child_args = args;

        if (shell) {
            // /bin/sh, not bash, is the one unix guarantees.
            std::string command;
            for (size_t i = 0; i < args.size(); ++i) {
                if (i != 0) {
                    command += ' ';
                }
                command += '\'';
                for (char ch : args[i]) {
                    if (ch == '\'') {
                        command += "'\\''";
                    } else {
                        command += ch;
                    }
                }
                command += '\'';
            }
            child_args = {"/bin/sh", "-c", std::move(command)};
            if (!child_executable.empty()) {
                child_args[0] = child_executable.string();
            }
        }
        if (child_executable.empty()) {
            child_executable = child_args[0];
        }

        // Candidate paths to try in order. A name with no slash is looked up along PATH, which is
        // what execvp would do, except that we cannot call it once the environment is replaced.
        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1912
        std::vector<std::string> exec_paths;
        {
            std::string name = child_executable.string();
            if (name.find('/') != std::string::npos) {
                exec_paths.push_back(name);
            } else {
                for (const auto &dir : exec_search_path(env)) {
                    exec_paths.push_back(dir + "/" + name);
                }
            }
        }
        if (exec_paths.empty()) {
            errorCode = std::make_error_code(std::errc::no_such_file_or_directory);
            error_msg = formatN("cannot find executable: %1", child_executable.string());
            return false;
        }

        std::vector<char *> exec_array;
        for (auto &path : exec_paths) {
            exec_array.push_back(path.data());
        }
        exec_array.push_back(nullptr);

        std::vector<char *> argv;
        for (auto &arg : child_args) {
            argv.push_back(arg.data());
        }
        argv.push_back(nullptr);

        // Built here rather than in the child, where allocating is not allowed.
        std::vector<std::string> env_items;
        std::vector<char *> envp;
        if (env) {
            for (const auto &pair : *env) {
                if (pair.first.find('=') != std::string::npos) {
                    errorCode = std::make_error_code(std::errc::invalid_argument);
                    error_msg = formatN("illegal environment variable name: %1", pair.first);
                    return false;
                }
                env_items.push_back(pair.first + "=" + pair.second);
            }
            for (auto &item : env_items) {
                envp.push_back(item.data());
            }
            envp.push_back(nullptr);
        }

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1885
        //
        // For transferring possible exec failure from child to parent.
        // Data format: "exception name:hex errno:description"
        int errpipe_read = -1, errpipe_write = -1;
        if (!make_pipe(errpipe_read, errpipe_write)) {
            errorCode = make_last_error_code();
            error_api = "pipe";
            return false;
        }

        {
            // errpipe_write must not be in the standard io 0, 1, or 2 fd range.
            std::vector<int> low_fds;
            auto close_low_fds_guard = make_scope_guard([&] {
                for (int fd : low_fds) {
                    close(fd);
                }
            });
            while (errpipe_write < 3) {
                low_fds.push_back(errpipe_write);
                errpipe_write = dup(errpipe_write);
                if (errpipe_write == -1) {
                    close(errpipe_read);
                    errorCode = make_last_error_code();
                    error_api = "dup";
                    return false;
                }
                set_cloexec(errpipe_write, true);
            }
        }

        std::vector<int> fds_to_keep = passFds;
        fds_to_keep.push_back(errpipe_write);
        std::sort(fds_to_keep.begin(), fds_to_keep.end());
        fds_to_keep.erase(std::unique(fds_to_keep.begin(), fds_to_keep.end()), fds_to_keep.end());

        std::string cwd_str = cwd.string();

        ChildArgs ca{};
        ca.exec_array = exec_array.data();
        ca.argv = argv.data();
        ca.envp = envp.empty() ? nullptr : envp.data();
        ca.cwd = cwd.empty() ? nullptr : cwd_str.c_str();
        ca.fds_to_keep = fds_to_keep.data();
        ca.fds_to_keep_len = fds_to_keep.size();
        ca.p2cread = p2cread, ca.p2cwrite = p2cwrite;
        ca.c2pread = c2pread, ca.c2pwrite = c2pwrite;
        ca.errread = errread, ca.errwrite = errwrite;
        ca.errpipe_read = errpipe_read, ca.errpipe_write = errpipe_write;
        ca.gid = gid;
        ca.uid = uid;
        ca.extra_gids = gids.data();
        ca.extra_gids_len = int(gids.size());

        std::string errpipe_data;

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1921
        {
            int tmp_pid = _fork_exec(ca);
            if (tmp_pid == -1) {
                auto err = make_last_error_code();
                close(errpipe_read);
                close(errpipe_write);
                errorCode = err;
                error_api = "fork";
                return false;
            }
            pid = tmp_pid > 0 ? tmp_pid : -1;
            if (tmp_pid > 0) {
                _child_created = !detached;
                _detached_started = detached;
            }
            close(errpipe_write);

            _close_pipe_fds(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);

            // Wait for exec to fail or succeed. The write end is open only in the child, so the
            // read goes to end of file as soon as exec replaces it.
            while (true) {
                char buf[4096];
                ssize_t n = read(errpipe_read, buf, sizeof(buf));
                if (n < 0 && errno == EINTR) {
                    continue;
                }
                if (n <= 0) {
                    break;
                }
                errpipe_data.append(buf, size_t(n));
                if (errpipe_data.size() > 50000) {
                    break;
                }
            }
            close(errpipe_read);
        }

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1942
        if (errpipe_data.empty() && !_child_created && !_detached_started) {
            errorCode = std::make_error_code(std::errc::io_error);
            error_msg = "detached launcher exited without reporting a child";
            return false;
        }
        if (errpipe_data.empty()) {
            return true;
        }

        if (_child_created) {
            // A normal child is still ours, so collect its failed pre-exec status.
            int status;
            pid_t ret_pid;
            do {
                ret_pid = waitpid(pid, &status, 0);
            } while (ret_pid == -1 && errno == EINTR);
            if (ret_pid == pid) {
                _handle_exitstatus(status);
            } else {
                returnCode = std::numeric_limits<int>::max();
            }
        }
        _child_created = false;
        _detached_started = false;
        pid = -1;

        // "exception name:hex errno:description"
        auto first = errpipe_data.find(':');
        auto second = first == std::string::npos ? first : errpipe_data.find(':', first + 1);
        if (second == std::string::npos) {
            errorCode = std::make_error_code(std::errc::bad_message);
            error_msg = formatN("bad exception data from child: %1", errpipe_data);
            return false;
        }

        auto hex_errno = errpipe_data.substr(first + 1, second - first - 1);
        auto detail = errpipe_data.substr(second + 1);
        int err_val = int(std::strtol(hex_errno.c_str(), nullptr, 16));
        if (err_val == 0) {
            errorCode = std::make_error_code(std::errc::bad_message);
            error_msg = detail.empty() ? "child failed before exec" : detail;
            return false;
        }

        errorCode = std::error_code(err_val, std::system_category());
        // "noexec:chdir" names the working directory, anything else names the program.
        error_msg =
            formatN("%1: %2", detail == "noexec:chdir" ? cwd_str : child_executable.string(),
                    errorCode.message());
        return false;
    }

    void Popen::Impl::_handle_exitstatus(int status) {
        if (WIFSTOPPED(status)) {
            returnCode = -WSTOPSIG(status);
        } else if (WIFSIGNALED(status)) {
            returnCode = -WTERMSIG(status);
        } else {
            returnCode = WEXITSTATUS(status);
        }
    }

    bool Popen::Impl::_internal_poll() {
        clear_error();

        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return false;
        }

        if (returnCode) {
            return true;
        }
        if (!_child_created) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return false;
        }

        // Two waitpid calls at once would race for the status, and only one of them could win.
        std::unique_lock<std::shared_mutex> lock(_waitpid_lock, std::try_to_lock);
        if (!lock.owns_lock()) {
            return false;
        }
        if (returnCode) {
            return true;
        }

        int status;
        pid_t ret = waitpid(pid, &status, WNOHANG);
        if (ret == pid) {
            _handle_exitstatus(status);
            return true;
        }
        if (ret == 0) {
            // Still running, which is not an error. The caller tells the two apart by whether
            // returnCode() is set.
            return false;
        }
        if (errno == EINTR) {
            return false;
        }
        if (errno == ECHILD) {
            // Waiting has been disabled for this process, so the status is gone for good. Python
            // reports 0 rather than leaving the caller with nothing.
            returnCode = 0;
            return true;
        }
        errorCode = make_last_error_code();
        return false;
    }

    bool Popen::Impl::_wait(int timeout) {
        clear_error();

        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return false;
        }

        if (returnCode) {
            return true;
        }
        if (!_child_created) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return false;
        }

        if (timeout < 0) {
            while (!returnCode) {
                std::unique_lock<std::shared_mutex> lock(_waitpid_lock);
                if (returnCode) {
                    break;
                }
                int status;
                pid_t ret = waitpid(pid, &status, 0);
                if (ret == pid) {
                    _handle_exitstatus(status);
                    break;
                }
                if (ret == -1) {
                    if (errno == EINTR) {
                        continue;
                    }
                    if (errno == ECHILD) {
                        returnCode = 0;
                        break;
                    }
                    errorCode = make_last_error_code();
                    return false;
                }
                // waitpid has been known to return 0 without WNOHANG, see bpo-14396.
            }
            return true;
        }

        // waitpid has no deadline, so poll with a delay that grows to 50 ms, as Python does.
        auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeout);
        auto delay = std::chrono::microseconds(500);
        while (true) {
            if (_internal_poll()) {
                return true;
            }
            if (errorCode.value() != 0) {
                return false;
            }
            auto now = std::chrono::steady_clock::now();
            if (now >= deadline) {
                return false;
            }
            auto remaining = std::chrono::duration_cast<std::chrono::microseconds>(deadline - now);
            delay = std::min({delay * 2, remaining, std::chrono::microseconds(50000)});
            std::this_thread::sleep_for(delay);
        }
    }

    bool Popen::Impl::kill_impl() {
        return send_signal_impl(SIGKILL);
    }

    bool Popen::Impl::terminate_impl() {
        return send_signal_impl(SIGTERM);
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L2218
    bool Popen::Impl::send_signal_impl(int sig) {
        clear_error();

        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return false;
        }

        // Polling first narrows the window in which the pid has been recycled and the signal
        // would land on somebody else's process.
        if (!returnCode) {
            std::ignore = _internal_poll();
            clear_error();
        }
        if (returnCode) {
            return true;
        }
        if (!_child_created) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return false;
        }

        if (::kill(pid, sig) == 0) {
            return true;
        }
        if (errno == ESRCH) {
            // It went away between the poll and the kill, which is not a failure.
            return true;
        }
        errorCode = make_last_error_code();
        return false;
    }

}

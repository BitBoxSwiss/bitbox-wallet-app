// SPDX-License-Identifier: MIT

#include "popen.h"
#include "popen_p.h"

#include <fcntl.h>
#include <io.h>

#include <array>
#include <thread>
#include <tuple>
#include <algorithm>
#include <cassert>
#include <set>

#include "winapi.h"
#include "str.h"
#include "scope_guard.h"
#include "vlarray.h"
#include "system.h"

namespace fs = std::filesystem;

namespace stdc {

    /// Runs \a body on a worker thread and leaves whatever it throws in \a error for the thread
    /// that joins it, since an exception crossing a thread boundary would call std::terminate.
    template <class F>
    void run_capturing(std::exception_ptr &error, F &&body) {
#ifdef STDC_HAS_EXCEPTIONS
        try {
            body();
        } catch (...) {
            error = std::current_exception();
        }
#else
        // Nothing can be thrown here, so nothing arrives to be reported and the slot stays empty.
        (void) error;
        body();
#endif
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1623
    //
    // A pipe blocks its writer once full, so stdout and stderr cannot be drained one after the
    // other, and neither can be drained after the child exits. All three streams have to move
    // at once, and on Windows an anonymous pipe cannot be waited on, so the only way to have
    // three things move at once is three threads. Python reaches the same conclusion here, and
    // polls instead on unix, which is what popen_unix.cpp does.
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

        std::string out, err;
        std::thread out_thread, err_thread, in_thread;
        std::exception_ptr out_error, err_error, in_error;

        const auto &read_all = [](FILE *file, std::string &dest, std::exception_ptr &error) {
            run_capturing(error, [&] {
                char buf[4096];
                size_t n;
                while ((n = std::fread(buf, 1, sizeof(buf), file)) > 0) {
                    dest.append(buf, n);
                }
            });
        };

        const auto &start_workers = [&] {
            if (stdout_stream.isOpen()) {
                out_thread =
                    std::thread(read_all, stdout_stream.file(), std::ref(out), std::ref(out_error));
            }
            if (stderr_stream.isOpen()) {
                err_thread =
                    std::thread(read_all, stderr_stream.file(), std::ref(err), std::ref(err_error));
            }

            // Input has its own worker too. Otherwise a child that never reads can fill the pipe
            // and block this thread before it ever reaches the timeout below.
            if (stdin_stream.isOpen()) {
                in_thread = std::thread([&] {
                    run_capturing(in_error, [&] {
                        if (!input.empty()) {
                            stdin_stream.write(input.data(), std::streamsize(input.size()));
                        }
                        stdin_stream.flush();
                        stdin_stream.close();
                    });
                });
            }
        };

#ifdef STDC_HAS_EXCEPTIONS
        try {
            start_workers();
        } catch (...) {
            // No writer exists yet when thread construction can fail, so closing stdin is safe.
            stdin_stream.close();
            std::ignore = kill_impl();
            std::ignore = _wait();
            if (out_thread.joinable())
                out_thread.join();
            if (err_thread.joinable())
                err_thread.join();
            close_std_files();
            throw;
        }
#else
        // Starting a thread can still fail, but without exceptions it takes the process down
        // where it happens rather than arriving here to be cleaned up after.
        start_workers();
#endif
        _communication_started = true;

        // A timeout kills the child rather than leaving it behind. Its exit is what closes the
        // write ends, and without that the reader threads below never finish.
        if (!_wait(timeout)) {
            auto wait_error = errorCode;
            std::ignore = kill_impl();
            std::ignore = _wait();
            errorCode =
                wait_error.value() != 0 ? wait_error : std::make_error_code(std::errc::timed_out);
        }

        if (in_thread.joinable()) {
            in_thread.join();
        }
        if (out_thread.joinable()) {
            out_thread.join();
        }
        if (err_thread.joinable()) {
            err_thread.join();
        }
        close_std_files();

#ifdef STDC_HAS_EXCEPTIONS
        if (in_error)
            std::rethrow_exception(in_error);
        if (out_error)
            std::rethrow_exception(out_error);
        if (err_error)
            std::rethrow_exception(err_error);
#endif
        return {out, err};
    }

    using namespace winapi;

    constexpr UINT KillProcessExitCode = 0xf291;

    void Popen::Impl::_reap() {
        if (_handle != InvalidHandle) {
            ::CloseHandle(_handle);
            _handle = InvalidHandle;
        }
        // pid and tid are left alone. They stay readable after the child exits, as in Python.
    }

    void Popen::Impl::_cleanup() {
        close_std_files();
        _reap();
    }

    /// Returns whether a standard handle can be used. GetStdHandle returns NULL when the process
    /// has no such handle, which is the case for every GUI subsystem process, and
    /// INVALID_HANDLE_VALUE when the call failed.
    static inline bool is_usable_std_handle(HANDLE handle) {
        return handle != nullptr && handle != INVALID_HANDLE_VALUE;
    }

    static inline std::error_code make_last_error_code() {
        return std::error_code(::GetLastError(), windows_utf8_category());
    }

    bool Popen::Impl::_get_devnull() {
        // Create a null device handle
        auto handle =
            ::CreateFileW(L"NUL", GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                          nullptr, OPEN_EXISTING, 0, nullptr);
        if (handle == INVALID_HANDLE_VALUE) {
            errorCode = make_last_error_code();
            error_api = "CreateFileW";
            return false;
        }
        _devnull = handle;
        return true;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1439
    //
    // Filter out console handles that can't be used
    // in lpAttributeList["handle_list"] and make sure the list
    // isn't empty. This also removes duplicate handles.
    template <class Container>
    static Container _filter_handle_list(const Container &handle_list) {
        // A handle with its lowest two bits set might be a special console
        // handle that if passed in lpAttributeList["handle_list"], will
        // cause it to fail.
        Container res;
        std::set<HANDLE> seen;
        for (HANDLE handle : handle_list) {
            if (((intptr_t) handle & 0x3) == 0x3 && ::GetFileType(handle) == FILE_TYPE_CHAR) {
                continue;
            }
            // UpdateProcThreadAttribute rejects a list with the same handle twice.
            if (!seen.insert(handle).second) {
                continue;
            }
            res.push_back(handle);
        }
        return res;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1351
    bool Popen::Impl::_get_handles(HANDLE &p2cread, HANDLE &p2cwrite, HANDLE &c2pread,
                                   HANDLE &c2pwrite, HANDLE &errread, HANDLE &errwrite) {
        if (stdin_dev.kind == 0 && stdout_dev.kind == 0 && stderr_dev.kind == 0) {
            return true;
        }

        //
        // helpers and guards
        //

        // handles that should be closed if error occurs
        std::array<HANDLE, 10> err_close_handles;
        int err_close_handles_cnt = 0;
        auto err_close_handle_guard = make_scope_guard([&]() {
            for (int i = 0; i < err_close_handles_cnt; i++) {
                ::CloseHandle(err_close_handles[i]);
            }
            if (_devnull != InvalidHandle) {
                ::CloseHandle(_devnull);
                _devnull = InvalidHandle;
            }
        });
        const auto &push_err_close_handle = [&](HANDLE handle) {
            err_close_handles[err_close_handles_cnt++] = handle;
        };

        // handles that should be closed anyway
        std::array<HANDLE, 10> dup_close_handles;
        int dup_close_handles_cnt = 0;
        auto dup_close_handle_guard = make_scope_guard([&]() {
            for (int i = 0; i < dup_close_handles_cnt; i++) {
                ::CloseHandle(dup_close_handles[i]);
            }
        });
        const auto &push_dup_close_handle = [&](HANDLE handle) {
            dup_close_handles[dup_close_handles_cnt++] = handle;
        };

        // duplicate the handle that needs to be inherited
        const auto &make_inheritable = [this](HANDLE &handle) {
            HANDLE target_handle;
            if (!::DuplicateHandle(GetCurrentProcess(), handle, ::GetCurrentProcess(),
                                   &target_handle, 0, 1, DUPLICATE_SAME_ACCESS)) {
                errorCode = make_last_error_code();
                error_api = "DuplicateHandle";
                return false;
            }
            handle = target_handle;
            return true;
        };

        // convert a file descriptor to a handle
        const auto &convert_from_fd = [this](HANDLE &handle, int fd) {
            auto tmp_handle = (HANDLE) _get_osfhandle(fd);
            if (tmp_handle == INVALID_HANDLE_VALUE) {
                errorCode = std::error_code(ERROR_INVALID_HANDLE, windows_utf8_category());
                error_api = "_get_osfhandle";
                return false;
            };
            handle = tmp_handle;
            return true;
        };

        // create a pipe
        const auto &create_pipe = [this](HANDLE &read_handle, HANDLE &write_handle) {
            if (!::CreatePipe(&read_handle, &write_handle, nullptr, 0)) {
                errorCode = make_last_error_code();
                error_api = "CreatePipe";
                return false;
            }
            return true;
        };

        // open or return devnull
        const auto &open_devnull = [this](HANDLE &handle) {
            if (_devnull == InvalidHandle && !_get_devnull()) {
                return false;
            }
            handle = _devnull;
            return true;
        };

        //
        // transaction start
        //

        // stdin
        switch (stdin_dev.kind) {
            case IODev::None: {
                p2cread = ::GetStdHandle(STD_INPUT_HANDLE);
                if (!is_usable_std_handle(p2cread)) {
                    HANDLE tmp_pipe;
                    if (!create_pipe(p2cread, tmp_pipe)) {
                        return false;
                    }
                    push_dup_close_handle(p2cread);
                    ::CloseHandle(tmp_pipe);
                }
                break;
            }
            case IODev::Builtin: {
                switch (stdin_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(p2cread, p2cwrite)) {
                            return false;
                        }
                        push_dup_close_handle(p2cread);
                        push_err_close_handle(p2cwrite);
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
                if (!convert_from_fd(p2cread, _fileno(stdin_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }
        if (!make_inheritable(p2cread)) {
            return false;
        }
        push_err_close_handle(p2cread);

        // stdout
        switch (stdout_dev.kind) {
            case IODev::None: {
                c2pwrite = ::GetStdHandle(STD_OUTPUT_HANDLE);
                if (!is_usable_std_handle(c2pwrite)) {
                    HANDLE tmp_pipe;
                    if (!create_pipe(tmp_pipe, c2pwrite)) {
                        return false;
                    }
                    push_dup_close_handle(c2pwrite);
                    ::CloseHandle(tmp_pipe);
                }
                break;
            }
            case IODev::Builtin: {
                switch (stdout_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(c2pread, c2pwrite)) {
                            return false;
                        }
                        push_err_close_handle(c2pread);
                        push_dup_close_handle(c2pwrite);
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
                if (!convert_from_fd(c2pwrite, _fileno(stdout_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }
        if (!make_inheritable(c2pwrite)) {
            return false;
        }
        push_err_close_handle(c2pwrite);

        // stderr
        switch (stderr_dev.kind) {
            case IODev::None: {
                errwrite = ::GetStdHandle(STD_ERROR_HANDLE);
                if (!is_usable_std_handle(errwrite)) {
                    HANDLE tmp_pipe;
                    if (!create_pipe(tmp_pipe, errwrite)) {
                        return false;
                    }
                    push_dup_close_handle(errwrite);
                    ::CloseHandle(tmp_pipe);
                }
                break;
            }
            case IODev::Builtin: {
                switch (stderr_dev.data.builtin) {
                    case Pipe: {
                        if (!create_pipe(errread, errwrite)) {
                            return false;
                        }
                        push_err_close_handle(errread);
                        push_dup_close_handle(errwrite);
                        break;
                    };
                    case DeviceNull: {
                        if (!open_devnull(errwrite)) {
                            return false;
                        }
                        break;
                    };
                    case StandardOutput: {
                        errwrite = c2pwrite;
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
                if (!convert_from_fd(errwrite, _fileno(stderr_dev.data.file))) {
                    return false;
                }
                break;
            }
            default:
                break;
        }
        if (!make_inheritable(errwrite)) {
            return false;
        }

        //
        // transaction end
        //

        // release guard
        err_close_handle_guard.dismiss();
        return true;
    }

    void Popen::Impl::_close_pipe_fds(Handle p2cread, int p2cwrite, int c2pread, Handle c2pwrite,
                                      int errread, Handle errwrite) {
        _close_pipe_fds_1(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);
        _closed_child_pipe_fds = true;
    }

    void Popen::Impl::_close_pipe_fds_1(Handle p2cread, int p2cwrite, int c2pread, Handle c2pwrite,
                                        int errread, Handle errwrite) {
        (void) p2cwrite;
        (void) c2pread;
        (void) errread;

        if (p2cread != InvalidHandle) {
            ::CloseHandle(p2cread);
        }
        if (c2pwrite != InvalidHandle) {
            ::CloseHandle(c2pwrite);
        }
        if (errwrite != InvalidHandle) {
            ::CloseHandle(errwrite);
        }
        if (_devnull != InvalidHandle) {
            ::CloseHandle(_devnull);
            _devnull = InvalidHandle;
        }
    }

    static fs::path _get_command_prompt_path(std::string &errMsg) {
        auto comspec = kernel32::GetEnvironmentVariableW(L"ComSpec", nullptr);
        fs::path comspec_path;
        if (comspec.empty()) {
            auto system_root = kernel32::GetEnvironmentVariableW(L"SystemRoot", nullptr);
            if (system_root.empty()) {
                errMsg = "shell not found: neither %ComSpec% nor %SystemRoot% is set";
                return {};
            }
            comspec_path = fs::path(system_root) / L"System32" / L"cmd.exe";
            if (!comspec_path.is_absolute()) {
                errMsg = "shell not found: constructed path is not absolute";
                return {};
            }
        } else {
            comspec_path = comspec;
        }
        return comspec_path;
    }

    // https://github.com/qt/qtbase/blob/v6.8.0/src/corelib/io/qprocess_win.cpp#L371
    static std::string qt_create_commandline(const std::string &program,
                                             const std::vector<std::string> &arguments,
                                             bool quote_all = false) {
        std::string args;
        if (!program.empty()) {
            std::string programName = program;
            if (!starts_with(programName, '\"') && !ends_with(programName, '\"') &&
                str::contains(programName, ' '))
                programName = '\"' + programName + '\"';
            std::replace(programName.begin(), programName.end(), '/', '\\');

            // add the program as the first arg ... it works better
            args = programName + ' ';
        }

        for (size_t i = 0; i < arguments.size(); ++i) {
            std::string tmp = arguments.at(i);
            // Quotes are escaped and their preceding backslashes are doubled. The counters must
            // be signed. The inner loop walks down past zero to stop, which an unsigned counter
            // would do by wrapping around.
            ptrdiff_t index = ptrdiff_t(tmp.find('"'));
            while (index >= 0) {
                // Escape quote
                tmp.insert(tmp.begin() + (index++), '\\');
                // Double preceding backslashes (ignoring the one we just inserted)
                for (ptrdiff_t j = index - 2; j >= 0 && tmp.at(j) == '\\'; --j) {
                    tmp.insert(tmp.begin() + j, '\\');
                    index++;
                }
                auto next = tmp.find('"', size_t(index) + 1);
                index = next == std::string::npos ? -1 : ptrdiff_t(next);
            }
            if (quote_all || tmp.empty() || str::contains(tmp, ' ') || str::contains(tmp, '\t')) {
                // The argument must not end with a \ since this would be interpreted
                // as escaping the quote -- rather put the \ behind the quote: e.g.
                // rather use "foo"\ than "foo\"
                size_t i = tmp.size();
                while (i > 0 && tmp.at(i - 1) == '\\')
                    --i;
                tmp.insert(tmp.begin() + i, '"');
                tmp.insert(tmp.begin(), '"');
            }

            // Spaces cannot be placed at the very beginning.
            if (!args.empty())
                args += ' ' + tmp;
            else
                args = tmp;
        }
        return args;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1157
    static inline LPHANDLE _get_handle_list(const vlarray<HANDLE, 10> &handles, SIZE_T *size) {
        if (handles.empty()) {
            return nullptr;
        }

        *size = handles.size() * sizeof(HANDLE);

        LPHANDLE ret = (LPHANDLE)::HeapAlloc(GetProcessHeap(), 0, *size);
        for (size_t i = 0; i < handles.size(); i++) {
            ret[i] = handles[i];
        }
        return ret;
    }

    struct AttributeList {
        LPPROC_THREAD_ATTRIBUTE_LIST attribute_list;
        LPHANDLE handle_list;
    };


    // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1210
    static void _free_attribute_list(AttributeList *attribute_list) {
        if (attribute_list->attribute_list != NULL) {
            ::DeleteProcThreadAttributeList(attribute_list->attribute_list);
            ::HeapFree(GetProcessHeap(), 0, attribute_list->attribute_list);
        }
        // This runs a second time on the error path, where the struct is already zeroed. HeapFree
        // is not documented to accept a null pointer.
        if (attribute_list->handle_list != NULL) {
            ::HeapFree(GetProcessHeap(), 0, attribute_list->handle_list);
        }
        memset(attribute_list, 0, sizeof(*attribute_list));
    }

    // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1223
    static std::tuple<std::error_code, const char *>
        _get_attribute_list(const vlarray<HANDLE, 10> &handles, AttributeList *attribute_list) {
        DWORD err;
        const char *err_api = nullptr;
        BOOL result;

        SIZE_T handle_list_size;
        int attribute_count = 0;
        SIZE_T attribute_list_size = 0;

        // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1251
        attribute_list->handle_list = _get_handle_list(handles, &handle_list_size);
        if (attribute_list->handle_list) {
            attribute_count++;
        }

        /* Get how many bytes we need for the attribute list */
        result =
            ::InitializeProcThreadAttributeList(NULL, attribute_count, 0, &attribute_list_size);
        if (result || ((err = ::GetLastError()) != ERROR_INSUFFICIENT_BUFFER)) {
            err_api = "InitializeProcThreadAttributeList";
            goto _cleanup;
        }

        attribute_list->attribute_list =
            (LPPROC_THREAD_ATTRIBUTE_LIST)::HeapAlloc(GetProcessHeap(), 0, attribute_list_size);
        if (!attribute_list->attribute_list) {
            err = ::GetLastError();
            err_api = "HeapAlloc";
            goto _cleanup;
        }

        result = ::InitializeProcThreadAttributeList(attribute_list->attribute_list,
                                                     attribute_count, 0, &attribute_list_size);
        if (!result) {
            err = ::GetLastError();

            /* So that we won't call DeleteProcThreadAttributeList */
            ::HeapFree(GetProcessHeap(), 0, attribute_list->attribute_list);
            attribute_list->attribute_list = NULL;

            err_api = "InitializeProcThreadAttributeList";
            goto _cleanup;
        }

        if (attribute_list->handle_list != NULL) {
            result = ::UpdateProcThreadAttribute(
                attribute_list->attribute_list, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                attribute_list->handle_list, handle_list_size, NULL, NULL);
            if (!result) {
                err = ::GetLastError();
                err_api = "UpdateProcThreadAttribute";
                goto _cleanup;
            }
        }

    _cleanup:
        if (err_api) {
            _free_attribute_list(attribute_list);
            return {std::error_code(err, windows_utf8_category()), err_api};
        }
        return {{}, {}};
    }

    // https://github.com/llvm/llvm-project/blob/llvmorg-21.1.8/llvm/lib/Support/Windows/Program.inc#L564
    bool system::command_line_fits(const std::vector<std::string> &args) {
        // CreateProcessW documents 32767 characters as the most lpCommandLine may be, counting
        // the terminator. Below that rather than at it, because a few things about the line
        // this function cannot see are still counted there.
        //
        // The line is built rather than estimated, since quoting is what makes an argument long:
        // one full of quotes and backslashes comes out at twice its length.
        static constexpr size_t limit = 32000;
        return qt_create_commandline({}, args).size() + 1 <= limit;
    }

    // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1452
    bool Popen::Impl::_execute_child(Handle p2cread, int p2cwrite, int c2pread, Handle c2pwrite,
                                     int errread, Handle errwrite) {
        assert(!args.empty());
        fs::path child_executable = executable;

        // A shell still receives the same argument vector. Quote every element and protect cmd's
        // metacharacters so it cannot reinterpret them before starting the requested command.
        std::vector<std::string> shell_args;
        if (shell) {
            shell_args = args;
            for (auto &arg : shell_args) {
                for (size_t i = 0; i < arg.size(); ++i) {
                    if (str::contains("^&|<>()%", arg[i])) {
                        arg.insert(i++, 1, '^');
                    }
                }
            }
        }
        std::string args_str = qt_create_commandline({}, shell ? shell_args : args, shell);

        STARTUPINFOEXW siex;
        ::ZeroMemory(&siex, sizeof(siex));
        STARTUPINFOW &si = siex.StartupInfo;
        si.cb = sizeof(siex);
        if (startupInfo) {
            si.dwFlags = startupInfo->dwFlags;
            si.hStdInput = startupInfo->hStdInput;
            si.hStdOutput = startupInfo->hStdOutput;
            si.hStdError = startupInfo->hStdError;
            si.wShowWindow = startupInfo->wShowWindow;
        }

        bool use_std_handles = false;
        if (p2cread != InvalidHandle && c2pwrite != InvalidHandle && errwrite != InvalidHandle) {
            use_std_handles = true;
            si.dwFlags |= STARTF_USESTDHANDLES;
            si.hStdInput = p2cread;
            si.hStdOutput = c2pwrite;
            si.hStdError = errwrite;
        }

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1499
        vlarray<HANDLE, 10> handle_list;
        if (startupInfo) {
            auto it = startupInfo->lpAttributeList.find("handle_list");
            if (it != startupInfo->lpAttributeList.end()) {
                HANDLE *handles = (HANDLE *) it->second;
                for (int i = 0; handles[i] != INVALID_HANDLE_VALUE; i++) {
                    handle_list.push_back(handles[i]);
                }
            }
        }

        if (!handle_list.empty() || (use_std_handles && closeFds)) {
            if (use_std_handles) {
                handle_list.push_back(p2cread);
                handle_list.push_back(c2pwrite);
                handle_list.push_back(errwrite);
            }

            handle_list = _filter_handle_list(handle_list);

            if (!handle_list.empty() && !closeFds) {
                fprintf(stderr, "stdc::Popen: %s\n", //
                        "startupInfo.lpAttributeList['handle_list'] overriding closeFds");
            }

            // When using the handle_list we always request to inherit
            // handles but the only handles that will be inherited are
            // the ones in the handle_list
            closeFds = false;
        }

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1526
        // prepare shell arguments
        if (shell) {
            // Python always hides it. Here startupInfo().dwFlags decides.
            if (!(si.dwFlags & STARTF_USESHOWWINDOW)) {
                si.dwFlags |= STARTF_USESHOWWINDOW;
                si.wShowWindow = SW_HIDE;
            }
            if (child_executable.empty()) {
                std::string errMsg;
                child_executable = _get_command_prompt_path(errMsg);
                if (!errMsg.empty()) {
                    errorCode = std::make_error_code(std::errc::no_such_file_or_directory);
                    error_msg = errMsg;
                    return false;
                }
            }
            args_str = formatN(R"(%1 /d /v:off /s /c "%2")", child_executable, args_str);
        }

        std::wstring application_name = child_executable;
        std::wstring command_line = wstring_conv::from_utf8(args_str);

        // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1374
        // prepare environment variables
        vlarray<wchar_t, 1024> env_str;
        if (env) {
            std::vector<std::pair<std::wstring, std::wstring>> wide_env;
            wide_env.reserve(env->size());
            for (const auto &item : *env) {
                if (item.first.empty() || item.first.find('=') != std::string::npos ||
                    item.first.find('\0') != std::string::npos ||
                    item.second.find('\0') != std::string::npos) {
                    errorCode = std::make_error_code(std::errc::invalid_argument);
                    error_msg = formatN("illegal environment variable: %1", item.first);
                    return false;
                }
                wide_env.emplace_back(wstring_conv::from_utf8(item.first),
                                      wstring_conv::from_utf8(item.second));
            }
            std::sort(wide_env.begin(), wide_env.end(), [](const auto &LHS, const auto &RHS) {
                return _wcsicmp(LHS.first.c_str(), RHS.first.c_str()) < 0;
            });
            for (const auto &item : wide_env) {
                env_str.insert(env_str.end(), item.first.begin(), item.first.end());
                env_str.push_back(L'=');
                env_str.insert(env_str.end(), item.second.begin(), item.second.end());
                env_str.push_back(L'\0');
            }
            // An environment block always ends in two nulls, including the empty block.
            env_str.push_back(L'\0');
            if (wide_env.empty()) {
                env_str.push_back(L'\0');
            }
        }

        DWORD dwCreationFlags;
        PROCESS_INFORMATION pi;

        // https://github.com/python/cpython/blob/v3.13.13/Modules/_winapi.c#L1380
        AttributeList attribute_list = {0};
        if (auto [ec, err_api] = _get_attribute_list(handle_list, &attribute_list);
            ec.value() != 0) {
            errorCode = ec;
            error_api = err_api;
            goto _cleanup;
        }

        dwCreationFlags = creationFlags | EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT;

        // https://github.com/python/cpython/blob/v3.13.13/Lib/subprocess.py#L1554
        if (!::CreateProcessW(application_name.empty() ? NULL : application_name.data(), //
                              command_line.data(),                                       //
                              nullptr,                                                   //
                              nullptr,                                                   //
                              !closeFds,                                                 //
                              dwCreationFlags,                                           //
                              env ? env_str.data() : NULL,                               //
                              cwd.empty() ? NULL : cwd.c_str(),
                              (LPSTARTUPINFOW) &siex, //
                              &pi                     //
                              )) {
            errorCode = make_last_error_code();
            error_api = "CreateProcessW";
            goto _cleanup;
        }

        _handle = pi.hProcess;
        ::CloseHandle(pi.hThread);
        pid = pi.dwProcessId;
        tid = pi.dwThreadId;

        if (detached) {
            _detached_started = true;
            _reap();
        } else {
            _child_created = true;
        }

    _cleanup:
        _free_attribute_list(&attribute_list);

        // Child is launched. Close the parent's copy of those pipe
        // handles that only the child should have open.  You need
        // to make sure that no handles to the write end of the
        // output pipe are maintained in this process or else the
        // pipe will not close when the child process exits and the
        // ReadFile will hang.
        _close_pipe_fds(p2cread, p2cwrite, c2pread, c2pwrite, errread, errwrite);

        return errorCode.value() == 0;
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
        DWORD result = ::WaitForSingleObject(_handle, 0);
        switch (result) {
            case WAIT_OBJECT_0: {
                DWORD exitCode;
                if (!::GetExitCodeProcess(_handle, &exitCode)) {
                    errorCode = make_last_error_code();
                    return false;
                }
                returnCode = exitCode;
                _reap();
                return true;
            }
            case WAIT_FAILED: {
                errorCode = make_last_error_code();
                return false;
            }
            default:
                break;
        }
        // Still running, which is not an error. The caller tells the two apart by whether
        // returnCode() is set.
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
            timeout = INFINITE;
        }

        DWORD result = ::WaitForSingleObject(_handle, timeout);
        switch (result) {
            case WAIT_TIMEOUT: {
                return false;
            }
            case WAIT_FAILED: {
                errorCode = make_last_error_code();
                return false;
            }
            default:
                break;
        }

        DWORD exitCode;
        if (!::GetExitCodeProcess(_handle, &exitCode)) {
            errorCode = make_last_error_code();
            return false;
        }
        returnCode = exitCode;
        _reap();
        return true;
    }

    bool Popen::Impl::kill_impl() {
        clear_error();

        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return false;
        }

        if (returnCode) {
            return true;
        }
        // Before the handle is used for anything. Where nothing was started it is
        // InvalidHandle, which is (HANDLE) -1, which is the pseudo handle standing for the
        // calling process: TerminateProcess on it killed the program that asked, with the exit
        // code meant for the child.
        if (!_child_created) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return false;
        }
        if (::TerminateProcess(_handle, KillProcessExitCode)) {
            return true;
        }

        auto err = ::GetLastError();
        if (err == ERROR_ACCESS_DENIED) {
            DWORD exitCode;

            std::ignore = ::GetExitCodeProcess(_handle, &exitCode);
            if (exitCode == STILL_ACTIVE) {
                errorCode.assign(err, windows_utf8_category());
                return false;
            }
            returnCode = exitCode;
            _reap();
            return true;
        }
        errorCode.assign(err, windows_utf8_category());
        return false;
    }

    static BOOL CALLBACK qt_terminateApp(HWND hwnd, LPARAM procId) {
        DWORD currentProcId = 0;
        std::ignore = ::GetWindowThreadProcessId(hwnd, &currentProcId);
        if (currentProcId == (DWORD) procId)
            std::ignore = ::PostMessageW(hwnd, WM_CLOSE, 0, 0);
        return TRUE;
    }

    // https://github.com/qt/qtbase/blob/v6.8.0/src/corelib/io/qprocess_win.cpp#L641
    bool Popen::Impl::terminate_impl() {
        clear_error();

        if (_detached_started) {
            errorCode = std::make_error_code(std::errc::operation_not_supported);
            return false;
        }

        if (returnCode) {
            return true;
        }
        if (!_child_created || tid < 0) {
            errorCode = std::make_error_code(std::errc::no_such_process);
            return false;
        }
        // Both calls are a request, not a guarantee. A process with no windows and no message
        // loop notices neither. Qt ignores the return values for that reason, since finding
        // nothing to close is not a failure, and so do we.
        std::ignore = ::EnumWindows(qt_terminateApp, (LPARAM) pid);
        std::ignore = ::PostThreadMessageW(tid, WM_CLOSE, 0, 0);
        return true;
    }

    bool Popen::Impl::send_signal_impl(int sig) {
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

        if (sig == CTRL_C_EVENT || sig == CTRL_BREAK_EVENT) {
            if (::GenerateConsoleCtrlEvent(sig, pid)) {
                return true;
            }
            errorCode = make_last_error_code();
            return false;
        }
        errorCode = std::error_code(ERROR_NOT_SUPPORTED, windows_utf8_category());
        return false;
    }

}

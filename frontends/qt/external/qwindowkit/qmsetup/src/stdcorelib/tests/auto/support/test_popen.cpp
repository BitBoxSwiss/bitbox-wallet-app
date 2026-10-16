// SPDX-License-Identifier: MIT

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iterator>
#include <map>
#include <string>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

#include <stdcorelib/scope_guard.h>
#include <stdcorelib/str.h>
#include <stdcorelib/support/popen.h>
#include <stdcorelib/system.h>

#include <boost/test/unit_test.hpp>

#ifdef _WIN32
#  include <stdcorelib/platform/windows/stdc_windows.h>
#else
#  include <csignal>
#  include <cstring>
#  include <dirent.h>
#  include <fcntl.h>
#  include <pwd.h>
#  include <sys/wait.h>
#  include <unistd.h>
#endif

using namespace stdc;

// Const on the Popen says nothing about the pipes, so a const one still hands back a stream
// that can be written. Deliberate, and stated on the declarations.
static_assert(
    std::is_same_v<decltype(std::declval<const Popen &>().standardInput()), Popen::Stream &>);
static_assert(
    std::is_same_v<decltype(std::declval<const Popen &>().standardOutput()), Popen::Stream &>);
static_assert(
    std::is_same_v<decltype(std::declval<const Popen &>().standardError()), Popen::Stream &>);

// What is in here, in order. Each line is the heading of a section below, spelled the same way,
// so searching for one lands on it. No line numbers: they would be wrong by the next commit.
//
//     Starting one, and what comes back
//     Reading from it and writing to it
//     Where it starts, and what it starts with
//     Ending it
//     What crosses into the child, and what must not
//     The command line, and what the platform makes of it
//     The pipes as iostreams
//     The lifetime of the Popen itself
//     Redirection, and text mode

BOOST_AUTO_TEST_SUITE(test_popen)

namespace {

    // Every wait here is bounded, so a regression hangs the one case rather than the whole run.
    constexpr int Timeout = 15000;

    // The helper program, named once rather than expanded at every use, since a macro standing
    // where a value belongs reads as a value the reader has to go and look up.
    const char ChildPath[] = TEST_POPEN_CHILD_PATH;

    // The same child behavior spelled in each platform's shell.
#ifdef _WIN32
    const char *ShellExe = "cmd";
    const char *ShellFlag = "/c";
    const char *EchoHello = "echo hello";
    const char *EchoOutErr = "echo out& echo err 1>&2";
    const char *EchoErr = "echo err 1>&2";
    const char *EchoThree = "echo one& echo two& echo three";
    const char *PrintCwd = "cd";
    const char *ExitZero = "exit 0";
    const char *ExitThree = "exit 3";
    const char *BigOutput = "for /L %i in (1,1,5000) do @echo 0123456789012345678901234567890123";
    // Long enough that the process is certainly still up when we look, short enough that a
    // leaked one goes away on its own.
    const char *SleepLong = "ping -n 20 127.0.0.1 >nul";
    const std::vector<std::string> SleepArgs = {"ping", "-n", "20", "127.0.0.1"};
    const std::vector<std::string> FilterX = {"findstr", "x"};
#else
    const char *ShellExe = "/bin/sh";
    const char *ShellFlag = "-c";
    const char *EchoHello = "echo hello";
    const char *EchoOutErr = "echo out; echo err 1>&2";
    const char *EchoErr = "echo err 1>&2";
    const char *EchoThree = "echo one; echo two; echo three";
    const char *PrintCwd = "pwd";
    const char *ExitZero = "exit 0";
    const char *ExitThree = "exit 3";
    const char *BigOutput = "i=0; while [ $i -lt 5000 ]; do "
                            "echo 0123456789012345678901234567890123; i=$((i+1)); done";
    const char *SleepLong = "sleep 20";
    const std::vector<std::string> SleepArgs = {"sleep", "20"};
    const std::vector<std::string> FilterX = {"grep", "x"};
#endif

    // Whether a pid still names a live process, asked from outside the Popen that started it.
    bool process_alive(int pid) {
#ifdef _WIN32
        HANDLE h = ::OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, DWORD(pid));
        if (!h) {
            return false;
        }
        DWORD code = 0;
        bool alive = ::GetExitCodeProcess(h, &code) && code == STILL_ACTIVE;
        ::CloseHandle(h);
        return alive;
#else
        return ::kill(pid_t(pid), 0) == 0;
#endif
    }

    void hard_kill(int pid) {
#ifdef _WIN32
        if (HANDLE h = ::OpenProcess(PROCESS_TERMINATE, FALSE, DWORD(pid))) {
            ::TerminateProcess(h, 1);
            ::CloseHandle(h);
        }
#else
        ::kill(pid_t(pid), SIGKILL);
        int status;
        ::waitpid(pid_t(pid), &status, 0);
#endif
    }

    std::vector<std::string> shell_args(const char *script) {
        return {ShellExe, ShellFlag, script};
    }

    // The helper program, with its mode and whatever the mode takes.
    std::vector<std::string> child_args(std::vector<std::string> rest) {
        std::vector<std::string> args = {ChildPath};
        args.insert(args.end(), rest.begin(), rest.end());
        return args;
    }

    // A path of our own under the temporary directory, removed by the guard that owns it.
    class TempFile {
    public:
        explicit TempFile(const char *tag) {
            _path = std::filesystem::temp_directory_path() /
                    ("stdc_popen_" + std::string(tag) + "_" +
                     std::to_string(std::chrono::steady_clock::now().time_since_epoch().count() %
                                    1000000));
        }
        ~TempFile() {
            std::error_code ec;
            std::filesystem::remove(_path, ec);
        }
        const std::filesystem::path &path() const {
            return _path;
        }
        std::string read() const {
            std::ifstream in(_path, std::ios::binary);
            return std::string(std::istreambuf_iterator<char>(in),
                               std::istreambuf_iterator<char>());
        }

    private:
        std::filesystem::path _path;

        TempFile(const TempFile &) = delete;
        TempFile &operator=(const TempFile &) = delete;
    };

    // The first line of the child's output. Trailing blanks go too: `echo err 1>&2` in cmd
    // emits the space before the redirection as part of the text.
    std::string first_line(const std::string &s) {
        auto end = s.find_first_of("\r\n");
        std::string line = end == std::string::npos ? s : s.substr(0, end);
        while (!line.empty() && (line.back() == ' ' || line.back() == '\t')) {
            line.pop_back();
        }
        return line;
    }

}

// ---------------------------------------------------------------------------------------------
// Starting one, and what comes back
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_run_and_returncode) {
    {
        Popen p;
        p.args(shell_args(ExitZero));
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK(p.pid() > 0);
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // a non-zero exit status comes back as-is
    {
        Popen p;
        p.args(shell_args(ExitThree));
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 3);
    }

    // starting something that does not exist fails, with a message
    {
        Popen p;
        p.args({"no_such_program_9f3a"});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }
}

// A failed start is retryable after correcting the setup; stale error state must not turn a
// successfully created child into a reported failure.
BOOST_AUTO_TEST_CASE(test_start_retry) {
    {
        Popen p;
        p.args(shell_args(ExitZero)).standardInput(Popen::StandardOutput);
        BOOST_CHECK(!p.start());
        BOOST_CHECK(p.errorCode());

        p.standardInput(Popen::DeviceNull);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // Also cover a failure from CreateProcess/exec, after the pipes and (on POSIX) a short-lived
    // child have already been created.
    {
        Popen p;
        p.args({"no_such_executable_9f3a"}).standardOutput(Popen::Pipe);
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());

        p.args(shell_args(ExitZero));
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        std::ignore = p.communicate({}, Timeout);
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }
}

// Shell mode changes how the process is reached, not what the argument vector means.
BOOST_AUTO_TEST_CASE(test_shell) {
    {
        Popen p;
        p.args({ChildPath, "argv", "two words", "quote\"here", "single'here", "a&b", "a|b", "a<b",
                "a>b", "a(b)", "a^b", "$HOME", "%PATH%", "!PATH!", ""})
            .shell(true)
            .standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out,
                          "two words\nquote\"here\nsingle'here\na&b\na|b\na<b\na>b\na(b)\na^b\n"
                          "$HOME\n%PATH%\n!PATH!\n\n");
    }

    // Choosing the shell explicitly keeps the same command construction.
    {
        Popen p;
        std::filesystem::path shell_executable = ShellExe;
#ifdef _WIN32
        const char *comspec = std::getenv("ComSpec");
        BOOST_REQUIRE(comspec != nullptr);
        shell_executable = comspec;
#endif
        p.args({ChildPath, "argv", "custom shell"})
            .shell(true)
            .executable(std::move(shell_executable))
            .standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out, "custom shell\n");
    }

    // Empty args still cannot name anything to run.
    {
        Popen p;
        p.args({}).shell(true);
        BOOST_CHECK(!p.start());
        BOOST_CHECK(p.errorCode() == std::errc::invalid_argument);
        BOOST_CHECK(!p.errorMessage().empty());
        BOOST_CHECK_EQUAL(p.pid(), -1);
        BOOST_CHECK(!p.returnCode());
    }
}

// A std::string can hold a NUL and no platform can pass one on, so a child would have been
// started with an argument that is not the one it was given. Refused before anything is created.
BOOST_AUTO_TEST_CASE(test_a_nul_inside_an_argument_or_the_environment_is_refused) {
    const std::string embedded("a\0b", 3);

    const auto &refused = [](Popen &p) {
        BOOST_CHECK(!p.start());
        BOOST_CHECK(p.errorCode() == std::errc::invalid_argument);
        BOOST_CHECK(!p.errorMessage().empty());
        // Nothing was created, so there is nothing to wait for and nothing to reap.
        BOOST_CHECK(!p.returnCode().has_value());
    };

    {
        Popen p;
        p.args({ChildPath, "argv", embedded});
        refused(p);
    }
    {
        Popen p;
        p.args({std::string(ChildPath) + embedded, "argv"});
        refused(p);
    }
    // clang-format explodes a braced list inside a chained call, so not here.
    // clang-format off
    {
        Popen p;
        p.args({ChildPath, "argv"}).env({{"NAME", embedded}});
        refused(p);
    }
    {
        Popen p;
        p.args({ChildPath, "argv"}).env({{embedded, "value"}});
        refused(p);
    }
    {
        Popen p;
        p.args({ChildPath, "argv"}).env({{"", "value"}});
        refused(p);
    }
    // clang-format on

    // Corrected, the same object starts, so the refusal changed nothing.
    Popen p;
    p.args({ChildPath, "argv", embedded}).standardOutput(Popen::Pipe);
    BOOST_CHECK(!p.start());
    p.args({ChildPath, "argv", "ab"});
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, ignored] = p.communicate({}, Timeout);
    BOOST_CHECK(out.find("ab") != std::string::npos);
}

// Everything that talks to a child says the same thing when there is no child, on both
// platforms. On Windows four of the six reached the system with the handle a Popen carries
// before it has started anything, which is InvalidHandle, which is (HANDLE) -1, which is the
// pseudo handle for the calling process. kill() terminated the program that called it, with
// the exit code meant for the child, and poll() and wait() waited on it and answered false
// with no reason given. Only terminate() looked first.
BOOST_AUTO_TEST_CASE(test_nothing_started_means_no_such_process) {
    // The call runs first and the error is read after, in two statements: as one call the
    // order the arguments are evaluated in is nobody's to say, and the answer would be the
    // error left by whatever ran before.
    const auto &asked = [](const char *what, const std::function<bool(Popen &)> &call) {
        Popen p;
        p.args({ChildPath, "exit", "0"});
        bool answered = call(p);
        auto ec = p.errorCode();
        BOOST_CHECK_MESSAGE(!answered, std::string(what) + " answered yes with nothing started");
        BOOST_CHECK_MESSAGE(ec == std::errc::no_such_process,
                            std::string(what) + " gave " + ec.message());
    };

    asked("poll", [](Popen &p) { return p.poll(); });
    // Bounded, since waiting on the calling process with no timeout is a hang rather than a
    // wrong answer.
    asked("wait", [](Popen &p) { return p.wait(1000); });
    asked("kill", [](Popen &p) { return p.kill(); });
    asked("terminate", [](Popen &p) { return p.terminate(); });
#ifdef _WIN32
    asked("sendSignal", [](Popen &p) { return p.sendSignal(CTRL_BREAK_EVENT); });
#else
    asked("sendSignal", [](Popen &p) { return p.sendSignal(SIGTERM); });
#endif
    {
        Popen p;
        p.args({ChildPath, "exit", "0"});
        auto [out, err] = p.communicate({}, 1000);
        BOOST_CHECK(out.empty());
        BOOST_CHECK(err.empty());
        BOOST_CHECK(p.errorCode() == std::errc::no_such_process);
    }

    // And none of it left anything behind, so the same object still starts.
    Popen p;
    p.args({ChildPath, "exit", "3"});
    BOOST_CHECK(!p.poll());
    BOOST_CHECK(!p.kill());
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK_EQUAL(*p.returnCode(), 3);
}

BOOST_AUTO_TEST_CASE(test_errorMessage_answers_for_every_operation) {
    // Every operation records what it failed at. Only start() used to be able to say it.
    {
        Popen p;
        p.args({ChildPath, "exit", "0"});
        bool answered = p.wait(1000);
        const std::string message = p.errorMessage();
        BOOST_CHECK(!answered);
        BOOST_CHECK_MESSAGE(!message.empty(), "wait failed without saying why");
    }

    // A request turned down before any system call was reached has no errno to describe it, so
    // these words are the only account of it there is. The start that follows has to clear them:
    // a message left over from an earlier failure would read as a current one.
    {
        Popen p;
        p.args({ChildPath, "exit", "0"}).standardInput(Popen::StandardOutput);
        BOOST_REQUIRE(!p.start());
        const std::string refused = p.errorMessage();
        BOOST_CHECK(!refused.empty());
        BOOST_CHECK(refused != p.errorCode().message());

        p.standardInput(Popen::DeviceNull);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK_EQUAL(p.errorMessage(), std::string());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(p.errorMessage(), std::string());
    }
}

// A bare name is looked up along PATH, the same way a shell would find it.
BOOST_AUTO_TEST_CASE(test_path_lookup) {
    Popen p;
#ifdef _WIN32
    p.args({"cmd", "/c", "exit 0"});
#else
    p.args({"echo", "found"}).standardOutput(Popen::Pipe);
#endif
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

#ifdef _WIN32
// creationFlags goes straight through to CreateProcess, and CREATE_SUSPENDED is the flag whose
// effect a parent can see without the child agreeing to anything: one that would exit at once
// does not, because it has not been let run.
BOOST_AUTO_TEST_CASE(test_creation_flags_reach_create_process) {
    Popen p;
    p.args(child_args({"exit", "0"})).creationFlags(CREATE_SUSPENDED);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_CHECK(p.pid() > 0);

    // Started and suspended, so there is nothing to report and nothing to wait for.
    BOOST_CHECK(!p.poll());
    BOOST_CHECK(!p.wait(200));
    BOOST_CHECK(!p.returnCode().has_value());

    // It is still ours to end, suspended or not.
    BOOST_CHECK(p.kill());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK(p.returnCode().has_value());
}
#endif

// The getter answers with the setting rather than with what will run, so an unset one is empty
// and not args[0]. Nothing had read it back at all.
BOOST_AUTO_TEST_CASE(test_the_executable_getter_answers_with_the_setting) {
    Popen p;
    BOOST_CHECK(p.executable().empty());

    // Still empty with args in place, which is the case worth pinning: args[0] is what runs
    // here, and the getter does not say so.
    p.args({"echo", "found"});
    BOOST_CHECK(p.executable().empty());
    BOOST_CHECK_EQUAL(p.args()[0], "echo");

    // And set, it comes back as written.
    p.executable("/bin/busybox");
    BOOST_CHECK(p.executable() == std::filesystem::path("/bin/busybox"));
    BOOST_CHECK_EQUAL(p.args()[0], "echo");
}

// The point of executable(): the file that runs and the name the program is given are two
// separate things, which is what execve takes and what CreateProcess takes. Only the failing
// half of this was covered, so nothing said a child really answers with the name it was handed
// rather than with the file it came from.
BOOST_AUTO_TEST_CASE(test_a_child_is_given_the_name_and_not_the_file) {
    // Without it the two are the same, since args[0] does both jobs.
    {
        Popen p;
        p.args(child_args({"arg0"})).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, _] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), ChildPath);
    }

    // With it they part: the loaded file is the helper, and what it reads back is the name.
    {
        Popen p;
        p.executable(ChildPath).args({"a-name-of-its-own", "arg0"}).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, _] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "a-name-of-its-own");
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }
}

// wait() used to close the pipes along with the process handle, which threw away the output
// before anyone could read it.
BOOST_AUTO_TEST_CASE(test_output_survives_wait) {
    Popen p;
    p.args(shell_args(EchoHello)).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));

    auto &out = p.standardOutput();
    BOOST_REQUIRE(out.isOpen());
    std::string line;
    BOOST_REQUIRE(std::getline(out, line));
    BOOST_CHECK_EQUAL(first_line(line), "hello");
}

// ---------------------------------------------------------------------------------------------
// Reading from it and writing to it
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_communicate) {
    // stdout only
    {
        Popen p;
        p.args(shell_args(EchoHello)).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "hello");
        BOOST_CHECK(errout.empty());
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // stdout and stderr kept apart
    {
        Popen p;
        p.args(shell_args(EchoOutErr)).standardOutput(Popen::Pipe).standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "out");
        BOOST_CHECK_EQUAL(first_line(errout), "err");
    }

    // stderr folded into stdout
    {
        Popen p;
        p.args(shell_args(EchoErr))
            .standardOutput(Popen::Pipe)
            .standardError(Popen::StandardOutput);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "err");
        BOOST_CHECK(errout.empty());
    }

    // input is written and the pipe closed, so a filter can finish
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate("abc\nxyz\ndef\n", Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "xyz");
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // more output than a pipe buffer holds, which is the case a single-threaded reader deadlocks
    {
        Popen p;
        p.args(shell_args(BigOutput)).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_GT(out.size(), 100000u);
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // a child that outlives the timeout is killed rather than left behind
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        // no input, so the filter would wait forever
        auto [out, errout] = p.communicate("no match here\n", 500);
        BOOST_REQUIRE(p.returnCode());
    }

    // The timeout covers writing too. This child never reads stdin, so a synchronous writer
    // would fill the pipe and hang before reaching wait().
    {
        Popen p;
        p.args(SleepArgs).standardInput(Popen::Pipe).standardOutput(Popen::DeviceNull);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        std::string input(1 << 20, 'x');
        auto started = std::chrono::steady_clock::now();
        std::ignore = p.communicate(input, 300);
        auto elapsed = std::chrono::steady_clock::now() - started;
        BOOST_CHECK(elapsed < std::chrono::seconds(5));
        BOOST_CHECK(p.errorCode() == std::make_error_code(std::errc::timed_out));
        BOOST_REQUIRE(p.returnCode());
    }
}

// Writing to a pipe whose reader has already exited raises SIGPIPE on POSIX, and its default
// action would take the whole test runner with it.
BOOST_AUTO_TEST_CASE(test_write_to_dead_child) {
    Popen p;
    p.args(shell_args(ExitZero)).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));

    std::string big(1 << 20, 'x');
    auto [out, errout] = p.communicate(big, Timeout);
    BOOST_REQUIRE(p.returnCode());
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

// Without a way to close this side of the pipe, a child reading to end of input never returns.
BOOST_AUTO_TEST_CASE(test_close_stdin_ends_input) {
    Popen p;
    p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    auto &in = p.standardInput();
    BOOST_REQUIRE(in.isOpen());
    in << "xyz\n" << std::flush;

    // still running: nothing has told it the input is over
    BOOST_CHECK(!p.wait(200));
    BOOST_CHECK(!p.returnCode());

    p.standardInput().close();
    BOOST_CHECK(!p.standardInput().isOpen());

    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_REQUIRE(p.returnCode());
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

// poll() returning false means "not finished", which is not an error, and it must not pick up
// whatever the last failed system call happened to leave behind.
BOOST_AUTO_TEST_CASE(test_poll) {
    Popen p;
    p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    BOOST_CHECK(!p.poll());
    BOOST_CHECK(!p.returnCode());
    BOOST_CHECK_EQUAL(p.errorCode().value(), 0);

    p.standardInput().close();
    BOOST_REQUIRE(p.wait(Timeout));

    // once it has exited, poll() says so and keeps saying so
    BOOST_CHECK(p.poll());
    BOOST_REQUIRE(p.returnCode());
    BOOST_CHECK(p.poll());
    BOOST_CHECK_EQUAL(p.errorCode().value(), 0);
}

// ---------------------------------------------------------------------------------------------
// Where it starts, and what it starts with
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_cwd) {
    Popen p;
#ifdef _WIN32
    const char *dir = "C:\\Windows";
#else
    const char *dir = "/usr";
#endif
    p.args(shell_args(PrintCwd)).cwd(dir).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(out), dir);
}

// A working directory that does not exist fails at start, and says which one.
BOOST_AUTO_TEST_CASE(test_bad_cwd) {
    Popen p;
    p.args(shell_args(ExitZero)).cwd("no_such_dir_9f3a");
    BOOST_CHECK(!p.start());
    BOOST_CHECK(!p.errorMessage().empty());
}

#ifdef _WIN32

BOOST_AUTO_TEST_CASE(test_unicode_environment) {
    wchar_t marker[2];
    if (::GetEnvironmentVariableW(L"STDC_POPEN_UNICODE_CHILD", marker, 2) != 0) {
        wchar_t value[32];
        DWORD size = ::GetEnvironmentVariableW(L"\u53d8\u91cf", value, DWORD(std::size(value)));
        BOOST_REQUIRE(size > 0 && size < std::size(value));
        BOOST_CHECK(std::wstring(value, size) == L"\u503c\u6d4b\u8bd5");
        return;
    }

    // A replaced environment is the point of the case, but the child is this binary again and
    // has to be able to load before it can check anything. Where the runtime sits outside the
    // application directory, which is every MinGW build, PATH is what finds it. Measured: a
    // MinGW binary started with an empty environment fails at 0xC0000135 before main().
    std::map<std::string, std::string> childEnv{
        {"STDC_POPEN_UNICODE_CHILD", "1"                 },
        {"\u53d8\u91cf",             "\u503c\u6d4b\u8bd5"},
    };
    for (const auto &item : system::environment()) {
        if (str::equals_insensitive(item.first, "PATH")) {
            childEnv.insert(item);
            break;
        }
    }

    Popen p;
    p.args({system::application_path().string(), "--run_test=test_popen/test_unicode_environment",
            "--log_level=nothing"})
        .env(childEnv);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

#endif

#ifndef _WIN32

// The child's environment is replaced, not merged.
BOOST_AUTO_TEST_CASE(test_env) {
    Popen p;
    p.args({
               "/bin/sh", "-c", "echo $FOO"
    })
        .env({{"FOO", "bar"}, {"PATH", "/bin:/usr/bin"}})
        .standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(out), "bar");
}

BOOST_AUTO_TEST_CASE(test_replaced_env_does_not_use_parent_path) {
    Popen p;
    p.args({
               "sh", "-c", "exit 0"
    })
        .env({{"FOO", "bar"}});
    BOOST_CHECK(!p.start());
    BOOST_CHECK(p.errorCode() == std::make_error_code(std::errc::no_such_file_or_directory));
}

BOOST_AUTO_TEST_CASE(test_user_name_is_owned) {
    struct passwd *pw = getpwuid(getuid());
    BOOST_REQUIRE(pw != nullptr);

    Popen p;
    std::string name = pw->pw_name;
    p.args(shell_args(ExitZero)).user(name.c_str());
    name.assign(name.size(), 'x');
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}


// A start that failed can be corrected and tried again, which means it has to leave the
// configuration where it found it. The shell path put /bin/sh -c into args itself, before
// anything that can fail, so the second start inserted it again and ran something else. The
// case that covered retrying used no shell, and the case above never fails.
BOOST_AUTO_TEST_CASE(test_a_failed_shell_start_leaves_the_arguments_alone) {
    const std::vector<std::string> wanted = {ChildPath, "argv", "retry-ok"};

    Popen p;
    p.args(wanted).shell(true).cwd("no_such_directory_9f3a").standardOutput(Popen::Pipe);

    BOOST_CHECK(!p.start());
    // Item by item, since the defect was an insert at the front rather than a change of one.
    BOOST_CHECK(p.args() == wanted);

    p.cwd({});
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, unused] = p.communicate({}, Timeout);
    BOOST_CHECK(p.args() == wanted);
    BOOST_CHECK_EQUAL(first_line(out), "retry-ok");

    // And what the retry ran is what a new object with the same configuration runs.
    Popen fresh;
    fresh.args(wanted).shell(true).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(fresh.start(), fresh.errorMessage());
    auto [fresh_out, ignored] = fresh.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(fresh_out), first_line(out));
}

// The other place a start can fail, since the insert happened before both and the one above
// only covers the chdir.
BOOST_AUTO_TEST_CASE(test_a_shell_start_that_fails_at_exec_leaves_them_alone_too) {
    const std::vector<std::string> wanted = {ChildPath, "argv", "retry-ok"};

    Popen p;
    p.args(wanted).shell(true).executable("no_such_shell_9f3a").standardOutput(Popen::Pipe);
    BOOST_CHECK(!p.start());
    BOOST_CHECK(p.args() == wanted);

    p.executable({});
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, ignored] = p.communicate({}, Timeout);
    BOOST_CHECK(p.args() == wanted);
    BOOST_CHECK_EQUAL(first_line(out), "retry-ok");
}

// ---------------------------------------------------------------------------------------------
// Ending it
// ---------------------------------------------------------------------------------------------

// kill() and terminate() are sendSignal() with a signal picked for them, and the general form
// had no caller. What it accepts is the part that differs by platform.
BOOST_AUTO_TEST_CASE(test_send_signal_takes_what_the_platform_takes) {
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
#  ifdef _WIN32
        // Only the two console control events, and anything else is refused rather than
        // approximated.
        BOOST_CHECK(!p.sendSignal(SIGTERM));
        BOOST_CHECK(p.errorCode().value() != 0);
        std::ignore = p.kill();
#  else
        BOOST_CHECK(p.sendSignal(SIGKILL));
        BOOST_CHECK_EQUAL(p.errorCode().value(), 0);
#  endif
        BOOST_REQUIRE(p.wait(Timeout));
    }

    // A child that has already gone is not a failure to signal. Python answers the same way,
    // since the alternative is a race every caller would have to write around.
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK(p.kill());
        BOOST_REQUIRE(p.wait(Timeout));

#  ifdef _WIN32
        BOOST_CHECK(p.sendSignal(Popen::WS_CTRL_BREAK_EVENT));
#  else
        BOOST_CHECK(p.sendSignal(SIGTERM));
#  endif
        BOOST_CHECK_EQUAL(p.errorCode().value(), 0);
    }
}

// A signal death is reported as the negated signal number, as in Python.
BOOST_AUTO_TEST_CASE(test_signal_returncode) {
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK(p.kill());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), -SIGKILL);
    }
    {
        Popen p;
        p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK(p.terminate());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), -SIGTERM);
    }
}

// ---------------------------------------------------------------------------------------------
// What crosses into the child, and what must not
// ---------------------------------------------------------------------------------------------

// Every descriptor a run opens has to come back, or a long-lived program runs out of them.
BOOST_AUTO_TEST_CASE(test_no_fd_leak) {
    const auto &open_fd_count = []() {
#  ifdef __APPLE__
        DIR *dir = opendir("/dev/fd");
#  else
        DIR *dir = opendir("/proc/self/fd");
#  endif
        if (!dir) {
            return -1;
        }
        int count = 0;
        while (readdir(dir)) {
            count++;
        }
        closedir(dir);
        return count;
    };

    // The first run warms up whatever the library allocates once.
    for (int i = 0; i < 2; i++) {
        Popen p;
        p.args(FilterX)
            .standardInput(Popen::Pipe)
            .standardOutput(Popen::Pipe)
            .standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        std::ignore = p.communicate("xyz\n", Timeout);
    }

    int before = open_fd_count();
    BOOST_REQUIRE(before > 0);
    for (int i = 0; i < 20; i++) {
        Popen p;
        p.args(FilterX)
            .standardInput(Popen::Pipe)
            .standardOutput(Popen::Pipe)
            .standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        std::ignore = p.communicate("xyz\n", Timeout);
    }
    BOOST_CHECK_EQUAL(open_fd_count(), before);
}

// closeFds is on by default, so nothing of ours reaches the child but the standard streams.
//
// The count comes from the directory the system lists a process's own descriptors in, which is
// not the same directory everywhere. This asked /proc for it and got "No such file or directory"
// on macOS, where the count then came back as nothing and stoi answered zero, so the case passed
// there having checked nothing at all for as long as it existed.
BOOST_AUTO_TEST_CASE(test_close_fds) {
    const auto &open_in_child = [](bool closeFds) {
#  ifdef __APPLE__
        std::string script = "ls /dev/fd | wc -l";
#  else
        std::string script = "ls /proc/self/fd | wc -l";
#  endif
        Popen p;
        p.args({"/bin/sh", "-c", script}).standardOutput(Popen::Pipe).closeFds(closeFds);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        auto line = first_line(out);
        // A blank answer is the directory not being there, which would make the check below
        // pass by counting nothing.
        BOOST_REQUIRE_MESSAGE(!line.empty() && line.find_first_not_of(" \t") != std::string::npos,
                              "nothing came back from listing the child's descriptors");
        return std::stoi(line);
    };

    // 0, 1, 2 and the descriptor ls itself opened on the directory.
    BOOST_CHECK_LE(open_in_child(true), 5);

    // And the other way, so the number above is known to mean something rather than being what
    // this platform says no matter what.
    //
    // The descriptors have to be plain ones. The pipes Popen makes for itself are close on
    // exec, so they do not reach a child even with closeFds off, which is what they should do
    // and which makes them useless for measuring this.
    std::vector<int> plain;
    for (int i = 0; i < 8; i++) {
        int fds[2];
        BOOST_REQUIRE_EQUAL(pipe(fds), 0);
        plain.push_back(fds[0]);
        plain.push_back(fds[1]);
    }
    BOOST_CHECK_GT(open_in_child(false), open_in_child(true));
    for (int fd : plain) {
        close(fd);
    }
}

// preExec runs in the child, after the pipes are in place and before exec.
BOOST_AUTO_TEST_CASE(test_preexec_fn) {
    Popen p;
    p.args({"pwd"}).standardOutput(Popen::Pipe).preExec([] { std::ignore = chdir("/usr"); });
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(out), "/usr");
}

// A descriptor named in passFds survives exec. Without it, closeFds takes it away.
BOOST_AUTO_TEST_CASE(test_pass_fds) {
    // A pipe holding a known line, which the child reads by descriptor number.
    const auto &filled_pipe = [](int fds[2]) {
        BOOST_REQUIRE_EQUAL(pipe(fds), 0);
        const char *msg = "kept\n";
        std::ignore = write(fds[1], msg, std::strlen(msg));
        close(fds[1]);
    };

    {
        int fds[2];
        filled_pipe(fds);
        char script[64];
        std::snprintf(script, sizeof(script), "cat <&%d", fds[0]);

        Popen p;
        p.args({"/bin/sh", "-c", script}).passFds({fds[0]}).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        close(fds[0]);
        BOOST_CHECK_EQUAL(first_line(out), "kept");
    }

    {
        int fds[2];
        filled_pipe(fds);
        char script[64];
        std::snprintf(script, sizeof(script), "cat <&%d", fds[0]);

        Popen p;
        p.args({"/bin/sh", "-c", script}).standardOutput(Popen::Pipe).standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        close(fds[0]);
        BOOST_CHECK(out.empty());
        BOOST_CHECK(!errout.empty());
    }

    // closeFds(false) hands the child everything we have open, so the same read works.
    {
        int fds[2];
        filled_pipe(fds);
        char script[64];
        std::snprintf(script, sizeof(script), "cat <&%d", fds[0]);

        Popen p;
        p.args({"/bin/sh", "-c", script}).closeFds(false).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        close(fds[0]);
        BOOST_CHECK_EQUAL(first_line(out), "kept");
    }
}

BOOST_AUTO_TEST_CASE(test_umask) {
    Popen p;
    p.args({"/bin/sh", "-c", "umask"}).umask(0077).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(out), "0077");
}

// Both of these are visible from here, so the child does not have to report them.
BOOST_AUTO_TEST_CASE(test_session_and_process_group) {
    {
        Popen p;
        p.args({"cat"}).standardInput(Popen::Pipe).startNewSession(true);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK_EQUAL(getsid(p.pid()), p.pid());
        p.standardInput().close();
        BOOST_REQUIRE(p.wait(Timeout));
    }
    {
        Popen p;
        p.args({"cat"}).standardInput(Popen::Pipe).processGroup(0);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_CHECK_EQUAL(getpgid(p.pid()), p.pid());
        p.standardInput().close();
        BOOST_REQUIRE(p.wait(Timeout));
    }
}

#  ifdef F_GETPIPE_SZ
BOOST_AUTO_TEST_CASE(test_pipesize) {
    Popen p;
    p.args({"cat"}).standardInput(Popen::Pipe).pipeSize(1 << 17);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    // The kernel may round up, so this is a floor rather than the exact figure.
    BOOST_CHECK_GE(fcntl(fileno(p.standardInput().file()), F_GETPIPE_SZ), 1 << 17);
    p.standardInput().close();
    BOOST_REQUIRE(p.wait(Timeout));
}
#  endif

// restoreSignals puts the dispositions the parent changed back to their defaults, so a child
// does not inherit an ignored signal it never asked for.
BOOST_AUTO_TEST_CASE(test_restore_signals) {
    struct IgnoreSigpipe {
        IgnoreSigpipe() : prev(signal(SIGPIPE, SIG_IGN)) {
        }
        ~IgnoreSigpipe() {
            signal(SIGPIPE, prev);
        }
        void (*prev)(int);
    } ignore;

    const char *script = "kill -Pipe $$; echo survived";

    {
        Popen p;
        p.args({"/bin/sh", "-c", script}).restoreSignals(true).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK(out.empty());
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), -SIGPIPE);
    }

    {
        Popen p;
        p.args({"/bin/sh", "-c", script}).restoreSignals(false).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), "survived");
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }
}

// What communicate() does about SIGPIPE, watched from outside.
//
// It blocks the signal for the thread that writes rather than ignoring it for the process, so
// nothing here should ever see the disposition change. It used to, and two communicates running
// at once then raced over putting it back: the first to leave took the protection away from the
// second, and the process was left ignoring SIGPIPE for good.
BOOST_AUTO_TEST_CASE(test_communicate_leaves_the_signal_disposition_alone) {
    const auto &disposition = [] {
        struct sigaction current{};
        BOOST_REQUIRE_EQUAL(sigaction(SIGPIPE, nullptr, &current), 0);
        return current.sa_handler;
    };

    // Whatever this process had, which is what has to come back afterwards.
    auto before = disposition();

    Popen p;
    // Enough output that the loop is running for long enough to be caught at it.
    p.args(child_args({"fill", "8000000", "out"})).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    std::atomic<bool> running{true};
    std::atomic<int> changed{0};
    std::atomic<int> samples{0};
    std::thread watcher([&] {
        while (running.load()) {
            struct sigaction current{};
            if (sigaction(SIGPIPE, nullptr, &current) == 0) {
                samples++;
                if (current.sa_handler != before) {
                    changed++;
                }
            }
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
    });

    auto [out, errout] = p.communicate({}, Timeout);
    running = false;
    watcher.join();

    BOOST_CHECK_EQUAL(out.size(), 8000000u);
    BOOST_REQUIRE_GT(samples.load(), 0);
    BOOST_CHECK_MESSAGE(changed.load() == 0, "the disposition changed under " +
                                                 std::to_string(samples.load()) +
                                                 " samples of a communicate that read 8 MB");
    BOOST_CHECK(disposition() == before);
}

// A name that no passwd entry matches fails before anything is forked.
BOOST_AUTO_TEST_CASE(test_unknown_user_name) {
    Popen p;
    p.args(shell_args(ExitZero)).user("no_such_user_9f3a");
    BOOST_CHECK(!p.start());
    BOOST_CHECK(!p.errorMessage().empty());
    BOOST_CHECK_EQUAL(p.pid(), -1);
}

// Changing credentials needs privilege, so which half of this runs depends on who we are. Under
// a normal user the point is that the failure is orderly: start() says no, and the child that
// got as far as fork is reaped rather than left behind.
BOOST_AUTO_TEST_CASE(test_user_and_groups) {
    const bool privileged = geteuid() == 0;

    const auto &check = [&](Popen &p, const char *expected) {
        bool started = p.start();
        BOOST_REQUIRE_EQUAL(started, privileged);
        if (!started) {
            BOOST_CHECK(!p.errorMessage().empty());

            // A start that failed reports no process, since there is none to report.
            BOOST_CHECK_EQUAL(p.pid(), -1);
            BOOST_CHECK(!p.returnCode());

            // And the child that got as far as fork was reaped on the way out, so this process
            // has nothing left to collect.
            int status = 0;
            errno = 0;
            BOOST_CHECK_EQUAL(waitpid(-1, &status, WNOHANG), -1);
            BOOST_CHECK_EQUAL(errno, ECHILD);
            return;
        }
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(first_line(out), expected);
    };

    {
        Popen p;
        p.args({"id", "-u"}).user(65534).standardOutput(Popen::Pipe);
        check(p, "65534");
    }
    {
        Popen p;
        p.args({"id", "-un"}).user("nobody").standardOutput(Popen::Pipe);
        check(p, "nobody");
    }
    {
        Popen p;
        p.args({"id", "-g"}).group(65534).standardOutput(Popen::Pipe);
        check(p, "65534");
    }
    {
        // setgroups replaces the supplementary list, leaving the primary group beside it.
        Popen p;
        p.args({"id", "-G"}).extraGroups({65534}).standardOutput(Popen::Pipe);
        check(p, "0 65534");
    }
}

#endif // !_WIN32

#ifdef _WIN32
// The Windows counterpart of what the section above asks on POSIX. startupInfo is handed to
// CreateProcess, and two parts of it decide what the child starts with: the standard handles it
// names, and the handle_list that says which of ours it may inherit.
//
// The streams are left alone on purpose. Setting all three sends the pipe ends through
// STARTF_USESTDHANDLES instead, which overwrites what is given here, so this is the arrangement
// in which what startupInfo says is what the child gets.
BOOST_AUTO_TEST_CASE(test_startupinfo_names_the_handles_the_child_starts_with) {
    TempFile out_file("startupInfo");

    SECURITY_ATTRIBUTES inheritable{};
    inheritable.nLength = sizeof(inheritable);
    inheritable.bInheritHandle = TRUE;

    HANDLE out = ::CreateFileW(out_file.path().wstring().c_str(), GENERIC_WRITE,
                               FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable, CREATE_ALWAYS,
                               FILE_ATTRIBUTE_NORMAL, nullptr);
    BOOST_REQUIRE(out != INVALID_HANDLE_VALUE);
    bool out_open = true;
    auto close_out = stdc::make_scope_guard([&] {
        if (out_open) {
            ::CloseHandle(out);
        }
    });

    // A child given STARTF_USESTDHANDLES gets all three, so stdin needs one it can hold.
    HANDLE in = ::CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ, &inheritable, OPEN_EXISTING,
                              FILE_ATTRIBUTE_NORMAL, nullptr);
    BOOST_REQUIRE(in != INVALID_HANDLE_VALUE);
    auto close_in = stdc::make_scope_guard([&] { ::CloseHandle(in); });

    // Terminated by INVALID_HANDLE_VALUE, which is what the header says the key holds.
    HANDLE handles[] = {in, out, INVALID_HANDLE_VALUE};

    Popen::StartupInfo info{};
    info.dwFlags = STARTF_USESTDHANDLES;
    info.hStdInput = in;
    info.hStdOutput = out;
    info.hStdError = out;
    info.lpAttributeList["handle_list"] = handles;

    Popen p;
    p.args(child_args({"argv", "through-startupInfo"})).startupInfo(info);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);

    // Closed before reading, since the child's copy was never the only one open.
    ::CloseHandle(out);
    out_open = false;
    BOOST_CHECK_EQUAL(first_line(out_file.read()), "through-startupInfo");
}
#endif

// ---------------------------------------------------------------------------------------------
// The command line, and what the platform makes of it
// ---------------------------------------------------------------------------------------------

// Each argument has to arrive at the program as the one string it was given as.
//
// This matters on Windows, where there is no argument vector to hand over: the arguments are
// joined into one command line and taken apart again by the child's runtime, so the quoting in
// between is ours to get right. An argument starting with a quote used to walk a size_t counter
// past zero and throw std::out_of_range out of start().
//
// A start that succeeds proves nothing here, which is what the first version of this test
// checked. The child has to say what it received.
// The limit checks themselves belong to system.h and are covered by test_system. Their strongest
// claim still needs a child: the longest accepted line really starts and arrives whole.
BOOST_AUTO_TEST_CASE(test_the_longest_accepted_command_line_really_starts) {
    std::vector<std::string> args = child_args({"argv"});
    while (system::command_line_fits(args)) {
        args.push_back(std::string(200, 'x'));
    }
    args.pop_back();
    BOOST_REQUIRE_GT(args.size(), 3u);
    args.back() = std::string(199, 'x') + "z";

    Popen p;
    p.args(args).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(),
                          "the longest accepted line did not start: " + p.errorMessage());
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(p.returnCode().value_or(-1), 0);
    BOOST_CHECK_MESSAGE(out.find(std::string(199, 'x') + "z\n") != std::string::npos,
                        "the last argument of the longest accepted line did not arrive");
}

// Asking whether a child has exited must not disturb it, and asking often must not miss the
// moment it does. llvm has this one because a wait with a timeout used to kill what it was
// waiting for. \sa llvm's TestExecuteNoWaitTimeoutPolling
BOOST_AUTO_TEST_CASE(test_polling_neither_kills_the_child_nor_misses_its_exit) {
    Popen p;
    p.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    // It is reading its input and has been given none, so it is still there however often it
    // is asked, and asking is what could have killed it.
    for (int i = 0; i < 100; ++i) {
        BOOST_CHECK(!p.poll());
        BOOST_CHECK(!p.returnCode().has_value());
        BOOST_CHECK(!p.errorCode());
    }

    p.standardInput() << "still here\n";
    p.standardInput().flush();
    p.standardInput().close();

    // The same asking sees it go, rather than the exit being lost to whoever asked before it.
    auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(Timeout);
    int rounds = 0;
    while (!p.poll() && std::chrono::steady_clock::now() < deadline) {
        rounds++;
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    BOOST_REQUIRE_MESSAGE(p.returnCode().has_value(),
                          "it never exited, after " + std::to_string(rounds) + " rounds");
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    BOOST_CHECK(!p.errorCode());

    // And keeps saying so, rather than the status being readable once.
    BOOST_CHECK(p.poll());
    BOOST_CHECK_EQUAL(p.returnCode().value_or(-1), 0);
}

BOOST_AUTO_TEST_CASE(test_argument_quoting) {
    const std::vector<std::string> tricky = {
        "plain",
        "a b",
        "  ",
        "a\"b",
        "\"lead",
        "trail\"",
        "back\\sla",
        "end\\",
        "end\\\\",
        "a\\\"b",
        "\\\"quo\"",
        "tab\there",
        "semi;colon",
        "amp&and",
        "pipe|bar",
        "caret^up",
        "per%cent",
        "dollar$sign",

        // A space and a trailing backslash in the same argument, which the two above have one
        // each of and neither together. Quoting puts the argument in quotes because of the
        // space, and then the backslash before the closing quote is the one that escapes it.
        // This is llvm's CreateProcessTrailingSlash, and it is the case the quoting is written
        // for. \sa llvm/unittests/Support/ProgramTest.cpp
        "has\\\\ trailing\\",
        "a b\\",
        "a b\\\\",
        "a b\\\\\\",
        "\\\\ leading",
        "quote\" and space",
        "a b\"c\\",
    };

    for (const auto &arg : tricky) {
        Popen p;
        p.args(child_args({"argv", arg, "after"})).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), "start failed for [" + arg + "]: " + p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_REQUIRE(p.returnCode());

        // The helper writes one line per argument, so the round trip is the first line back.
        auto end = out.find('\n');
        std::string got = end == std::string::npos ? out : out.substr(0, end);
        BOOST_CHECK_MESSAGE(got == arg, "argument [" + arg + "] arrived as [" + got + "]");

        // And the one after it, so an argument that swallowed its successor is caught too.
        std::string rest = end == std::string::npos ? std::string() : out.substr(end + 1);
        auto end2 = rest.find('\n');
        BOOST_CHECK_EQUAL(end2 == std::string::npos ? rest : rest.substr(0, end2), "after");
    }

    // An empty argument still occupies a place in the vector.
    {
        Popen p;
        p.args(child_args({"argv", "", "after"})).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out, "\nafter\n");
    }
}

BOOST_AUTO_TEST_CASE(test_devnull_and_inherit) {
    // DeviceNull swallows the output
    {
        Popen p;
        p.args(shell_args(EchoHello)).standardOutput(Popen::DeviceNull);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK(!p.standardOutput().isOpen());
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // no redirection at all: the child inherits ours
    {
        Popen p;
        p.args(shell_args(ExitZero));
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }
}

// ---------------------------------------------------------------------------------------------
// The pipes as iostreams
// ---------------------------------------------------------------------------------------------

// The pipes are C++ streams, so the usual stream vocabulary works on them directly and nobody
// has to reach for a platform-specific adapter to get there.
BOOST_AUTO_TEST_CASE(test_stream_interface) {
    // reading with getline
    {
        Popen p;
        p.args(shell_args(EchoThree)).standardOutput(Popen::Pipe).text(true);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

        std::vector<std::string> lines;
        std::string line;
        while (std::getline(p.standardOutput(), line)) {
            lines.push_back(first_line(line));
        }
        BOOST_REQUIRE_EQUAL(lines.size(), 3u);
        BOOST_CHECK_EQUAL(lines[0], "one");
        BOOST_CHECK_EQUAL(lines[2], "three");
        BOOST_REQUIRE(p.wait(Timeout));
    }

    // writing with operator<<, then closing to release the child
    {
        Popen p;
        p.args({"sort"}).standardInput(Popen::Pipe).standardOutput(Popen::Pipe).text(true);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

        p.standardInput() << "banana\ncherry\napple\n" << std::flush;
        p.standardInput().close();

        std::vector<std::string> lines;
        std::string line;
        while (std::getline(p.standardOutput(), line)) {
            auto trimmed = first_line(line);
            if (!trimmed.empty()) {
                lines.push_back(trimmed);
            }
        }
        BOOST_REQUIRE_EQUAL(lines.size(), 3u);
        BOOST_CHECK_EQUAL(lines[0], "apple");
        BOOST_CHECK_EQUAL(lines[1], "banana");
        BOOST_CHECK_EQUAL(lines[2], "cherry");
        BOOST_REQUIRE(p.wait(Timeout));
    }

    // close() is idempotent, and a stream that was never opened is simply not open
    {
        Popen p;
        p.args(shell_args(ExitZero)).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

        BOOST_CHECK(p.standardOutput().isOpen());
        BOOST_CHECK(!p.standardInput().isOpen());
        BOOST_CHECK(p.standardInput().file() == nullptr);

        p.standardOutput().close();
        BOOST_CHECK(!p.standardOutput().isOpen());
        p.standardOutput().close();
        p.standardOutput().close();
        BOOST_CHECK(p.standardOutput().file() == nullptr);

        BOOST_REQUIRE(p.wait(Timeout));
    }

    // file() hands the same pipe to the C interfaces that only take a FILE *
    {
        Popen p;
        p.args(shell_args(EchoHello)).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

        FILE *raw = p.standardOutput().file();
        BOOST_REQUIRE(raw != nullptr);
        char buf[128] = {};
        size_t n = std::fread(buf, 1, sizeof(buf) - 1, raw);
        BOOST_CHECK_GT(n, 0u);
        BOOST_CHECK_EQUAL(first_line(buf), "hello");
        BOOST_REQUIRE(p.wait(Timeout));
    }
}

// The error stream is read the same way as the output one, and had only ever been reached
// through communicate(), which asks the implementation for it rather than the caller.
//
// The child writes to both, and the counts are small enough to sit in the pipe buffers, which is
// what makes reading one after the other safe here. A larger one is what communicate() is for.
BOOST_AUTO_TEST_CASE(test_the_error_stream_is_read_like_any_other) {
    Popen p;
    p.args(child_args({"fill", "128", "both"}))
        .standardOutput(Popen::Pipe)
        .standardError(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    BOOST_CHECK(p.standardError().isOpen());
    BOOST_CHECK(p.standardError().file() != nullptr);
    BOOST_REQUIRE(p.wait(Timeout));

    const auto &drain = [](Popen::Stream &stream) {
        return std::string(std::istreambuf_iterator<char>(stream),
                           std::istreambuf_iterator<char>());
    };
    BOOST_CHECK_EQUAL(drain(p.standardOutput()).size(), 128u);
    BOOST_CHECK_EQUAL(drain(p.standardError()).size(), 128u);

    p.standardError().close();
    BOOST_CHECK(!p.standardError().isOpen());
}

// A character at a time, which is a different path through the buffer from a whole string: the
// stream has no put area, so sputc() goes to overflow() where sputn() goes to xsputn().
BOOST_AUTO_TEST_CASE(test_writing_one_character_at_a_time) {
    Popen p;
    p.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    for (char c : std::string("one\n")) {
        p.standardInput().put(c);
    }
    p.standardInput() << std::flush;
    p.standardInput().close();

    std::string out(std::istreambuf_iterator<char>(p.standardOutput()),
                    std::istreambuf_iterator<char>());
    BOOST_CHECK_EQUAL(first_line(out), "one");
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_REQUIRE(p.returnCode());
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

// Closing delivers what was written, with nobody asking for it. Both cases above flush first,
// so what close() does on its own was never pinned, and it used to flush by hand before
// closing: pointless for a stream that was written, since fclose flushes, and not defined for
// one that was read, since fflush is for output and for input only where the stream can seek.
BOOST_AUTO_TEST_CASE(test_closing_delivers_what_was_written_without_a_flush) {
    Popen p;
    p.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    p.standardInput() << "no flush here\n";
    p.standardInput().close();

    // Read with a timeout rather than to the end of the stream. A close that fails to deliver
    // leaves the child waiting for input that never comes, and reading to EOF would then hang
    // the whole run instead of failing this case.
    auto [out, errout] = p.communicate({}, Timeout);
    BOOST_CHECK_EQUAL(first_line(out), "no flush here");
    BOOST_REQUIRE(p.returnCode().has_value());
    BOOST_CHECK_EQUAL(*p.returnCode(), 0);
}

// And closing one that was only read is closing, not flushing.
BOOST_AUTO_TEST_CASE(test_closing_a_stream_that_was_read_takes_nothing_with_it) {
    Popen p;
    p.args(shell_args(EchoThree)).standardOutput(Popen::Pipe).text(true);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());

    std::string line;
    BOOST_REQUIRE(std::getline(p.standardOutput(), line));
    BOOST_CHECK_EQUAL(first_line(line), "one");

    // Closed with the child still writing and the rest of its output unread.
    p.standardOutput().close();
    BOOST_CHECK(!p.standardOutput().isOpen());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_CHECK(p.returnCode().has_value());
}

// ---------------------------------------------------------------------------------------------
// The lifetime of the Popen itself
// ---------------------------------------------------------------------------------------------

BOOST_AUTO_TEST_CASE(test_kill) {
    Popen p;
    p.args(FilterX).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
    BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
    BOOST_CHECK(!p.poll());

    BOOST_CHECK(p.kill());
    BOOST_REQUIRE(p.wait(Timeout));
    BOOST_REQUIRE(p.returnCode());
    BOOST_CHECK(*p.returnCode() != 0);

    // killing an already-dead process is a no-op, not a failure
    BOOST_CHECK(p.kill());
}

// A Popen owns its child by default and takes it down on the way out. A process configured as
// detached before start is independent and cannot be waited or controlled through this object.
BOOST_AUTO_TEST_CASE(test_detached) {
    // the default: destroying the object ends the child
    {
        int pid = -1;
        {
            Popen p;
            p.args(shell_args(SleepLong));
            BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
            pid = p.pid();
            BOOST_REQUIRE(pid > 0);
            BOOST_CHECK(process_alive(pid));
            BOOST_CHECK(!p.detached());
        }
        BOOST_CHECK(!process_alive(pid));
    }

    // detached: it outlives us
    {
        int pid = -1;
        {
            Popen p;
            p.args(shell_args(SleepLong)).detached(true);
            BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
            BOOST_CHECK(p.detached());
            pid = p.pid();
            BOOST_REQUIRE(pid > 0);
        }
        BOOST_CHECK(process_alive(pid));
        hard_kill(pid);
    }

    // Detachment changes how the process is created, so it cannot be enabled after start().
    {
        int pid = -1;
        {
            Popen p;
            p.args(shell_args(SleepLong));
            BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
            pid = p.pid();
            p.detached(true);
            BOOST_CHECK(!p.detached());
        }
        BOOST_CHECK(!process_alive(pid));
    }

    // The final detached process is deliberately no longer controllable by Popen.
    {
        Popen p;
        p.args(shell_args(SleepLong)).detached(true);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        int pid = p.pid();
        BOOST_REQUIRE(pid > 0);
        BOOST_CHECK(!p.wait(0));
        BOOST_CHECK(p.errorCode() == std::make_error_code(std::errc::operation_not_supported));
        BOOST_CHECK(!p.kill());
        BOOST_CHECK(p.errorCode() == std::make_error_code(std::errc::operation_not_supported));

#ifndef _WIN32
        // The double-forked process belongs to init (or a configured child subreaper), not us.
        int status = 0;
        errno = 0;
        BOOST_CHECK_EQUAL(waitpid(pid, &status, WNOHANG), -1);
        BOOST_CHECK_EQUAL(errno, ECHILD);
#endif
        hard_kill(pid);
    }

    // Pipes need an owner to drain/close them, so detached mode rejects them.
    {
        Popen p;
        p.args(shell_args(ExitZero)).standardOutput(Popen::Pipe).detached(true);
        BOOST_CHECK(!p.start());
        BOOST_CHECK(p.errorCode() == std::make_error_code(std::errc::invalid_argument));
    }
}

// Starting and driving children from worker threads.
//
// This is where the defect that killed five macOS CI jobs lived. Writing to a child that had
// already exited raised SIGPIPE on the writing thread, and the guard around that write blocked
// the signal instead of ignoring it, which macOS does not treat the same way. Every case above
// runs on the main thread and every one of them passed while it was in.
BOOST_AUTO_TEST_CASE(test_threads) {
    // One child per thread, more threads than the machine has cores, each with its own data to
    // send and its own answer to check.
    {
        unsigned count = std::thread::hardware_concurrency();
        count = (count < 2 ? 2u : count) + 2;

        std::vector<std::thread> threads;
        std::atomic<int> succeeded{0};
        std::atomic<int> started{0};
        for (unsigned i = 0; i < count; i++) {
            threads.emplace_back([&succeeded, &started, i] {
                Popen p;
                p.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
                if (!p.start()) {
                    return;
                }
                started++;
                std::string mine = "thread " + std::to_string(i) + "\n";
                auto [out, errout] = p.communicate(mine, Timeout);
                if (out == mine && p.returnCode() && *p.returnCode() == 0) {
                    succeeded++;
                }
            });
        }
        for (auto &t : threads) {
            t.join();
        }
        BOOST_CHECK_EQUAL(started.load(), int(count));
        BOOST_CHECK_EQUAL(succeeded.load(), int(count));
    }

    // Writing to a child that has already gone, on a thread that is not the main one. Repeated,
    // since the signal has to be raised while the disposition is wrong to be noticed at all.
    {
        std::atomic<int> completed{0};
        std::thread t([&completed] {
            for (int i = 0; i < 10; i++) {
                Popen p;
                p.args(child_args({"exit", "0"}))
                    .standardInput(Popen::Pipe)
                    .standardOutput(Popen::Pipe);
                if (!p.start() || !p.wait(Timeout)) {
                    return;
                }
                std::ignore = p.communicate(std::string(1 << 20, 'x'), Timeout);
                completed++;
            }
        });
        t.join();
        BOOST_CHECK_EQUAL(completed.load(), 10);
    }

    // Two threads waiting on children of their own at the same time. On POSIX a wait reaps by
    // pid, so one thread must not collect the other's child and leave it waiting forever.
    {
        std::atomic<int> done{0};
        const auto &run = [&done](int code) {
            Popen p;
            p.args(child_args({"exit", std::to_string(code)}));
            if (!p.start() || !p.wait(Timeout)) {
                return;
            }
            if (p.returnCode() && *p.returnCode() == code) {
                done++;
            }
        };
        std::thread a([&run] { run(3); });
        std::thread b([&run] { run(7); });
        a.join();
        b.join();
        BOOST_CHECK_EQUAL(done.load(), 2);
    }
}

// Both pipes filled past what they hold, at the same time.
//
// This is the case the class documents communicate() as existing for: a child writing to stderr
// while the parent is still draining stdout blocks as soon as the stderr pipe is full, and a
// reader taking one stream at a time never gets to the one that is blocking. The big-output case
// above only fills stdout, so it does not reach this.
BOOST_AUTO_TEST_CASE(test_both_pipes_fill) {
    const long bytes = 512 * 1024;

    {
        Popen p;
        p.args(child_args({"fill", std::to_string(bytes), "both"}))
            .standardOutput(Popen::Pipe)
            .standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out.size(), size_t(bytes));
        BOOST_CHECK_EQUAL(errout.size(), size_t(bytes));
        BOOST_REQUIRE(p.returnCode());
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }

    // The same, with input to write as well, so all three directions are moving at once.
    {
        Popen p;
        p.args(child_args({"fill", std::to_string(bytes), "both"}))
            .standardInput(Popen::Pipe)
            .standardOutput(Popen::Pipe)
            .standardError(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate(std::string(256 * 1024, 'i'), Timeout);
        BOOST_CHECK_EQUAL(out.size(), size_t(bytes));
        BOOST_CHECK_EQUAL(errout.size(), size_t(bytes));
        BOOST_REQUIRE(p.returnCode());
    }

    // Folded together, the two counts land in one stream.
    {
        Popen p;
        p.args(child_args({"fill", std::to_string(bytes), "both"}))
            .standardOutput(Popen::Pipe)
            .standardError(Popen::StandardOutput);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out.size(), size_t(bytes) * 2);
        BOOST_CHECK(errout.empty());
    }
}

// A Popen can be moved, which is what lets a function build one and hand it back.
BOOST_AUTO_TEST_CASE(test_move) {
    // Move construction takes the running child, its pipes and its pid across.
    {
        Popen a;
        a.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(a.start(), a.errorMessage());
        int pid = a.pid();
        BOOST_REQUIRE(pid > 0);
        auto *stream_before = &a.standardOutput();

        Popen b(std::move(a));
        BOOST_CHECK_EQUAL(b.pid(), pid);

        // The streams live behind the pointer that moved, so a reference taken before the move
        // still names the same pipe afterwards.
        BOOST_CHECK_EQUAL(&b.standardOutput(), stream_before);

        auto [out, errout] = b.communicate("moved\n", Timeout);
        BOOST_CHECK_EQUAL(out, "moved\n");
        BOOST_REQUIRE(b.returnCode());
        BOOST_CHECK_EQUAL(*b.returnCode(), 0);
    }

    // Assigning over a Popen whose child is still running ends that child there and then. A
    // swap would have handed it to the right hand side instead, leaving it alive for as long as
    // that object lasts and giving the caller no way to say when it died.
    {
        Popen victim;
        victim.args(shell_args(SleepLong));
        BOOST_REQUIRE_MESSAGE(victim.start(), victim.errorMessage());
        int victim_pid = victim.pid();
        BOOST_REQUIRE(process_alive(victim_pid));

        Popen fresh;
        fresh.args(child_args({"exit", "5"}));
        BOOST_REQUIRE_MESSAGE(fresh.start(), fresh.errorMessage());
        int fresh_pid = fresh.pid();

        victim = std::move(fresh);
        BOOST_CHECK(!process_alive(victim_pid));

        BOOST_CHECK_EQUAL(victim.pid(), fresh_pid);
        BOOST_REQUIRE(victim.wait(Timeout));
        BOOST_CHECK_EQUAL(*victim.returnCode(), 5);
    }

    // Built by a function and returned, which a deleted copy would have prevented on its own.
    {
        const auto &make = [] {
            Popen p;
            p.args(child_args({"cat"})).standardInput(Popen::Pipe).standardOutput(Popen::Pipe);
            return p;
        };
        Popen p = make();
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate("returned\n", Timeout);
        BOOST_CHECK_EQUAL(out, "returned\n");
    }

    // A vector of them, which is a move on every reallocation.
    {
        std::vector<Popen> procs;
        for (int i = 0; i < 4; i++) {
            Popen p;
            p.args(child_args({"exit", std::to_string(i)}));
            BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
            procs.push_back(std::move(p));
        }
        for (int i = 0; i < 4; i++) {
            BOOST_REQUIRE(procs[size_t(i)].wait(Timeout));
            BOOST_CHECK_EQUAL(*procs[size_t(i)].returnCode(), i);
        }
    }
}

// The ways a start can fail before there is any child to speak of. Each has to come back as a
// failure with something readable in it, rather than as a crash or as a success with no process.
BOOST_AUTO_TEST_CASE(test_start_failures) {
    // nothing to run
    {
        Popen p;
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // an empty argument vector, which is not the same as never having set one
    {
        Popen p;
        p.args({});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // an empty program name
    {
        Popen p;
        p.args({"", "arg"});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // a name that is nothing but blanks
    {
        Popen p;
        p.args({"   "});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // a directory, which exists and is not a program
    {
        Popen p;
        p.args({std::filesystem::temp_directory_path().string()});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // executable() naming something that is not there, whatever args[0] says
    {
        Popen p;
        p.executable("no_such_executable_4b71").args({"cat"});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.errorMessage().empty());
    }

    // A failure leaves nothing behind: no exit status, and the next start still works.
    {
        Popen p;
        p.args({"no_such_program_4b71"});
        BOOST_CHECK(!p.start());
        BOOST_CHECK(!p.returnCode());

        p.args(child_args({"exit", "0"}));
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);
    }
}

// ---------------------------------------------------------------------------------------------
// Redirection, and text mode
// ---------------------------------------------------------------------------------------------

// A standard stream can be handed a FILE * or a descriptor of the caller's, which is how output
// goes straight to a file without passing through this process at all.
BOOST_AUTO_TEST_CASE(test_redirect_to_file_and_fd) {
    // a FILE * of ours
    {
        TempFile file("cfile");
        FILE *f = std::fopen(file.path().string().c_str(), "wb");
        BOOST_REQUIRE(f != nullptr);

        Popen p;
        p.args(child_args({"argv", "written", "twice"})).standardOutput(f);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        BOOST_CHECK_EQUAL(*p.returnCode(), 0);

        // Ours to close, since we opened it. The child had a copy of its own.
        std::fclose(f);
        BOOST_CHECK_EQUAL(file.read(), "written\ntwice\n");

        // Nothing came back through this process, so there is no pipe to read.
        BOOST_CHECK(!p.standardOutput().isOpen());
    }

    // a descriptor of ours
    {
        TempFile file("fd");
        FILE *f = std::fopen(file.path().string().c_str(), "wb");
        BOOST_REQUIRE(f != nullptr);
#ifdef _WIN32
        int fd = _fileno(f);
#else
        int fd = fileno(f);
#endif
        BOOST_REQUIRE(fd >= 0);

        Popen p;
        p.args(child_args({"argv", "by-descriptor"})).standardOutput(fd);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        std::fclose(f);
        BOOST_CHECK_EQUAL(file.read(), "by-descriptor\n");
    }

    // stderr to one file and stdout to another, kept apart
    {
        TempFile out_file("out");
        TempFile err_file("err");
        FILE *fout = std::fopen(out_file.path().string().c_str(), "wb");
        FILE *ferr = std::fopen(err_file.path().string().c_str(), "wb");
        BOOST_REQUIRE(fout != nullptr);
        BOOST_REQUIRE(ferr != nullptr);

        Popen p;
        p.args(child_args({"fill", "1024", "both"})).standardOutput(fout).standardError(ferr);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        BOOST_REQUIRE(p.wait(Timeout));
        std::fclose(fout);
        std::fclose(ferr);
        BOOST_CHECK_EQUAL(out_file.read().size(), 1024u);
        BOOST_CHECK_EQUAL(err_file.read().size(), 1024u);
    }

    // A file as the child's input, read to the end.
    {
        TempFile file("input");
        {
            std::ofstream out(file.path(), std::ios::binary);
            out << "from a file\n";
        }
        FILE *f = std::fopen(file.path().string().c_str(), "rb");
        BOOST_REQUIRE(f != nullptr);

        Popen p;
        p.args(child_args({"cat"})).standardInput(f).standardOutput(Popen::Pipe);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        std::fclose(f);
        BOOST_CHECK_EQUAL(out, "from a file\n");
    }

#ifndef _WIN32
    // One child's output as another's input, the two joined by a pipe neither of them made.
    // POSIX only, since this hands raw descriptors to both children.
    {
        int fds[2];
        BOOST_REQUIRE_EQUAL(pipe(fds), 0);

        Popen writer;
        Popen reader;
        writer.args(child_args({"argv", "through", "a", "pipe"}))
            .standardOutput(fds[1])
            .passFds({fds[1]});
        reader.args(child_args({"cat"}))
            .standardInput(fds[0])
            .standardOutput(Popen::Pipe)
            .passFds({fds[0]});

        BOOST_REQUIRE_MESSAGE(writer.start(), writer.errorMessage());
        BOOST_REQUIRE_MESSAGE(reader.start(), reader.errorMessage());

        // Both ends belong to the children now. Holding either one open here would keep the
        // reader waiting for input that is never coming.
        close(fds[0]);
        close(fds[1]);

        BOOST_REQUIRE(writer.wait(Timeout));
        auto [out, errout] = reader.communicate({}, Timeout);
        BOOST_CHECK_EQUAL(out, "through\na\npipe\n");
    }
#endif
}

// text() asks for the pipes to be opened in text mode, which on Windows turns the CRLF a program
// writes into the LF a reader expects. Nothing changes elsewhere.
BOOST_AUTO_TEST_CASE(test_text_mode) {
    const auto &collect = [](bool text) {
        Popen p;
        p.args(shell_args(EchoThree)).standardOutput(Popen::Pipe).text(text);
        BOOST_REQUIRE_MESSAGE(p.start(), p.errorMessage());
        auto [out, errout] = p.communicate({}, Timeout);
        return out;
    };

    std::string raw = collect(false);
    std::string translated = collect(true);
    BOOST_REQUIRE(!raw.empty());
    BOOST_REQUIRE(!translated.empty());

#ifdef _WIN32
    BOOST_CHECK(raw.find('\r') != std::string::npos);
    BOOST_CHECK(translated.find('\r') == std::string::npos);
    BOOST_CHECK_EQUAL(translated.size() + std::count(raw.begin(), raw.end(), '\r'), raw.size());
#else
    // Nothing to translate, so the two are the same bytes.
    BOOST_CHECK_EQUAL(raw, translated);
    BOOST_CHECK(raw.find('\r') == std::string::npos);
#endif
}

BOOST_AUTO_TEST_SUITE_END()

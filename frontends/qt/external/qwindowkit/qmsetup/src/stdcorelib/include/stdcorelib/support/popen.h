// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_POPEN_H
#define STDCORELIB_POPEN_H

#include <filesystem>
#include <vector>
#include <istream>
#include <map>
#include <memory>
#include <optional>
#include <system_error>
#include <functional>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/adt/array_view.h>

/// \defgroup process Processes and libraries
///
/// Starting a child process and loading a shared object, on both Windows and POSIX.
///
/// stdc::Popen is a port of Python's \c subprocess.Popen. The pipes are \c std::iostream, so the
/// usual vocabulary works on them, and stdc::Popen::communicate() is the one to reach for when more
/// than one is open: draining them by hand, one at a time, deadlocks as soon as the other fills.
///
/// \code
///     using namespace stdc;
///
///     Popen proc;
///     proc.args({"git", "describe", "--tags"})
///         .standardInput(Popen::DeviceNull)
///         .standardOutput(Popen::Pipe)
///         .standardError(Popen::StandardOutput);
///
///     if (!proc.start()) {
///         return proc.errorMessage();
///     }
///     auto [out, _] = proc.communicate({}, 5000);
///     int code = proc.returnCode().value_or(-1);
/// \endcode
///
/// A Popen owns its child and kills it on the way out. \c detached(true) gives that up: the
/// child is launched independently and this process keeps nothing but its pid.
///
/// stdc::SharedLibrary loads one at run time and resolves symbols from it.
///
/// \code
///     SharedLibrary lib;
///     if (!lib.open(plugin_path)) {
///         return lib.errorMessage();
///     }
///     auto entry = reinterpret_cast<int (*)()>(lib.resolve("plugin_init"));
/// \endcode

namespace stdc {

    /// \addtogroup process
    /// @{

    /// Creates and controls a child process, after Python's \c subprocess.Popen.
    ///
    /// The setters build the process up and return \c *this, so they chain. Nothing happens
    /// until start(). After that the child is running and the streams that were set to \c Pipe
    /// are open.
    ///
    /// \code
    ///   Popen proc;
    ///   proc.args({"git", "--version"})
    ///       .standardInput(Popen::DeviceNull)
    ///       .standardOutput(Popen::Pipe)
    ///       .standardError(Popen::StandardOutput); // fold stderr into the stdout pipe
    ///
    ///   if (!proc.start()) {
    ///       return proc.errorMessage();
    ///   }
    ///   auto [out, _] = proc.communicate();
    ///   int code = proc.returnCode().value_or(-1);
    /// \endcode
    ///
    /// Every \c std::string here is UTF-8, as everywhere else in this library: args(), env(),
    /// what communicate() is given and what it hands back. On Windows they are converted to
    /// UTF-16 on the way to \c CreateProcess, so an argument written in any script arrives as it
    /// was meant rather than in the system code page. What executable() and cwd() take is a
    /// \c std::filesystem::path, which carries its own encoding and is passed on as it is.
    ///
    /// \note The shape of this class is Python's, the spelling is this library's. What
    ///       \c subprocess writes \c preexec_fn is preExec(), \c returncode is returnCode(),
    ///       \c stdin is standardInput(), \c DEVNULL is \c DeviceNull, and so on down the list.
    ///       Reach for the Python documentation to learn what a setting does. Write it in
    ///       camel case.
    ///
    /// \warning Reading a pipe by hand rather than through communicate() works for one pipe,
    ///          not for two. A pipe blocks its writer once full, so a child filling stderr while
    ///          the parent is still draining stdout waits forever. communicate() exists to get
    ///          this right.
    ///
    /// \sa https://docs.python.org/3/library/subprocess.html
    class STDC_EXPORT Popen {
    public:
        /// What to connect a standard stream to, beyond a descriptor or a \c FILE * of your own.
        enum IOType {
            Pipe = 1,       ///< a new pipe, readable or writable from this side afterwards
            DeviceNull,     ///< the null device
            StandardOutput, ///< standardError() only: send it wherever stdout goes
        };

        struct IODev {
            enum Kind {
                None,
                Builtin,
                FileDescriptor,
                CFile,
            };
            IODev() : kind(None) {
            }
            IODev(IOType builtin) : kind(Builtin) {
                data.builtin = builtin;
            }
            IODev(int fd) : kind(FileDescriptor) {
                data.fd = fd;
            }
            IODev(FILE *file) : kind(CFile) {
                data.file = file;
            }
            int kind;
            union {
                IOType builtin;
                int fd;
                FILE *file;
            } data;
        };

#ifdef _WIN32
        struct StartupInfo {
            // winapi members
            uint32_t dwFlags;
            void *hStdInput;
            void *hStdOutput;
            void *hStdError;
            uint16_t wShowWindow;

            // supported keys:
            //     handle_list: INVALID_HANDLE_VALUE terminated list of HANDLE to be inherited
            std::map<std::string, void *> lpAttributeList;
        };

        enum WindowsSignal {
            WS_CTRL_C_EVENT = 0,
            WS_CTRL_BREAK_EVENT = 1,
        };
#endif

        /// One end of a pipe to the child, as an ordinary \c std::iostream.
        ///
        /// Only open for a stream that was set to \c Pipe, which isOpen() reports.
        class STDC_EXPORT Stream : public std::iostream {
        public:
            Stream();
            ~Stream() override;

            /// Closes this end. Doing it twice is harmless.
            ///
            /// \note On the child's stdin this is what signals end of input, without which a
            ///       child reading to EOF never finishes.
            void close();

            bool isOpen() const;

            /// The same pipe as a \c FILE *, for the C interfaces that take nothing else.
            ///
            /// \warning Owned by the Stream. Do not \c fclose it, and do not keep it past
            ///          close(), which leaves it dangling.
            FILE *file() const;

        private:
            friend class Popen;
            void open(FILE *file);

            class Buf;
            std::unique_ptr<Buf> _buf;

            STDC_DISABLE_COPY_MOVE(Stream)
        };

        Popen();
        ~Popen();

        /// Moving takes the child, its pipes and its settings across. Move assignment destroys
        /// the destination's previous state immediately. A running child owned by that state is
        /// killed and waited for then, while a detached child keeps running.
        ///
        /// \note A Popen that has been moved from holds nothing and is only good for being
        ///       destroyed or assigned to.
        Popen(Popen &&RHS) noexcept;
        Popen &operator=(Popen &&RHS) noexcept;

    public:
        /// \name Setup
        ///
        /// All of these take effect at start() and mean nothing after it.
        /// @{

        /// The file to load, where that should not also be the name the program is given.
        ///
        /// \warning Almost nobody wants this. \c args()[0] is both the file to run and the name,
        ///          and leaving them the same is what nearly every program expects. It is not
        ///          what makes a path with a space in it work, nor what stops one being looked
        ///          up along \c PATH, since \c args()[0] covers both already.
        ///
        /// Set it only where the two must differ, which means a program that reads its own name
        /// and behaves accordingly. \c execve takes the file and the argument vector separately,
        /// so nothing requires them to agree, and \c login relies on that to start a shell under
        /// the name \c -bash.
        ///
        /// \code
        ///   // loads /bin/busybox, which finds "ls" as its name and behaves as ls
        ///   popen.executable("/bin/busybox").args({"ls", "-l"});
        /// \endcode
        ///
        /// \note Under shell() it names the shell instead, standing in for \c /bin/sh or
        ///       \c cmd.exe, and there it is the ordinary way to ask for a different one.
        /// \sa args()
        Popen &executable(std::filesystem::path executable);

        /// The argument vector, \c argv[0] included.
        ///
        /// \c args[0] is both the file to run and the name the program is given, unless
        /// executable() separates them. A name with no separator in it is looked up along
        /// \c PATH, and one with a separator is taken as written.
        ///
        /// \note Quoting is handled here. An argument with a space in it, \c args[0] included,
        ///       arrives at the program as one argument on either platform.
        /// \sa executable()
        Popen &args(std::vector<std::string> args);

        /// Hands the command to the system shell rather than executing it directly, so its
        /// redirections and expansions apply.
        ///
        /// args() keeps its usual argument-vector meaning when this is enabled. Each element is
        /// quoted for the platform shell so spaces, quotes, and shell metacharacters stay inside
        /// that argument.
        ///
        /// \note On Windows the shell's console is hidden unless startupInfo() sets
        ///       \c STARTF_USESHOWWINDOW, which then decides.
        Popen &shell(bool shell);

        /// The child's working directory. Inherited if left unset.
        Popen &cwd(std::filesystem::path cwd);

        /// The child's environment, which replaces ours rather than adding to it.
        ///
        /// \param env the variables to give the child, or \c std::nullopt to hand down the ones
        ///        this process has. An empty map asks for an empty environment, which is not the
        ///        same thing.
        /// \note Replacing it drops \c PATH along with everything else, so a bare program name
        ///       will not be found unless \a env carries one.
        Popen &env(std::optional<std::map<std::string, std::string>> env);

        /// \overload
        inline Popen &env(std::initializer_list<std::pair<const std::string, std::string>> env) {
            return this->env(std::map<std::string, std::string>(env));
        }

        /// Where each standard stream goes. Inherited if left unset.
        ///
        /// \param dev \c Pipe to talk over, \c DeviceNull to discard, a descriptor or \c FILE * to
        ///        hand it somewhere of your own, or \c StandardOutput on standardError() alone
        ///        to fold the two together
        Popen &standardInput(IODev dev);
        Popen &standardOutput(IODev dev);
        Popen &standardError(IODev dev);

        /// Opens the pipes in text mode, which on Windows translates between \c CRLF and \c LF
        /// as they are read and written. Nothing changes elsewhere.
        Popen &text(bool text);

        /// Whether the child starts with only the standard streams open. On by default, so a
        /// descriptor of ours is not left in a process that never asked for it.
        ///
        /// \sa passFds(), for the exceptions
        Popen &closeFds(bool closeFds);

        /// Starts the child independently of this object. Off by default, so destroying a Popen
        /// whose child is still running kills it.
        ///
        /// On Unix this uses \c setsid() and a double fork, leaving the final process to init or
        /// the nearest child subreaper. On Windows its process handle is closed after creation.
        /// In both cases pid() remains available, but wait(), poll(), communicate(), kill() and
        /// terminate() and sendSignal() do not: this process no longer owns the child.
        ///
        /// \note Set this before start(). Changing it afterwards has no effect.
        /// \note \c Pipe is not supported for a detached child. Use inherited streams, files or
        ///       the null device.
        Popen &detached(bool detached);

        /// The capacity of the pipes created for this child, in bytes. The kernel rounds up,
        /// and caps it at \c /proc/sys/fs/pipe-max-size for an unprivileged caller.
        Popen &pipeSize(int pipeSize); // linux only (ignored on other platforms)

#ifdef _WIN32
        /// The \c STARTUPINFO fields to start the child with, and the attributes to give it.
        ///
        /// \param startupInfo what to pass \c CreateProcess, or \c std::nullopt to let this
        ///        decide, which is what the stream settings above already do
        /// \note Windows only, and taken by value: what is given here is copied rather than kept
        ///       as a reference to the caller's object.
        /// \note An \c lpAttributeList carrying \c handle_list decides for itself which handles
        ///       the child inherits, so it overrides closeFds() and says so in a warning.
        /// \note \c dwFlags carrying \c STARTF_USESHOWWINDOW overrides shell()'s hidden console.
        Popen &startupInfo(std::optional<StartupInfo> startupInfo);
        Popen &creationFlags(int creationFlags); // windows only
#else
        /// Runs in the child after the pipes are in place and before exec.
        ///
        /// \warning The child has one thread, the one that called \c fork. Any lock another
        ///          thread held at that moment is still held and will never be released, so
        ///          allocating or locking here can deadlock the child outright.
        Popen &preExec(std::function<void()> preExec); // unix only

        /// Puts the signal dispositions this process changed back to their defaults, so the
        /// child does not inherit an ignored \c SIGPIPE it never asked for. On by default.
        Popen &restoreSignals(bool restoreSignals); // unix only

        /// Runs \c setsid() in the child, putting it in a session of its own so a terminal
        /// signal aimed at this process group misses it.
        Popen &startNewSession(bool startNewSession); // unix only

        /// Descriptors to leave open across exec despite closeFds().
        ///
        /// \note Setting this forces closeFds() on, since the two disagree otherwise.
        Popen &passFds(std::vector<int> passFds); // unix only

        /// Credentials for the child.
        ///
        /// \pre The calling process is privileged. start() fails with \c EPERM otherwise.
        /// \note extraGroups() replaces the supplementary group list rather than adding to it.
        Popen &group(int group);                          // unix only
        Popen &extraGroups(std::vector<int> extraGroups); // unix only
        Popen &user(int user);                            // unix only
        /// The name is copied and need not outlive this call.
        Popen &user(const char *user); // unix only

        /// The file creation mask for the child, or -1 to inherit ours.
        Popen &umask(int umask); // unix only

        /// The process group to join, or 0 to start one of its own. -1 inherits ours.
        Popen &processGroup(int processGroup); // unix only
#endif

        /// @}

    public:
        /// \name Starting
        /// @{

        /// Starts the process.
        ///
        /// \retval true the child is running, and any \c Pipe stream is open
        /// \retval false nothing was started, with the reason in errorMessage()
        /// \note Read errorMessage() rather than errorCode() here. Many of the ways a start can
        ///       fail are about the request rather than a system call, and no code stands for
        ///       those.
        /// \note One Popen runs one child. Calling this again after a child has been started is
        ///       not supported. Use another Popen.
        bool start();

        /// @}

    public:
        /// \name Waiting
        ///
        /// None of these work on a detached child, which this process no longer owns. They fail
        /// with \c operation_not_supported rather than guess.
        /// @{

        /// Whether the child has exited, without waiting for it.
        ///
        /// \retval true it has exited, and returnCode() now holds the status
        /// \retval false it is still running, which is not an error, or the check itself failed
        /// \note Tell those two apart by returnCode(), or by errorCode() being clear.
        bool poll();

        /// Waits for the child to exit.
        ///
        /// \param timeout how long to wait, in milliseconds, or negative to wait forever
        /// \retval false the timeout ran out, or the wait failed
        /// \note The pipes stay readable afterwards, so output can still be collected.
        bool wait(int timeout = -1);

        /// Writes \a input to the child, reads stdout and stderr to the end, and waits.
        ///
        /// The only safe way to do all three, since draining one pipe at a time deadlocks as
        /// soon as the other one fills.
        ///
        /// \param input written to the child's stdin, which is then closed so that a child
        ///        reading to end of input can finish
        /// \param timeout how long to allow for writing, reading and waiting together, in
        ///        milliseconds, or negative for no limit
        /// \return what the child wrote to stdout and to stderr, each empty if that stream was
        ///         not a \c Pipe
        /// \note A child still running at \a timeout is killed rather than left behind, and
        ///       errorCode() then reports a timeout.
        std::tuple<std::string, std::string> communicate(const std::string &input = {},
                                                         int timeout = -1);

        /// Sends \a sig to the child. On Windows only \c WS_CTRL_C_EVENT and
        /// \c WS_CTRL_BREAK_EVENT are accepted.
        ///
        /// \note A detached child is refused even though pid() names it, and this one is worth
        ///       the explanation. Signalling by number is safe only while the process is known
        ///       to be running, since the system may have given that number to something else
        ///       the moment the old owner exited. For a child of ours the number is held until
        ///       it is waited for, and this checks first. A detached child cannot be waited
        ///       for, so there is nothing to check against. Send the signal yourself through
        ///       pid() where you have other grounds to believe it is still running.
        bool sendSignal(int sig);

        /// Requests the process to close, like \c QProcess::terminate. Posts \c WM_CLOSE to its
        /// windows on Windows and sends \c SIGTERM elsewhere.
        ///
        /// \note This is a request. The process may ignore it, and a console program has no
        ///       message loop to see it in the first place.
        /// \sa kill(), to force it
        /// \sa sendSignal(), for why a detached child is refused
        bool terminate();

        /// Ends the process outright, which it cannot refuse.
        ///
        /// \warning Anything the child was part way through writing is lost.
        /// \sa sendSignal(), for why a detached child is refused
        bool kill();

        /// @}

    public:
        /// \name Failures
        ///
        /// Both answer for whichever operation ran last, and both are cleared as the next one
        /// begins.
        /// @{

        /// The failure as a code.
        std::error_code errorCode() const;

        /// The same failure in words, empty where the last operation did not fail.
        ///
        /// \note Says more than errorCode().message() alone where the failure was in a system
        ///       call, since it names the call, and where the request was refused before any
        ///       call was made, which no \c errno describes.
        std::string errorMessage() const;

        /// @}

    public:
        /// \name Properties
        /// @{

        /// What executable() was set to, empty where it was not set.
        ///
        /// Not \c args()[0] in that case, on purpose. Which file runs is worked out by start(),
        /// along \c PATH where \c args()[0] carries no separator, so answering with it here would
        /// look like a resolution that has not happened yet.
        const std::filesystem::path &executable() const;

        array_view<std::string> args() const;

        /// The pipe for that stream. Not open unless it was set to \c Pipe.
        ///
        /// \warning These reference storage inside the Popen, so they do not outlive it.
        Stream &standardInput() const;
        Stream &standardOutput() const;
        Stream &standardError() const;

        /// The child's process id, or -1 before start() and after one that failed.
        ///
        /// \note For a detached child this is the process that runs the program, not the
        ///       intermediate one that forked it, which is gone before start() returns.
        /// \note The number stays behind after the child exits, and the system is free to give
        ///       it to something else once the child has been waited for, so it names a process
        ///       of ours only while returnCode() is empty.
        int pid() const;

        /// What detached(bool) was set to, which is what start() acted on: changing it after
        /// that does nothing.
        bool detached() const;

        /// The exit status, or nothing while the child is still running.
        ///
        /// \note A child killed by a signal reports the negated signal number, as in Python, so
        ///       a \c SIGKILL comes back as -9.
        std::optional<int> returnCode() const;

        /// @}

    protected:
        class Impl;
        std::unique_ptr<Impl> _impl;
    };

    /// @}
}

#endif // STDCORELIB_POPEN_H

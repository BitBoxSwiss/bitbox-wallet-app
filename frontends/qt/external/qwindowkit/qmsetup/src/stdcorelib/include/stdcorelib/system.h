// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_SYSTEM_H
#define STDCORELIB_SYSTEM_H

#include <string>
#include <vector>
#include <filesystem>
#include <map>

#include <stdcorelib/stdc_global.h>
#include <stdcorelib/adt/array_view.h>

/// \defgroup platform Platform and system
///
/// What the program can ask about itself and about the machine, answered from the OS rather than
/// from \c argv[0].
///
/// \code
///     using namespace stdc;
///
///     auto dir  = system::application_directory();
///     auto args = system::command_line_arguments();    // UTF-8, from the wide command line
///     auto env  = system::environment();               // UTF-8 too, however it is stored
///     auto text = path::to_utf8(dir / "config.json");  // path::string() is the lossy one
///     auto tidy = path::clean_path(messy);             // resolves . and .. without touching disk
/// \endcode
///
/// On Windows, stdc::windows::RegKey and stdc::windows::RegValue read and write the registry. Every
/// operation comes in two forms: one taking an \c std::error_code and \c noexcept, one without that
/// throws.
///
/// \code
///     using namespace stdc::windows;
///
///     std::error_code ec;
///     RegKey hklm(RegKey::RK_LocalMachine);
///     RegKey key = hklm.open(L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", ec);
///     if (key.isValid()) {
///         auto name = key.value(L"ProductName", ec).toString();
///     }
/// \endcode

namespace stdc {

    /// \addtogroup platform
    /// @{

    namespace system {

        /// \name Program location
        /// @{

        /// The executable's own path, taken from the OS rather than from \c argv[0], which the
        /// parent process is free to have set to anything.
        STDC_EXPORT std::filesystem::path application_path();

        /// The directory holding the executable, which is where to look for files shipped
        /// alongside it.
        STDC_EXPORT std::filesystem::path application_directory();

        /// The executable's file name, extension included.
        STDC_EXPORT std::filesystem::path application_filename();

        /// The file name with its extension removed, as UTF-8.
        STDC_EXPORT std::string application_name();

        /// @}

        /// \name Command line
        /// @{

        /// The arguments as UTF-8, including \c argv[0].
        ///
        /// \return a view over storage that lives as long as the process
        /// \note On Windows these come from the wide command line, so a path \c main() could not
        ///       spell survives intact.
        STDC_EXPORT array_view<std::string> command_line_arguments();

        /// Splits \a command the way the host would, undoing the quoting that
        /// join_command_line() applies.
        ///
        /// \sa join_command_line()
        STDC_EXPORT std::vector<std::string> split_command_line(const std::string_view &command);

        /// Joins \a args into one command line, quoting each so that the receiving program takes
        /// it apart into the same pieces.
        ///
        /// \sa split_command_line()
        STDC_EXPORT std::string join_command_line(const std::vector<std::string> &args);

        /// Whether \a args is short enough for the system to start a program with.
        ///
        /// Windows builds one string for \c CreateProcess and refuses it past 32767 characters,
        /// so this quotes \a args the way a process launcher would and measures what comes out
        /// rather than guessing at it. POSIX counts the arguments and the environment together
        /// against \c ARG_MAX, so half of it is left for the environment, and no single argument
        /// may reach the 128 KiB one of its own that Linux imposes.
        ///
        /// This is what a response file is for. A build system generating one long command line
        /// asks this first, and writes the arguments to a file and passes \c \@file instead when
        /// the answer is no.
        ///
        /// \note What Windows counts is the UTF-16 these become, and UTF-8 is never shorter
        ///       than the UTF-16 of the same text, so counting bytes here can only refuse a
        ///       line the system would have taken. It never accepts one the system would
        ///       refuse, which is the direction that matters.
        /// \note A yes is not a promise that starting the program will succeed, only that it
        ///       will not fail for this reason. Both limits are approached conservatively.
        /// \sa cli::Parser::EnableResponseFile, which is the other end of the same problem
        STDC_EXPORT bool command_line_fits(const std::vector<std::string> &args);

        /// @}

        /// The environment of the current process, as UTF-8.
        STDC_EXPORT std::map<std::string, std::string> environment();

    }

    /// @}
}

#endif // STDCORELIB_SYSTEM_H

#ifndef UTILS_H
#define UTILS_H

#include <chrono>
#include <filesystem>
#include <functional>
#include <regex>
#include <set>
#include <string>
#include <vector>

// Everything that is not a command. The commands are under commands/ and what they have in
// common is in commands.h, which knows about a command line. Nothing here does.
//
// The portable half is in utils.cpp and the rest in utils_win.cpp or utils_unix.cpp. A
// declaration under a platform guard here is answered by exactly one of those.

// The vocabulary first, at file scope rather than under Utils, because these are what the rest
// of the program is written in rather than something it calls. The verbs are all under Utils.

namespace fs = std::filesystem;

/// The character a path is made of.
///
/// Windows hands them out as wide strings and everywhere else as narrow ones, and both are
/// native, so anything that works on a name rather than on a path is written in terms of this
/// rather than picking one and converting at every call.
#ifdef _WIN32
using TChar = wchar_t;
using TString = std::wstring;
#else
using TChar = char;
using TString = std::string;
#endif

using TStringList = std::vector<TString>;
using TStringSet = std::set<TString>;

/// A native string as UTF-8, for printing and for anything the command line handed over.
std::string tstr2str(const TString &str);

/// The other way about.
TString str2tstr(const std::string &str);

namespace Utils {

    /// \name Text
    /// @{

    /// Replaces every occurrence of \a pattern in \a s.
    ///
    /// \note Splitting, joining, trimming and case folding come from stdcorelib. This is the one
    ///       thing it does not have.
    template <class T>
    void replaceString(std::basic_string<T> &s, const std::basic_string<T> &pattern,
                       const std::basic_string<T> &text) {
        size_t idx = 0;
        while ((idx = s.find(pattern, idx)) != std::basic_string<T>::npos) {
            s.replace(idx, pattern.size(), text);
            idx += text.size();
        }
    }

    /// Whether any of \a regexList matches \a s.
    ///
    /// \note Separators are made uniform first, so that a pattern written with forward slashes
    ///       matches on Windows too.
    template <class T>
    bool searchInRegexList(std::basic_string<T> s,
                           const std::vector<std::basic_string<T>> &regexList) {
        std::replace(s.begin(), s.end(), T('\\'), T('/'));

        for (const auto &pattern : regexList) {
            if (std::regex_search(s.begin(), s.end(), std::basic_regex<T>(pattern))) {
                return true;
            }
        }
        return false;
    }

    /// The time as a build log would want to read it.
    std::string time2str(const std::chrono::system_clock::time_point &t);

    /// What the last system call had to say, for a message that would otherwise carry a number.
    std::string sysErrorMessage(int code = errno);

    /// @}

    /// \name Files
    /// @{

    /// Whether \a path is a link rather than the thing it names.
    ///
    /// Asked here rather than of \c fs::is_symlink(), which answers for a Windows link according
    /// to whose standard library built the program.
    bool isLink(const fs::path &path);

    struct FileTime {
        std::chrono::system_clock::time_point accessTime;
        std::chrono::system_clock::time_point modifyTime;
        std::chrono::system_clock::time_point statusChangeTime; ///< Creation time on Windows
    };

    FileTime fileTime(const fs::path &path);

    /// \note The status change time cannot be set on unix, so what is written there is the other
    ///       two.
    void setFileTime(const fs::path &path, const FileTime &times);

    inline void syncFileTime(const fs::path &dest, const fs::path &src) {
        setFileTime(dest, fileTime(src));
    }

    /// Copies \a file into the directory \a dest.
    ///
    /// The copy is given the timestamps of what it came from, so that the comparison below holds
    /// on the run after.
    ///
    /// \param symlinkContent makes a link naming that rather than copying anything
    /// \param force writes without comparing
    /// \retval true something was written
    /// \retval false the destination was already the same file, or no older than the source
    bool copyFile(const fs::path &file, const fs::path &dest, const fs::path &symlinkContent,
                  bool force, bool verbose);

    /// Copies the contents of \a srcDir into \a destDir, keeping the structure.
    ///
    /// \param srcRootDir what a path handed to \a ignore is measured from, so that a pattern can
    ///        be written against the tree rather than against wherever the walk has reached
    /// \param ignore asked about each entry, and what it says yes to is left behind
    void copyDirectory(const fs::path &srcRootDir, const fs::path &srcDir, const fs::path &destDir,
                       bool force, bool verbose,
                       const std::function<bool(const fs::path &)> &ignore = {});

    /// Removes the empty directories under \a path, and \a path itself if that leaves it empty.
    ///
    /// \return whether \a path was removed
    bool removeEmptyDirectories(const fs::path &path, bool verbose);

    /// @}

    /// \name Processes
    /// @{

    /// Runs a program and answers with what it wrote, with its standard error folded in.
    ///
    /// \exception std::runtime_error anything other than a nought exit, carrying what the
    ///            program said
    /// \note Windows binary dependencies come out of the import table rather than from asking a
    ///       tool, so this function is not used on Windows now.
    std::string executeCommand(const std::string &command, const std::vector<std::string> &args);

    /// @}

    /// \name Binaries
    ///
    /// Three formats, three ways of asking. Windows reads the import table of a PE file, macOS
    /// asks \c otool, and Linux reads the binary's own \c DT_NEEDED and has \c ldd place the
    /// names.
    /// @{

#ifdef _WIN32
    /// What \a path needs, as absolute paths.
    ///
    /// \param unparsed filled in with the names that could not be placed, which a deployment
    ///        reports and carries on from
    std::vector<std::wstring>
        resolveWinBinaryDependencies(const fs::path &path,
                                     const std::vector<fs::path> &searchingPaths,
                                     std::vector<std::string> *unparsed);
#else
    /// \copydoc resolveWinBinaryDependencies
    std::vector<std::string>
        resolveUnixBinaryDependencies(const fs::path &path,
                                      const std::vector<fs::path> &searchingPaths,
                                      std::vector<std::string> *unparsed = nullptr);

    /// Where \a file should look for what it needs, replacing whatever it said before.
    void setFileRPaths(const std::string &file, const std::vector<std::string> &paths);
#endif

#ifdef __APPLE__
    /// The install names \a file carries, as written, which for something built on this machine
    /// are the paths it was built against.
    std::vector<std::string> getMacAbsoluteDependencies(const std::string &file);

    /// Rewrites the install names of \a file.
    ///
    /// \param depPairs what each name is now and what it should become
    void replaceMacFileDependencies(
        const std::string &file, const std::vector<std::pair<std::string, std::string>> &depPairs);
#elif defined(__linux__)
    /// The dynamic loader \a file names, or nothing where it names none.
    std::string getInterpreter(const std::string &file);

    /// \return whether \a file had an interpreter to set
    bool setFileInterpreter(const std::string &file, const std::string &interpreter);
#endif

    /// @}

}

#ifdef _WIN32
#  define _TSTR(X) L##X
#  define tstrcmp  wcscmp
#else
#  define _TSTR(X) X
#  define tstrcmp  strcmp
#endif

#endif // UTILS_H

#include "utils.h"

#include <algorithm>
#include <ctime>
#include <system_error>

#include <stdcorelib/console.h>
#include <stdcorelib/path.h>
#include <stdcorelib/support/popen.h>

using stdc::u8printf;

std::string tstr2str(const TString &str) {
    return stdc::path::to_utf8(str);
}

TString str2tstr(const std::string &str) {
    return stdc::path::from_utf8(str);
}

namespace Utils {

    std::string time2str(const std::chrono::system_clock::time_point &t) {
        std::time_t t2 = std::chrono::system_clock::to_time_t(t);
        std::string s(32, '\0');
        // Cut to what was written. Without this the string keeps the nulls it was made with and
        // carries them wherever it is printed.
        s.resize(std::strftime(s.data(), s.size(), "%Y-%m-%d %H:%M:%S", std::localtime(&t2)));
        return s;
    }

    std::string sysErrorMessage(int code) {
        return std::error_code(code, std::generic_category()).message();
    }

    bool copyFile(const fs::path &file, const fs::path &dest, const fs::path &symlinkContent,
                  bool force, bool verbose) {
        auto target = dest / file.filename();
        if (fs::exists(target)) {
            if (stdc::path::clean_path(target) == stdc::path::clean_path(file))
                return false; // Same file

            if (!force && Utils::fileTime(target).modifyTime >= Utils::fileTime(file).modifyTime)
                return false; // Not updated
        } else if (!fs::is_directory(dest)) {
            fs::create_directories(dest);
        }

        if (!symlinkContent.empty()) {
            if (verbose) {
                u8printf("Link: from \"%s\" to \"%s\"\n", tstr2str(file).data(),
                       tstr2str(symlinkContent).data());
            }

            if (fs::exists(target))
                fs::remove(target);
            fs::create_symlink(symlinkContent, target);
        } else {
            if (verbose) {
                u8printf("Copy: from \"%s\" to \"%s\"\n", tstr2str(file).data(), tstr2str(target).data());
            }
            fs::copy(file, dest, fs::copy_options::overwrite_existing);
            Utils::syncFileTime(target, file); // Sync time for each file
        }

        return true;
    }

    void copyDirectory(const fs::path &srcRootDir, const fs::path &srcDir, const fs::path &destDir,
                       bool force, bool verbose,
                       const std::function<bool(const fs::path &)> &ignore) {
        fs::create_directories(destDir); // Ensure the destination directory exists

        // canonical() resolves every link on the way, so what it answers has to be compared with
        // a root that has been through the same thing. On macOS /var is a link to /private/var,
        // so a bundle under a temporary directory failed the test below and had its internal
        // links copied as directories.
        std::error_code ec;
        const auto canonicalRoot = fs::weakly_canonical(srcRootDir, ec);
        const auto &root = ec ? srcRootDir : canonicalRoot;

        for (const auto &entry : fs::directory_iterator(srcDir)) {
            const auto &entryPath = entry.path();
            if (ignore && ignore(entryPath))
                continue;

#ifndef _WIN32
            if (fs::is_symlink(entryPath)) {
                fs::path linkPath;
                try {
                    linkPath = fs::canonical(entryPath);
                } catch (...) {
                    // The symlink is invalid
                    copyFile(entryPath, destDir, {}, force, verbose);
                    continue;
                }

                // Copy if symlink points inside the source directory
                copyFile(entryPath, destDir,
                         stdc::str::starts_with(linkPath.string(), root.string())
                             ? fs::relative(linkPath, fs::canonical(entryPath.parent_path())).string()
                             : std::string(),
                         force, verbose);
                continue;
            }
#endif

            if (fs::is_regular_file(entryPath)) {
                copyFile(entryPath, destDir, {}, force, verbose);
            } else if (fs::is_directory(entryPath)) {
                copyDirectory(srcRootDir, entryPath, destDir / entryPath.filename(), force, verbose,
                              ignore);
            }
        }
    }

    bool removeEmptyDirectories(const fs::path &path, bool verbose) {
        // A link is one of the things that is not a directory, whatever it points at. Walking
        // into one leaves the tree that was named, and what is emptied out there is emptied for
        // good, so a caller asking about a link is told the directory holding it is not empty.
        if (isLink(path)) {
            return false;
        }

        bool isEmpty = true;
        for (const auto &entry : fs::directory_iterator(path)) {
            if (fs::is_directory(entry.path()) && removeEmptyDirectories(entry.path(), verbose)) {
                continue;
            }

            // File or non-empty directory
            isEmpty = false;
        }

        // Remove self if empty
        if (isEmpty) {
            if (verbose) {
                u8printf("Remove: \"%s\"\n", tstr2str(path).data());
            }
            fs::remove(path);
        }

        // Notify the caller the directory is empty or not
        return isEmpty;
    }

    std::string executeCommand(const std::string &command, const std::vector<std::string> &args) {
        // A generous cap rather than none at all. Everything run here is a quick tool, and a
        // build with one of them wedged should say so rather than wait for somebody to notice.
        constexpr int timeout = 120 * 1000;

        std::vector<std::string> argv;
        argv.reserve(args.size() + 1);
        argv.push_back(command);
        argv.insert(argv.end(), args.begin(), args.end());

        stdc::Popen proc;
        proc.args(argv)
            .standardInput(stdc::Popen::DeviceNull)
            .standardOutput(stdc::Popen::Pipe)
            // Folded together. What a tool says when it fails is what the error below carries,
            // and some of them say it on one stream and some on the other.
            .standardError(stdc::Popen::StandardOutput);

        if (!proc.start()) {
            throw std::runtime_error("failed to run \"" + command + "\": " + proc.errorMessage());
        }

        std::string output = std::get<0>(proc.communicate({}, timeout));
        if (proc.errorCode()) {
            throw std::runtime_error("failed to run \"" + command + "\": " + proc.errorMessage());
        }

        const auto code = proc.returnCode();
        if (!code) {
            throw std::runtime_error("command \"" + command + "\" did not finish");
        }
        if (*code == 0) {
            return output;
        }
        // A child that a signal ended comes back as the negated signal number.
        if (*code < 0) {
            throw std::runtime_error("command \"" + command + "\" was terminated by signal " +
                                     std::to_string(-*code));
        }
        throw std::runtime_error(std::string(stdc::str::trim(output)));
    }

}

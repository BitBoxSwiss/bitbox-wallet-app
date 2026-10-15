// What deploying comes to on Linux and macOS.
//
// Unlike Windows, a copy is no use where it lands unless it can find its own dependencies, so
// everything that was copied has its rpath rewritten to point where the libraries went. macOS
// wants two more things first: a universal binary thinned to the architecture in use, and the
// absolute install names it was built with turned back into @rpath.

#include "deploy_p.h"

#include <map>

#include <stdcorelib/console.h>
#include <stdcorelib/path.h>
#include <stdcorelib/str.h>
#include <stdcorelib/stlextra/algorithms.h>

#include "utils/utils.h"

using stdc::u8printf;

namespace {

    // Copies a library and the symlink that named it, and answers with the real file. A shared
    // library on Unix is usually a chain of names, and what matters at the far end is that the
    // soname the loader asks for is there beside the real thing.
    fs::path copyCanonical(const fs::path &path, const fs::path &dest, bool force, bool verbose) {
        if (fs::is_symlink(path)) {
            const auto &linkPath = fs::canonical(path);
            Utils::copyFile(linkPath, dest, {}, force, verbose);
            Utils::copyFile(path, dest, linkPath.filename(), force, verbose);
            return dest / linkPath.filename();
        }

        Utils::copyFile(path, dest, {}, force, verbose);
        return dest / path.filename();
    }

    void fixRPaths(const fs::path &file, const std::vector<std::string> &paths, bool verbose) {
        if (verbose) {
            u8printf("Fix rpath: \"%s\"\n", file.string().data());
            for (const auto &path : paths) {
                u8printf("    %s\n", path.data());
            }
        }
        Utils::setFileRPaths(file, paths);
    }

}

#ifdef __APPLE__

namespace {

    // Which configurations of a framework something asked for. A framework holds a release
    // library and may hold a debug one beside it, and copying the one nobody asked for doubles
    // the size of a deployment for nothing.
    enum FrameworkType {
        NoFramework = 0,
        Release = 1,
        Debug = 2,
    };

    std::map<std::string, int> g_frameworkTypes;

    bool isFramework(const fs::path &path) {
        return stdc::str::to_lower(path.extension().string()) == ".framework";
    }

    // Foo.framework/Versions/A/Foo names Foo.framework, three levels up.
    fs::path lib2framework(fs::path path, const fs::path &fallback = {}) {
        for (int i = 0; i < 3; ++i) {
            if (!path.has_parent_path()) {
                return fallback;
            }
            path = path.parent_path();
        }
        if (isFramework(path)) {
            return path;
        }
        return fallback;
    }

    fs::path framework2lib(fs::path path, const fs::path &fallback = {}) {
        try {
            return fs::canonical(path / path.stem());
        } catch (...) {
        }
        return fallback;
    }

    fs::path framework2lib_debug(fs::path path, const fs::path &fallback = {}) {
        try {
            return fs::canonical(path / (path.stem().string() + "_debug"));
        } catch (...) {
        }
        return fallback;
    }

    // Runs \a action on whatever library a path stands for. A framework has one or two inside it,
    // and everything else is itself.
    void forEachLibrary(const fs::path &file, const std::function<void(const fs::path &)> &action) {
        if (!isFramework(file)) {
            action(file);
            return;
        }

        if (const auto &lib = framework2lib(file); !lib.empty()) {
            action(lib);
        }
        if (const auto &libDebug = framework2lib_debug(file); !libDebug.empty()) {
            action(libDebug);
        }
    }

    // The headers a framework carries are of no use to something that only loads it, and the
    // configuration nobody asked for is dead weight.
    bool frameworkIgnore(const fs::path &path, const fs::path &frameworkName, int type) {
        if (!(type & Release) && path.filename() == frameworkName) {
            return true;
        }
        if (!(type & Debug) && path.filename() == frameworkName.string() + "_debug") {
            return true;
        }
        return fs::is_directory(path) && path.filename() == "Headers" &&
               fs::is_directory(path.parent_path() / "Resources");
    }

    // A framework is expected to end up where its rpath already says, so these are the ones a
    // bundle uses rather than anything worked out from where it landed.
    void fixFrameworkRPaths(const fs::path &path, bool verbose) {
        fixRPaths(path,
                  {
                      "@executable_path/../Frameworks",
                      "@loader_path/Frameworks",
                      "@loader_path/../../..",
                  },
                  verbose);
    }

    fs::path copyFrameworkOrFile(const fs::path &file, const fs::path &dest, int type, bool force,
                                 bool verbose) {
        if (!fs::is_directory(file)) {
            return copyCanonical(file, dest, force, verbose);
        }

        const auto &name = file.stem();
        const auto targetPath = dest / file.filename();
        Utils::copyDirectory(file, file, targetPath, force, verbose, [&](const fs::path &path) {
            return frameworkIgnore(path, name, type);
        });
        return targetPath;
    }

    // A universal binary carries every architecture it was built for, and a deployment for this
    // machine wants one of them.
    void stripUniversalBinary(const fs::path &file, const std::string &arch, bool verbose) {
        if (!fs::is_regular_file(file)) {
            return;
        }

        std::string lipoInfo;
        try {
            lipoInfo = Utils::executeCommand("lipo", {"-info", file.string()});
        } catch (const std::exception &) {
            return; // Not something lipo has anything to say about
        }

        if (lipoInfo.find("Architectures") == std::string::npos) {
            return; // Not a universal binary
        }

        if (lipoInfo.find(arch) == std::string::npos) {
            if (verbose) {
                u8printf("Warning: Universal binary \"%s\" does not contain %s architecture\n",
                         file.string().data(), arch.data());
            }
            return;
        }

        try {
            if (verbose) {
                u8printf("Strip universal binary: \"%s\" (keep %s)\n", file.string().data(),
                         arch.data());
            }
            std::ignore = Utils::executeCommand(
                "lipo", {file.string(), "-thin", arch, "-output", file.string()});
        } catch (const std::exception &e) {
            if (verbose) {
                u8printf("Warning: Failed to strip universal binary \"%s\": %s\n",
                         file.string().data(), e.what());
            }
        }
    }

    // What was built names its dependencies by where they were at build time. A deployment that
    // left those alone would depend on the machine it was built on, so each one that was brought
    // along is named by @rpath instead.
    void normalizeDependencies(const fs::path &file, const std::set<std::string> &deployedNames,
                               bool verbose) {
        std::vector<std::pair<std::string, std::string>> normalized;
        for (const auto &dep :
             Utils::getMacAbsoluteDependencies(isFramework(file) ? framework2lib(file) : file)) {
            const fs::path depPath = dep;

            // Only what was deployed, since anything else stays where it is.
            if (fs::exists(depPath) &&
                stdc::contains(deployedNames, fs::canonical(depPath).filename())) {
                normalized.emplace_back(dep, "@rpath/" + depPath.filename().string());
            }
        }

        if (normalized.empty()) {
            return;
        }

        if (verbose) {
            u8printf("Normalize dependencies: \"%s\"\n", file.string().data());
            for (const auto &item : std::as_const(normalized)) {
                u8printf("    %s\n", item.first.data());
            }
        }

        Utils::replaceMacFileDependencies(file, normalized);
    }

    std::string nativeArchitecture(bool verbose) {
        try {
            return std::string(stdc::str::trim(Utils::executeCommand("uname", {"-m"})));
        } catch (const std::exception &e) {
            if (verbose) {
                u8printf("Warning: Failed to get current architecture: %s\n", e.what());
            }
        }
        return {};
    }

}

namespace Deploy {

    fs::path toDeployable(const fs::path &path) {
        return lib2framework(path, path);
    }

    fs::path toResolvable(const fs::path &path) {
        if (auto lib = framework2lib(path); !lib.empty()) {
            return lib;
        }
        if (auto lib = framework2lib_debug(path); !lib.empty()) {
            return lib;
        }
        return path;
    }

    bool isSystemLibrary(const TString &fileName, bool standard) {
        // Nothing is filtered until --standard says so.
        if (!standard) {
            return false;
        }
        // Lower cased by the caller, so libSystem is spelled the way it arrives rather than the
        // way it is written.
        return stdc::str::starts_with(fileName, "libc++") ||
               stdc::str::starts_with(fileName, "libsystem");
    }

    void noteDependency(const fs::path &path) {
        if (!fs::is_directory(path)) {
            return;
        }
        // Which configuration was asked for decides what is worth copying out of the bundle.
        if (stdc::str::ends_with(path.filename().string(), "_debug")) {
            g_frameworkTypes[path.stem().string()] |= Debug;
        } else {
            g_frameworkTypes[path.stem().string()] |= Release;
        }
    }

    void deployFiles(const Request &request, const std::vector<fs::path> &dependencies) {
        auto targetOrgFiles = request.orgFiles;
        for (const auto &pair : std::as_const(request.extraFiles)) {
            targetOrgFiles.insert(copyFrameworkOrFile(pair.first, pair.second, Debug | Release,
                                                      request.force, request.verbose));
        }

        std::set<fs::path> targetDependencies;
        for (const auto &file : std::as_const(dependencies)) {
            int type = Debug | Release;
            if (const auto it = g_frameworkTypes.find(file.stem().string());
                it != g_frameworkTypes.end()) {
                type = it->second;
            }
            targetDependencies.insert(
                copyFrameworkOrFile(file, request.dest, type, request.force, request.verbose));
        }

        if (const auto arch = nativeArchitecture(request.verbose); !arch.empty()) {
            const auto &strip = [&](const fs::path &lib) {
                stripUniversalBinary(lib, arch, request.verbose);
            };
            for (const auto &file : std::as_const(targetOrgFiles)) {
                forEachLibrary(file, strip);
            }
            for (const auto &file : std::as_const(targetDependencies)) {
                forEachLibrary(file, strip);
            }
        }

        {
            std::set<std::string> deployedNames;
            const auto &remember = [&](const fs::path &file) {
                deployedNames.insert(isFramework(file) ? file.stem().string()
                                                       : file.filename().string());
            };
            for (const auto &file : std::as_const(targetOrgFiles)) {
                remember(file);
            }
            for (const auto &file : std::as_const(targetDependencies)) {
                remember(file);
            }

            for (const auto &file : std::as_const(targetOrgFiles)) {
                normalizeDependencies(file, deployedNames, request.verbose);
            }
            for (const auto &file : std::as_const(targetDependencies)) {
                normalizeDependencies(file, deployedNames, request.verbose);
            }
        }

        // A binary that was named stays where it is, so its rpath has to reach across to wherever
        // the libraries went.
        for (const auto &file : std::as_const(targetOrgFiles)) {
            if (isFramework(file)) {
                forEachLibrary(file,
                               [&](const fs::path &lib) { fixFrameworkRPaths(lib, request.verbose); });
            } else {
                fixRPaths(file,
                          {
                              "@executable_path/../Frameworks",
                              "@loader_path/" +
                                  stdc::path::clean_path(
                                      fs::relative(request.dest, file.parent_path()))
                                      .string(),
                          },
                          request.verbose);
            }
        }

        // A library that was copied is beside the others, so its own directory is enough.
        for (const auto &file : std::as_const(targetDependencies)) {
            if (isFramework(file)) {
                forEachLibrary(file,
                               [&](const fs::path &lib) { fixFrameworkRPaths(lib, request.verbose); });
            } else {
                fixRPaths(file,
                          {
                              "@executable_path/../Frameworks",
                              "@loader_path",
                          },
                          request.verbose);
            }
        }
    }

}

#else // Linux

namespace Deploy {

    fs::path toDeployable(const fs::path &path) {
        return path;
    }

    fs::path toResolvable(const fs::path &path) {
        return path;
    }

    bool isSystemLibrary(const TString &fileName, bool standard) {
        // Nothing is filtered until --standard says so.
        if (!standard) {
            return false;
        }
        return stdc::str::starts_with(fileName, "libstdc++") ||
               stdc::str::starts_with(fileName, "libgcc") ||
               stdc::str::starts_with(fileName, "libglib") ||
               stdc::str::starts_with(fileName, "libpthread") ||
               stdc::str::starts_with(fileName, "libgthread") ||
               stdc::str::starts_with(fileName, "libicu") ||
               stdc::str::starts_with(fileName, "libc.so") ||
               stdc::str::starts_with(fileName, "libc-") ||
               stdc::str::starts_with(fileName, "libdl.so") ||
               stdc::str::starts_with(fileName, "libdl-") ||
               // Spelled out rather than as "libm", which would take libmagic and libmount with
               // it.
               stdc::str::starts_with(fileName, "libm.so") ||
               stdc::str::starts_with(fileName, "libm-");
    }

    void noteDependency(const fs::path &path) {
        std::ignore = path;
    }

    void deployFiles(const Request &request, const std::vector<fs::path> &dependencies) {
        auto targetOrgFiles = request.orgFiles;
        for (const auto &pair : std::as_const(request.extraFiles)) {
            targetOrgFiles.insert(
                copyCanonical(pair.first, pair.second, request.force, request.verbose));
        }

        std::set<fs::path> targetDependencies;
        for (const auto &file : std::as_const(dependencies)) {
            const auto targetPath = copyCanonical(file, request.dest, request.force,
                                                  request.verbose);

            // libc.so is a linker script rather than a library, so there is nothing in it to
            // rewrite an rpath in.
            if (targetPath.filename() != "libc.so") {
                targetDependencies.insert(targetPath);
            }
        }

        // A binary that was named stays where it is, so its rpath has to reach across to wherever
        // the libraries went.
        for (const auto &file : std::as_const(targetOrgFiles)) {
            fixRPaths(file,
                      {"$ORIGIN/" +
                       stdc::path::clean_path(fs::relative(request.dest, file.parent_path()))
                           .string()},
                      request.verbose);
        }

        // A library that was copied is beside the others, so its own directory is enough.
        for (const auto &file : std::as_const(targetDependencies)) {
            fixRPaths(file, {"$ORIGIN"}, request.verbose);
        }
    }

}

#endif

namespace Deploy {

    std::vector<fs::path> resolveDependencies(const fs::path &file, const Request &request,
                                              std::vector<std::string> *unparsed) {
        const auto &names =
            Utils::resolveUnixBinaryDependencies(file, request.searchingPaths, unparsed);
        return {names.begin(), names.end()};
    }

}

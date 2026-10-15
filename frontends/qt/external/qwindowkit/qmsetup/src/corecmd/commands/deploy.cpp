// deploy, as far as it is the same everywhere: reading the command line, and walking the
// dependency graph. What is done with the answer is in deploy_win.cpp and deploy_unix.cpp.

#include "commands.h"
#include "deploy_p.h"

#include <algorithm>

#include <stdcorelib/console.h>
#include <stdcorelib/path.h>
#include <stdcorelib/str.h>
#include <stdcorelib/stlextra/algorithms.h>

using stdc::u8printf;

namespace {

    fs::path absoluteOf(const std::string &value) {
        return stdc::path::clean_path(fs::absolute(str2tstr(value)));
    }

    Deploy::Request readRequest(const cli::ParseResult &result) {
        Deploy::Request request;

        request.dryrun = isDryRunSet(result);
        // There is nothing else for a dry run to do, so it says what it found.
        request.verbose = request.dryrun || isVerboseSet(result);
        request.force = isForceSet(result);
        request.standard = isStandardSet(result);

        request.dest = fs::current_path();
        if (auto given = result.option("-o"); given) {
            request.dest = absoluteOf(givenValue(*given));
        }

        for (const auto &item : argumentValues(result, 0)) {
            request.orgFiles.insert(Deploy::toDeployable(absoluteOf(item)));
        }

        if (const auto &given = result.option("-c"); given) {
            const int count = given->count();
            request.extraFiles.reserve(count);
            for (int i = 0; i < count; ++i) {
                request.extraFiles.emplace_back(
                    Deploy::toDeployable(absoluteOf(givenValue(*given, 0, i))),
                    absoluteOf(givenValue(*given, 1, i)));
            }
        }

        // Where to look. The directory of each named binary comes first, since a library beside
        // the thing that names it needs no telling, then each -L, then the output directory,
        // which is where an earlier run of this command would have left things.
        {
            std::vector<fs::path> candidates;
            for (const auto &item : std::as_const(request.orgFiles)) {
                candidates.emplace_back(fs::path(item).parent_path());
            }
            for (const auto &item : optionValues(result, "-L")) {
                candidates.emplace_back(absoluteOf(item));
            }
            candidates.push_back(request.dest);

            std::set<fs::path> visited;
            for (auto item : std::as_const(candidates)) {
                if (fs::is_regular_file(item)) {
                    item = item.parent_path();
                } else if (!fs::is_directory(item)) {
                    continue;
                }
                if (stdc::contains(visited, item)) {
                    continue;
                }
                visited.insert(item);
                request.searchingPaths.emplace_back(item);
            }
        }

        for (const auto &item : optionValues(result, "-e")) {
            request.excludes.emplace_back(str2tstr(item));
        }

        return request;
    }

    // Everything the named binaries need, and everything those need, gathered breadth first.
    //
    // What is followed is each binary's own direct dependencies. A library that is passed over,
    // because it was excluded or because the machine already has it, is never opened, so what
    // only it asked for is never found either.
    std::vector<fs::path> resolveGraph(const Deploy::Request &request) {
        std::set<fs::path> namesOfOriginals;
        for (const auto &item : std::as_const(request.orgFiles)) {
            namesOfOriginals.insert(item.filename());
        }
        for (const auto &pair : std::as_const(request.extraFiles)) {
            namesOfOriginals.insert(pair.first.filename());
        }

        const auto &dependenciesOf = [&](const std::vector<fs::path> &paths) {
            std::set<TString> found;
            for (const auto &path : std::as_const(paths)) {
                if (request.verbose) {
                    u8printf("Resolve: \"%s\"\n", tstr2str(path).data());
                }

                std::vector<std::string> unparsed;
                for (const auto &item :
                     Deploy::resolveDependencies(Deploy::toResolvable(path), request, &unparsed)) {
                    if (request.verbose) {
                        u8printf("    %s\n", tstr2str(item).data());
                    }
                    found.insert(item);
                }

                if (request.verbose) {
                    size_t widest = 0;
                    for (const auto &item : std::as_const(unparsed)) {
                        widest = std::max(widest, item.size());
                    }
                    for (const auto &item : std::as_const(unparsed)) {
                        u8printf("    %s%s[Not Found]\n", item.data(),
                                 std::string(widest + 4 - item.size(), ' ').data());
                    }
                }
            }
            return std::vector<fs::path>{found.begin(), found.end()};
        };

        std::vector<fs::path> dependencies;
        std::set<TString> visited;
        std::vector<fs::path> stack = {request.orgFiles.begin(), request.orgFiles.end()};

        for (const auto &item : std::as_const(request.orgFiles)) {
            visited.insert(item.filename());
        }
        for (const auto &pair : std::as_const(request.extraFiles)) {
            visited.insert(pair.first.filename());
            stack.push_back(pair.first);
        }

        while (!stack.empty()) {
            const auto &libs = dependenciesOf(stack);
            stack.clear();

            for (const auto &lib : std::as_const(libs)) {
                const auto &path = Deploy::toDeployable(lib);

                // One of the binaries that was named, which stays where it is.
                if (stdc::contains(namesOfOriginals, path.filename())) {
                    continue;
                }

                const TString fileName = stdc::str::to_lower(TString(path.filename()));
                if (Deploy::isSystemLibrary(fileName, request.standard) ||
                    stdc::contains(visited, fileName)) {
                    continue;
                }
                visited.insert(fileName);

                if (Utils::searchInRegexList(TString(path), request.excludes)) {
                    continue;
                }

                Deploy::noteDependency(path);
                dependencies.push_back(path);
                stack.push_back(path);
            }
        }

        return dependencies;
    }

}

int cmd_deploy(const cli::ParseResult &result) {
    const auto request = readRequest(result);
    const auto dependencies = resolveGraph(request);

    if (request.dryrun) {
        return 0;
    }

    Deploy::deployFiles(request, dependencies);
    return 0;
}

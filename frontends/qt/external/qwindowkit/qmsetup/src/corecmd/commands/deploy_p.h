#ifndef DEPLOY_P_H
#define DEPLOY_P_H

#include "commands.h"

// Private to the deploy files. Reading the command line and walking the dependency graph is the
// same everywhere and lives in deploy.cpp. Everything declared here is answered by deploy_win.cpp
// or deploy_unix.cpp, exactly one of which is built.
namespace Deploy {

    /// What a deploy command line came to.
    struct Request {
        bool dryrun = false;
        bool verbose = false;
        bool force = false;
        bool standard = false;

        /// Where the dependencies go.
        fs::path dest;

        /// The binaries that were named. They stay where they are.
        std::set<fs::path> orgFiles;

        /// What \c -c named, and the directory each was told to go to.
        std::vector<std::pair<fs::path, fs::path>> extraFiles;

        /// Where to look, being the directory of each named binary, then each \c -L, then dest.
        std::vector<fs::path> searchingPaths;

        TStringList excludes;
    };

    /// \name Answered per platform
    /// @{

    /// The name a deployment works on.
    ///
    /// A macOS framework is deployed as its bundle directory and resolved as the library inside
    /// it. Everywhere else the two are the same path and both of these hand it straight back.
    ///
    /// \sa toResolvable()
    fs::path toDeployable(const fs::path &path);

    /// The name a resolver works on.
    ///
    /// \sa toDeployable()
    fs::path toResolvable(const fs::path &path);

    /// What \a file needs, as absolute paths.
    ///
    /// \param unparsed filled in with the names that could not be placed, which a deployment
    ///        reports and carries on from rather than treating as an error
    std::vector<fs::path> resolveDependencies(const fs::path &file, const Request &request,
                                              std::vector<std::string> *unparsed);

    /// Whether the machine already has this one, so that a deployment passes it over.
    ///
    /// Windows never deploys what is under its system directories, whether or not \c --standard
    /// was asked for, and \c --standard drops the MSVC runtime as well. Unix filters nothing
    /// until \c --standard says so.
    ///
    /// \param fileName lower cased, so anything matched against it has to be lower case too
    bool isSystemLibrary(const TString &fileName, bool standard);

    /// Told about each dependency as it is accepted, for whatever a platform has to remember.
    ///
    /// \note Only macOS has anything, being which configurations of a framework were asked for.
    void noteDependency(const fs::path &path);

    /// Copies what was resolved and puts right whatever moving it broke.
    ///
    /// On Windows that is the copying alone. On unix every copy has its rpath rewritten, and on
    /// macOS its install names normalised and its universal binaries thinned first.
    void deployFiles(const Request &request, const std::vector<fs::path> &dependencies);

    /// @}

}

#endif // DEPLOY_P_H

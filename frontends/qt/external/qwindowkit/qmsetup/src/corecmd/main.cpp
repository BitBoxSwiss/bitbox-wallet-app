// The command line, and nothing else. Each command is defined here and carried out in the file
// named after it.

#include <stdcorelib/console.h>
#include <stdcorelib/support/commandline.h>
#include <stdcorelib/system.h>

#include "commands/commands.h"

// What deploy calls the files it works on, since a message naming the wrong format would be
// worse than naming none.
#ifdef _WIN32
#  define OS_EXECUTABLE "Windows PE"
#elif defined(__APPLE__)
#  define OS_EXECUTABLE "Mach-O"
#else
#  define OS_EXECUTABLE "ELF"
#endif

static const cli::Option verboseOption({"-V", "--verbose"}, "Print more information");

int main(int argc, char *argv[]) {
    cli::Command copyCommand = []() {
        cli::Command command("copy", "Copy files or directories if different");
        command.addArguments({
            cli::Argument("src", "Source files or directories").multi(),
            cli::Argument("dest", "Destination directory"),
        });
        command.addOptions({
            cli::Option({"-e", "--exclude"}, "Exclude a path pattern").arg("regex").multi(),
            cli::Option({"-f", "--force"}, "Force overwrite existing files"),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_copy);
        return command;
    }();

    cli::Command rmdirCommand = []() {
        cli::Command command("rmdir", "Remove empty directories recursively");
        command.addArguments({
            cli::Argument("dir", "Directories").multi(),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_rmdir);
        return command;
    }();

    cli::Command touchCommand = []() {
        cli::Command command("touch", "Update file timestamp");
        command.addArguments({
            cli::Argument("file", "File to update time stamp"),
            cli::Argument("ref file", "Reference file", false),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_touch);
        return command;
    }();

    cli::Command configureCommand = []() {
        cli::Command command("configure", "Generate configuration header");
        command.addArgument(cli::Argument("output file", "Output header path"));
        command.addOptions({
            cli::Option({"-D", "--define"},
                        R"(Define a variable, format: <key>, <key>=<value>, %<raw>)")
                .arg("expr")
                .multi()
                .shortMatch(cli::Option::ShortMatchSingleChar),
            cli::Option({"-p", "--project"}, "Set project name").arg("name"),
            cli::Option({"-w", "--warning"}, "Generate warning text").arg("file", false),
            cli::Option({"-f", "--force"}, "Skip calculating hash and overwrite always"),
            cli::Option({"-d", "--dryrun"}, "Print contents only"),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_configure);
        return command;
    }();

    cli::Command incsyncCommand = []() {
        cli::Command command("incsync", "Reorganize header files of include directory");
        command.addArguments({
            cli::Argument("src", "Input directory containing source headers"),
            cli::Argument("dest", "Output directory of reorganized headers"),
        });
        command.addOptions({
            cli::Option({"-i", "--include"}, "Add a path pattern and corresponding subdirectory")
                .arg("regex")
                .arg("subdir")
                .multi(),
            cli::Option({"-e", "--exclude"}, "Exclude a path pattern").arg("regex").multi(),
            cli::Option({"-s", "--standard"}, "Add standard public-private name pattern"),
            cli::Option({"-n", "--not-all"}, "Ignore unclassified files"),
            cli::Option({"-c", "--copy"}, "Copy files rather than indirect reference"),
            cli::Option({"-d", "--dryrun"}, "Print reorganizing details only"),
            cli::Option({"-f", "--force"}, "Force deleting existing directory"),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_incsync);
        return command;
    }();

    cli::Command deployCommand = []() {
        cli::Command command("deploy", "Resolve and deploy " OS_EXECUTABLE " files' dependencies");
        command.addArguments({
            cli::Argument("file", OS_EXECUTABLE " file(s)").multi(),
        });
        command.addOptions({
            cli::Option({"-c", "--copy"}, "Additional " OS_EXECUTABLE " file(s) to copy")
                .arg("src")
                .arg("dir")
                .multi()
                .prior(cli::Option::IgnoreMissingArguments),
            cli::Option({"-o", "--out"},
                        "Set output directory of dependencies, defult to current directory")
                .arg("dir"),
            cli::Option({"-L", "--linkdir"}, "Add a library searching path")
                .arg("dir")
                .multi()
                .shortMatch(cli::Option::ShortMatchSingleChar),
            cli::Option({"-e", "--exclude"}, "Exclude a path pattern").arg("regex").multi(),
            cli::Option({"-s", "--standard"}, "Ignore C/C++ runtime and system libraries"),
            cli::Option({"-d", "--dryrun"}, "Print dependencies only"),
            cli::Option({"-f", "--force"}, "Force overwrite existing files"),
        });
        command.addOption(verboseOption);
        command.setHandler(cmd_deploy);
        return command;
    }();

    cli::Command rootCommand(stdc::system::application_name(),
                             "Cross-platform utility commands for C/C++ build systems.");
    rootCommand.addCommands({
        copyCommand,
        rmdirCommand,
        touchCommand,
        configureCommand,
        incsyncCommand,
        deployCommand,
    });
    rootCommand.addVersionOption(TOOL_VERSION);
    rootCommand.addHelpOption(true, true);

    cli::CommandCatalogue cc;
    cc.addCommands("Filesystem Commands", {"copy", "rmdir", "touch"});
    cc.addCommands("Buildsystem Commands", {"configure", "incsync", "deploy"});
    rootCommand.setCatalogue(cc);

    cli::Parser parser(rootCommand);
    parser.setPrologue(TOOL_DESC);
    parser.setEpilogue(TOOL_COPYRIGHT);
    parser.setDisplayOptions(cli::Parser::AlignAllCatalogues);

    // The copyright line under the page is worth setting apart from the page.
    {
        auto layout = cli::HelpLayout::defaultLayout();
        layout.setBodyStyle(cli::HelpBlock::Epilogue,
                            {stdc::console::bold, stdc::console::yellow});
        parser.setHelpLayout(layout);
    }

    // On Windows the arguments that reach main() are in the machine's ANSI code page, so the
    // wide command line is read instead and converted. Everywhere else argv is already what
    // the user typed.
    std::vector<std::string> args;
#ifdef _WIN32
    std::ignore = argc;
    std::ignore = argv;
    {
        const auto &given = stdc::system::command_line_arguments();
        args.assign(given.begin(), given.end());
    }
#else
    args.assign(argv, argv + argc);
#endif

    int ret;
    try {
        ret = parser.invoke(args, -1, cli::Parser::EnableResponseFile);
    } catch (const std::exception &e) {
        std::string msg = e.what();

#ifdef _WIN32
        if (typeid(e) == typeid(fs::filesystem_error)) {
            // What the standard library puts in what() is in the ANSI code page too.
            msg = stdc::wstring_conv::to_utf8(stdc::wstring_conv::from_ansi(e.what()));
        }
#endif

        stdc::console::printf(stdc::console::bold, stdc::console::lightred,
                              stdc::console::nocolor, "Error: %s\n", msg.data());
        ret = -1;
    }
    return ret;
}

"""`deploy` resolves a binary's shared library dependencies and copies them.

The tests run against a program built for the purpose, installed beside a
framework it uses. Read the framework as Qt and it is the familiar job: the
program's binaries stay where they are, what they need is gathered next to
them, and the framework's plugins have to be named by hand because nothing
links them.

    app/  app_exe -> app_lib -> app_leaf
                             -> sdk_lib
          app_plugin -> app_lib
          app_plugin_sdk -> sdk_lib
    sdk/  sdk_lib -> sdk_leaf
          sdk_alone                        linked by nothing of the program's
          sdk_plugin -> sdk_lib
          sdk_plugin_alone -> sdk_alone

What each command line should leave behind is declared in
``deploy_scenarios.json``, not written out here, and one test is generated per
scenario. What is left in code is the part that is not about the resulting
directory structure: option spellings, refusals, and the cases that have to
rearrange the sandbox first.

How a dependency is discovered differs on every platform. It is an import table
on Windows, ``@rpath`` on macOS, ``ldd`` on Linux. So the tests that need one to
have been resolved ask first, once, and skip themselves where the answer is no.
"""

from __future__ import annotations

import functools
import re
import subprocess
import tempfile
from pathlib import Path

from testing import fixtures_layout
from testing.harness import QmTestCase

PLACEHOLDER = re.compile(r"\{([a-zA-Z0-9_.]+)\}")


@functools.lru_cache(maxsize=1)
def resolution_problem(executable: str, fixture_dir: str) -> str:
    """Empty when this platform's resolver finds the fixtures, else why not.

    Asked once. A platform where the answer is no still runs everything that is
    about the command line rather than about the resolution.
    """
    fixtures = fixtures_layout.Fixtures(Path(fixture_dir))
    if fixtures.missing:
        return f"the fixture binaries were not built: {', '.join(fixtures.missing)}"

    with tempfile.TemporaryDirectory(prefix="qmcorecmd-probe-") as tmp:
        sandbox = Path(tmp)
        layout = fixtures.copy_into(sandbox)
        completed = subprocess.run(
            [
                executable, "deploy", layout.path("app_exe"),
                "-L", layout.directory("sdk_bin"),
                "-d", "-V",
            ],
            cwd=sandbox,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
        )
        out = completed.stdout.decode("utf-8", errors="replace")
        if completed.returncode != 0:
            return f"deploy could not run here: {out.strip()[:300]}"
        for line in out.splitlines():
            if layout.name("sdk_lib") in line:
                if "[Not Found]" in line:
                    return "the resolver saw the dependency but could not place it"
                return ""
        return "the resolver did not reach the framework the program links"


class DeployTestCase(QmTestCase):
    """Gives each test the two trees to work on, laid out as they were built."""

    needs_resolution = False

    def setUp(self):
        super().setUp()
        self.fixtures = fixtures_layout.load()
        if self.fixtures is None:
            self.skipTest("the fixture binaries were not built")
        if self.needs_resolution:
            problem = resolution_problem(
                str(self.executable), str(self.fixtures.directory)
            )
            if problem:
                self.skipTest(problem)
        self.layout = self.fixtures.copy_into(self.sandbox)

    def search_paths(self) -> list[str]:
        """Where the framework is, which is what Windows needs told."""
        return ["-L", self.layout.directory("sdk_bin")]

    def program(self) -> list[str]:
        """The program's own binaries, which stay where they are."""
        return [self.layout.path(a) for a in ("app_exe", "app_lib", "app_leaf", "app_plugin", "app_plugin_sdk")]

    # Reading the declaration

    def expand(self, token: str) -> str:
        """Turns `{sdk_leaf}` into its path and `{dir.media}` into its directory.

        `{abs.…}` gives the same thing as an absolute path, for the places a
        relative one would be read against the wrong directory.
        """

        def replace(match: re.Match) -> str:
            key = match.group(1)
            absolute = key.startswith("abs.")
            if absolute:
                key = key[len("abs."):]
            if key.startswith("dir."):
                value = self.layout.directory(key[len("dir."):])
            else:
                value = self.layout.path(key)
            return str(self.path(value)) if absolute else value

        return PLACEHOLDER.sub(replace, token)

    def files_in(self, directory: str) -> set[str]:
        target = self.sandbox if directory == "." else self.path(directory)
        if not target.is_dir():
            return set()
        return {p.name for p in target.iterdir() if p.is_file()}

    def deployed(self, directory: str = "out") -> set[str]:
        """The file names a deployment left in its output directory."""
        return self.files_in(directory)

    def snapshot(self) -> dict[str, int]:
        return {
            p.relative_to(self.sandbox).as_posix(): p.stat().st_size
            for p in self.sandbox.rglob("*")
            if p.is_file()
        }

    # Assertions

    def report_line(self, result, name: str) -> str:
        for line in result.out.splitlines():
            if name in line:
                return line
        self.fail(f"{name} was not reported at all{result}")

    def assertResolved(self, result, artifact: str):
        """The library was found, rather than reported as missing.

        Whatever C runtime the binaries were linked against is reported as
        missing too, since no test puts it on a search path, so this looks at
        the one line it is about rather than at the whole report.
        """
        line = self.report_line(result, self.layout.name(artifact))
        if "[Not Found]" in line:
            self.fail(f"{artifact} should have been found{result}")

    def assertNotResolved(self, result, artifact: str):
        line = self.report_line(result, self.layout.name(artifact))
        if "[Not Found]" not in line:
            self.fail(f"{artifact} should not have been found{result}")

    def assertDirectoryHolds(self, result, directory: str, artifacts: list):
        """Exactly these artifacts are in the directory, and nothing else."""
        wanted = {self.layout.name(a) for a in artifacts}
        found = self.files_in(directory)
        if found == wanted:
            return

        def describe(names):
            return sorted(f"{n} ({self.layout.artifact_of(n) or 'unexpected'})" for n in names)

        self.fail(
            f"{directory or '.'} does not hold what it should\n"
            f"  missing:   {describe(wanted - found)}\n"
            f"  unwanted:  {describe(found - wanted)}{result}"
        )

    # Running a declared scenario

    def run_scenario(self, scenario: dict):
        for name, content in scenario.get("seed", {}).items():
            self.write(self.expand(name), self.expand(content))

        before = self.snapshot()
        args = [self.expand(a) for a in scenario["args"]]

        result = None
        for _ in range(scenario.get("repeat", 1)):
            result = self.run_cmd(*args)
            if scenario.get("exit", "ok") == "ok":
                self.assertOk(result)
            else:
                self.assertFails(result)

        for artifact in scenario.get("resolves", []):
            self.assertResolved(result, artifact)
        for artifact in scenario.get("notFound", []):
            self.assertNotResolved(result, artifact)

        for directory, artifacts in scenario.get("expect", {}).items():
            self.assertDirectoryHolds(result, directory, artifacts)

        if scenario.get("unchanged"):
            after = self.snapshot()
            if after != before:
                added = sorted(set(after) - set(before))
                removed = sorted(set(before) - set(after))
                self.fail(
                    f"the sandbox should have been left alone\n"
                    f"  written: {added}\n"
                    f"  gone:    {removed}{result}"
                )


# ---------------------------------------------------------------------------
# One test per declared scenario
# ---------------------------------------------------------------------------


class TestDeclaredScenarios(DeployTestCase):
    """Generated from deploy_scenarios.json. Change the expectations there."""

    needs_resolution = True


def _install_scenarios():
    declaration = fixtures_layout.load_declaration()
    for scenario in declaration["scenarios"]:
        slug = re.sub(r"[^a-z0-9]+", "_", scenario["name"].lower()).strip("_")

        def method(self, scenario=scenario):
            self.run_scenario(scenario)

        method.__name__ = f"test_{slug}"
        method.__doc__ = scenario.get("why")
        setattr(TestDeclaredScenarios, method.__name__, method)


_install_scenarios()


# ---------------------------------------------------------------------------
# The command line, which means the same everywhere
# ---------------------------------------------------------------------------


class TestDeployCommandLine(DeployTestCase):
    def test_nothing_on_the_line_shows_the_help(self):
        r = self.run_cmd("deploy")
        self.assertOk(r)
        self.assertOut(r, "deploy")

    def test_an_option_without_a_file_is_refused(self):
        self.assertRefused(self.run_cmd("deploy", "-d"))

    def test_an_unknown_option_is_refused(self):
        self.assertRefused(
            self.run_cmd("deploy", self.layout.path("app_exe"), "--nosuchoption")
        )

    def test_a_file_that_is_not_a_binary_is_refused(self):
        self.write("notabinary.txt", "not a binary at all")
        self.assertRefused(self.run_cmd("deploy", "notabinary.txt", "-d"))

    def test_a_copy_source_that_is_not_a_binary_is_refused(self):
        self.write("notabinary.txt", "not a binary at all")
        self.assertRefused(
            self.run_cmd("deploy", self.layout.path("app_exe"), "-c", "notabinary.txt", "out", "-d")
        )

    def test_a_search_path_may_be_joined_to_its_option(self):
        """-L takes a single-character short match, as a linker's -L does."""
        joined = self.run_cmd(
            "deploy", self.layout.path("app_exe"),
            f"-L{self.layout.directory('sdk_bin')}",
            "-d", "-V",
        )
        separate = self.run_cmd(
            "deploy", self.layout.path("app_exe"), *self.search_paths(), "-d", "-V"
        )
        self.assertOk(joined)
        self.assertEqual(joined.out, separate.out)

    def test_a_dry_run_reports_without_being_asked_to(self):
        """There is nothing else for a dry run to do, so it implies --verbose."""
        r = self.run_cmd("deploy", self.layout.path("app_exe"), "-d")
        self.assertOk(r)
        self.assertOut(r, "Resolve:")

    def test_several_binaries_may_be_named_at_once(self):
        r = self.run_cmd(
            "deploy", *self.program(), *self.search_paths(), "-d", "-V"
        )
        self.assertOk(r)
        self.assertOut(r, "Resolve:")


# ---------------------------------------------------------------------------
# The cases that have to rearrange the sandbox first
# ---------------------------------------------------------------------------


class TestResolutionDetails(DeployTestCase):
    needs_resolution = True

    def test_each_library_is_resolved_in_turn(self):
        """Every dependency found is then resolved itself, so the report has a
        line of its own for the application and for each library behind it.

        With --standard, so that the count is the fixtures and nothing the
        platform happens to have resolved alongside them.
        """
        r = self.run_cmd(
            "deploy", self.layout.path("app_exe"), *self.search_paths(), "-s", "-d", "-V"
        )
        self.assertOk(r)
        resolved = [line for line in r.out.splitlines() if line.startswith("Resolve:")]
        # app, core, util, audio, render
        self.assertEqual(len(resolved), 5, msg=str(r))

    def test_a_library_beside_the_binary_needs_no_search_path(self):
        """The directory a named binary sits in is searched without being asked,
        which is why the program's own libraries need no -L."""
        r = self.run_cmd("deploy", self.layout.path("app_exe"), "-d", "-V")
        self.assertOk(r)
        self.assertResolved(r, "app_lib")

    def test_force_overwrites_what_is_already_there(self):
        """What was in the way is gone, and a binary of the same kind is there.

        Not compared with the library it came from. A Unix deployment rewrites
        the copy's rpath so that it can find its new neighbours, so the two are
        no longer the same file by the time anyone could look. What survives
        that is the format, which the first bytes name.
        """
        stale = self.path(f"out/{self.layout.name('sdk_lib')}")
        stale.parent.mkdir(parents=True, exist_ok=True)
        stale.write_bytes(b"stale")
        r = self.run_cmd(
            "deploy", self.layout.path("app_exe"), *self.search_paths(), "-o", "out", "-f", "-s"
        )
        self.assertOk(r)
        written = stale.read_bytes()
        self.assertNotEqual(written, b"stale")
        self.assertEqual(
            written[:4], self.path(self.layout.path("sdk_lib")).read_bytes()[:4]
        )

    def test_verbose_names_what_it_copied(self):
        r = self.run_cmd(
            "deploy", self.layout.path("app_exe"), *self.search_paths(), "-o", "out", "-s", "-V"
        )
        self.assertOk(r)
        self.assertOut(r, "Copy: from")
        self.assertOut(r, self.layout.name("sdk_lib"))

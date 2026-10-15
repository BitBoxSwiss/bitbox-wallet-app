"""Deploying on a platform where a binary carries its own search path.

None of this exists on Windows, which is why it is a module of its own rather
than a few skips inside ``test_deploy``.

The portable tests in ``test_deploy`` pass ``-L`` for the framework, because
Windows has nothing else to go on. Unix does: the fixtures are built with an
rpath that reaches the framework relatively, which is the shape a package
manager leaves behind, and the resolver is meant to follow it with no help from
the command line at all. That half is what these tests are for.

The other half is what a Unix deployment does afterwards. A copy is no use
where it lands unless it can find its own dependencies, so every binary that
was named, and every plugin that was copied, has its rpath rewritten to point
at where the libraries went. Nothing on Windows does any of this.

Nothing here runs on Windows, and nothing runs without the tool that edits an
rpath, so the whole module skips itself where it does not apply.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from test_deploy import DeployTestCase

#: Names a deployment is meant to leave behind when --standard is asked for.
#: Taken from what the tool itself filters, so that a test says what the tool
#: says rather than what this file guesses.
RUNTIME_PREFIXES = (
    "libc++",
    "libc.so",
    "libc-",
    "libdl.so",
    "libdl-",
    "libgcc",
    "libglib",
    "libgthread",
    "libicu",
    "libm.so",
    "libm-",
    "libpthread",
    "libstdc++",
    "libsystem",
)


def rpath_problem() -> str:
    """Empty when this platform has an rpath and the tool to edit one."""
    if sys.platform == "darwin":
        if not shutil.which("install_name_tool"):
            return "install_name_tool is not on the path"
        if not shutil.which("otool"):
            return "otool is not on the path"
        return ""
    if sys.platform.startswith("linux"):
        if not shutil.which("patchelf"):
            return "patchelf is not on the path"
        return ""
    return f"{sys.platform} binaries do not carry a search path"


def _run(argv: list[str]) -> str:
    completed = subprocess.run(
        argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60
    )
    out = completed.stdout.decode("utf-8", errors="replace")
    if completed.returncode != 0:
        raise RuntimeError(f"{' '.join(argv)} failed:\n{out}")
    return out


def read_rpath(binary: Path) -> str:
    """Whatever the binary now says about where to look, as one string."""
    if sys.platform == "darwin":
        listing = _run(["otool", "-l", str(binary)])
        found = []
        lines = listing.splitlines()
        for index, line in enumerate(lines):
            if "LC_RPATH" not in line:
                continue
            for following in lines[index : index + 6]:
                if "path " in following:
                    found.append(following.split("path ", 1)[1].split(" (offset")[0])
                    break
        return ":".join(found)
    return _run(["patchelf", "--print-rpath", str(binary)]).strip()


class RpathTestCase(DeployTestCase):
    needs_resolution = True

    def setUp(self):
        super().setUp()
        problem = rpath_problem()
        if problem:
            self.skipTest(problem)

    def is_runtime(self, name: str) -> bool:
        lowered = name.lower()
        return any(lowered.startswith(p) for p in RUNTIME_PREFIXES)

    def deploy_everything(self, *extra: str):
        """The whole job, the way the declared scenarios run it."""
        return self.run_cmd(
            "deploy", *self.program(),
            "-c", self.layout.path("sdk_plugin"), self.layout.directory("app_sdk_plugins"),
            "-c", self.layout.path("sdk_plugin_alone"), self.layout.directory("app_sdk_plugins"),
            "-o", self.layout.directory("app_bin"),
            *extra,
        )


class TestResolutionThroughAnRpath(RpathTestCase):
    """No -L anywhere. The rpath the fixtures were built with is the only thing
    saying where the framework is."""

    def test_the_framework_is_found_without_a_search_path(self):
        r = self.run_cmd(
            "deploy", *self.program(), "-o", self.layout.directory("app_bin"), "-s", "-V"
        )
        self.assertOk(r)
        for artifact in ("sdk_lib", "sdk_leaf"):
            self.assertResolved(r, artifact)

    def test_it_is_copied_out_of_the_framework(self):
        r = self.run_cmd(
            "deploy", *self.program(), "-o", self.layout.directory("app_bin"), "-s"
        )
        self.assertOk(r)
        landed = self.files_in(self.layout.directory("app_bin"))
        for artifact in ("sdk_lib", "sdk_leaf"):
            self.assertIn(self.layout.name(artifact), landed)

    def test_the_framework_is_left_as_it_was(self):
        self.assertOk(
            self.run_cmd(
                "deploy", *self.program(), "-o", self.layout.directory("app_bin"), "-s"
            )
        )
        for artifact in ("sdk_lib", "sdk_leaf", "sdk_alone"):
            self.assertFile(self.layout.path(artifact))

    def test_what_only_a_plugin_wants_stays_behind_until_it_is_named(self):
        self.assertOk(
            self.run_cmd(
                "deploy", *self.program(), "-o", self.layout.directory("app_bin"), "-s"
            )
        )
        self.assertNotIn(
            self.layout.name("sdk_alone"), self.files_in(self.layout.directory("app_bin"))
        )

    def test_naming_the_plugin_brings_it(self):
        self.assertOk(self.deploy_everything("-s"))
        self.assertIn(
            self.layout.name("sdk_alone"), self.files_in(self.layout.directory("app_bin"))
        )


class TestRpathsAreRewritten(RpathTestCase):
    """A copy is no use where it lands unless it can find its own dependencies."""

    def test_a_deployed_library_is_pointed_at_its_new_neighbours(self):
        self.assertOk(self.deploy_everything("-s"))
        copied = self.path(self.layout.directory("app_bin")) / self.layout.name("sdk_lib")
        self.assertTrue(copied.is_file(), msg=f"tree: {self.tree()}")
        expected = "@loader_path" if sys.platform == "darwin" else "$ORIGIN"
        self.assertIn(expected, read_rpath(copied))

    def test_a_copied_plugin_is_pointed_back_at_the_libraries(self):
        """The plugins went to a directory of their own, so theirs has to reach
        across to where the libraries were gathered."""
        self.assertOk(self.deploy_everything("-s"))
        copied = (
            self.path(self.layout.directory("app_sdk_plugins"))
            / self.layout.name("sdk_plugin_alone")
        )
        self.assertTrue(copied.is_file(), msg=f"tree: {self.tree()}")
        rpath = read_rpath(copied)
        expected = "@loader_path" if sys.platform == "darwin" else "$ORIGIN"
        self.assertIn(expected, rpath)
        self.assertIn("bin", rpath)

    def test_the_framework_is_no_longer_named_by_the_copies(self):
        """Otherwise the deployment still depends on the machine it was built on."""
        self.assertOk(self.deploy_everything("-s"))
        framework = str(self.path(self.layout.directory("sdk_bin")))
        for name in self.files_in(self.layout.directory("app_bin")):
            copied = self.path(self.layout.directory("app_bin")) / name
            self.assertNotIn(framework, read_rpath(copied))

    def test_a_binary_that_was_named_is_pointed_at_the_output(self):
        self.assertOk(self.deploy_everything("-s"))
        rpath = read_rpath(self.path(self.layout.path("app_plugin")))
        expected = "@loader_path" if sys.platform == "darwin" else "$ORIGIN"
        self.assertIn(expected, rpath)
        self.assertIn("bin", rpath)


class TestSystemLibraries(RpathTestCase):
    """What comes along from outside the trees, and what --standard leaves."""

    def deployed_runtime(self, *extra: str) -> set[str]:
        self.assertOk(
            self.run_cmd(
                "deploy", *self.program(), "-o", self.layout.directory("app_bin"), *extra
            )
        )
        return {
            name
            for name in self.files_in(self.layout.directory("app_bin"))
            if self.is_runtime(name)
        }

    def test_standard_leaves_the_c_runtime_behind(self):
        self.assertEqual(
            self.deployed_runtime("-s"),
            set(),
            msg="--standard should have left every one of these on the system",
        )

    def test_without_standard_the_c_runtime_comes_along(self):
        """Unlike Windows, where system libraries are always left behind, here
        nothing is filtered until --standard says so."""
        plain = self.deployed_runtime()
        if not plain:
            self.skipTest("the fixtures pulled in no runtime library to judge by")
        self.assertTrue(plain)

    def test_standard_deploys_a_subset_of_what_it_would_otherwise(self):
        plain = self.deployed_runtime()
        everything = self.files_in(self.layout.directory("app_bin"))

        # Deploying rewrites the rpath of every binary it was pointed at, so the
        # program no longer names the framework and asking again would resolve
        # nothing. A fresh sandbox is the honest way to ask twice.
        self.setUp()

        self.assertOk(
            self.run_cmd(
                "deploy", *self.program(), "-o", self.layout.directory("app_bin"), "-s"
            )
        )
        standard = self.files_in(self.layout.directory("app_bin"))

        self.assertTrue(
            standard <= everything, msg=f"{sorted(standard - everything)} appeared"
        )
        self.assertFalse(plain & standard)
        for artifact in ("sdk_lib", "sdk_leaf"):
            self.assertIn(self.layout.name(artifact), standard)

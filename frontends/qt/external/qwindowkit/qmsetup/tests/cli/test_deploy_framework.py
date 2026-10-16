"""Deploying a macOS framework, which is a bundle rather than a file.

Everything else here deploys files. A framework is a directory, with the library
inside it under ``Versions/A``, a symlink at the top naming it, and an
``Info.plist`` beside it in ``Resources``. What a binary carries is not the name
of a library but a path into the bundle, so a deployment has to copy the bundle,
decide what inside it is worth carrying, and rewrite install names that name a
bundle rather than a file.

None of that is reached by any other test in this directory, and none of it
exists off macOS, so this module skips itself everywhere else.

The fixture is its own tree, away from the graph the rest of the deploy tests
are built on. Nothing links it but the one application beside it.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from testing.harness import QmTestCase


def framework_problem() -> str:
    """Empty when this platform has frameworks and the fixture was built."""
    if sys.platform != "darwin":
        return f"{sys.platform} has no such thing as a framework"
    if not shutil.which("install_name_tool"):
        return "install_name_tool is not on the path"
    if not shutil.which("otool"):
        return "otool is not on the path"
    if not os.environ.get("QMTEST_FRAMEWORKS"):
        return "the framework fixture was not built"
    return ""


def install_names(binary: Path) -> list[str]:
    """What the binary says it needs, as written in it."""
    completed = subprocess.run(
        ["otool", "-L", str(binary)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60
    )
    out = completed.stdout.decode("utf-8", errors="replace")
    # The first line is the file itself, and every other one begins with a tab.
    return [line.split("(")[0].strip() for line in out.splitlines()[1:] if line.startswith("\t")]


def rpaths(binary: Path) -> list[str]:
    completed = subprocess.run(
        ["otool", "-l", str(binary)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60
    )
    lines = completed.stdout.decode("utf-8", errors="replace").splitlines()
    found = []
    for index, line in enumerate(lines):
        if "LC_RPATH" not in line:
            continue
        for following in lines[index : index + 6]:
            if "path " in following:
                found.append(following.split("path ", 1)[1].split(" (offset")[0])
                break
    return found


class FrameworkTestCase(QmTestCase):
    """Gives each test the framework tree, copied whole so that the bundle keeps
    the symlinks that make it one."""

    LIB = "qmtest_fw_lib"
    DEEP = "qmtest_fw_deep"
    PLAIN = "qmtest_fw_plain"
    ALONE = "qmtest_fw_alone"
    EXE = "qmtest_fw_exe"

    def setUp(self):
        super().setUp()
        problem = framework_problem()
        if problem:
            self.skipTest(problem)

        source = Path(os.environ["QMTEST_FRAMEWORKS"])
        if not source.is_dir():
            self.skipTest(f"QMTEST_FRAMEWORKS points at nothing: {source}")

        self.built = self.sandbox / "built"
        # symlinks=True, since a framework is held together by them and copying
        # it flat would be testing something else.
        shutil.copytree(source, self.built, symlinks=True)

        self.app = self.built / self.EXE
        self.bundle = self.built / f"{self.LIB}.framework"
        self.alone = self.built / f"{self.ALONE}.framework"
        if not self.app.is_file() or not self.bundle.is_dir() or not self.alone.is_dir():
            self.skipTest(f"the framework fixture is not in {source}")

    def deploy(self, *extra: str):
        return self.run_cmd("deploy", str(self.app), "-o", str(self.sandbox / "out"), *extra)

    @property
    def out(self) -> Path:
        return self.sandbox / "out"

    @property
    def deployed_bundle(self) -> Path:
        return self.out / f"{self.LIB}.framework"


class TestTheBundleIsCarriedAcross(FrameworkTestCase):
    def test_the_framework_is_deployed_as_a_directory(self):
        self.assertOk(self.deploy("-s"))
        self.assertTrue(
            self.deployed_bundle.is_dir(),
            msg=f"{self.deployed_bundle} is not a directory\ntree: {self.tree()}",
        )

    def test_the_library_inside_it_comes_too(self):
        self.assertOk(self.deploy("-s"))
        self.assertTrue(
            (self.deployed_bundle / "Versions" / "A" / self.LIB).is_file(),
            msg=f"tree: {self.tree()}",
        )

    def test_the_bundle_is_named_rather_than_the_library(self):
        """A file of the library's bare name beside the bundle would mean the
        deployment took it for an ordinary shared library."""
        self.assertOk(self.deploy("-s"))
        self.assertFalse(
            (self.out / self.LIB).exists(), msg=f"tree: {self.tree()}"
        )

    def test_what_it_was_built_from_is_left_as_it_was(self):
        self.assertOk(self.deploy("-s"))
        self.assertTrue(self.bundle.is_dir())
        self.assertTrue((self.bundle / "Versions" / "A" / self.LIB).is_file())


class TestWhatIsLeftBehind(FrameworkTestCase):
    """A framework carries more than a running program needs."""

    def test_the_headers_are_not_deployed(self):
        """Whatever links it was compiled long ago, so its headers are weight.

        A framework need not have any, so what the bundle came with is checked
        first. Without that this would pass just as readily on a bundle that
        never had a Headers directory to leave behind.
        """
        self.assertTrue(
            (self.bundle / "Versions" / "A" / "Headers").is_dir(),
            msg="the fixture came without headers, so there is nothing here to test",
        )

        self.assertOk(self.deploy("-s"))
        headers = self.deployed_bundle / "Versions" / "A" / "Headers"
        self.assertFalse(headers.exists(), msg=f"tree: {self.tree()}")


class TestNamesAreRewritten(FrameworkTestCase):
    """A copy is no use where it lands unless it can still be found."""

    def test_the_application_is_pointed_at_where_the_bundle_went(self):
        self.assertOk(self.deploy("-s"))
        self.assertIn("@loader_path", " ".join(rpaths(self.app)))

    def test_the_library_inside_the_copied_bundle_is_pointed_somewhere_too(self):
        """The bundle moved, so what is inside it moved. Whatever it needs of its
        own is no longer where it was, and its own rpath is what has to say so."""
        self.assertOk(self.deploy("-s"))
        library = self.deployed_bundle / "Versions" / "A" / self.LIB
        self.assertIn("@loader_path", " ".join(rpaths(library)), msg=f"tree: {self.tree()}")

    def test_the_library_inside_it_no_longer_names_where_it_was_built(self):
        self.assertOk(self.deploy("-s"))
        library = self.deployed_bundle / "Versions" / "A" / self.LIB
        built = str(self.built)
        for path in rpaths(library):
            self.assertNotIn(built, path)
        for name in install_names(library):
            self.assertNotIn(built, name)

    def test_the_application_still_names_the_framework_by_rpath(self):
        self.assertOk(self.deploy("-s"))
        named = " ".join(install_names(self.app))
        self.assertIn(f"{self.LIB}.framework", named)
        self.assertIn("@rpath", named)

    def test_nothing_names_the_directory_it_was_built_in(self):
        """Otherwise the deployment still depends on the machine it was built
        on."""
        self.assertOk(self.deploy("-s"))
        built = str(self.built)
        for name in install_names(self.app):
            self.assertNotIn(built, name)


class TestTheWalkGoesThroughABundle(FrameworkTestCase):
    """Three levels, with a bundle in the middle.

        fw_exe -> fw_lib.framework -> fw_deep.framework
                                   -> fw_plain

    Nothing reaches fw_deep or fw_plain without going into fw_lib for the
    library inside it, reading what that names, and coming back out to a bundle
    again. One level of framework asks for none of that, and one level is all
    there was.
    """

    def deployed(self, name: str) -> Path:
        return self.out / f"{name}.framework"

    def test_a_framework_behind_a_framework_is_reached(self):
        self.assertOk(self.deploy("-s"))
        self.assertTrue(self.deployed(self.DEEP).is_dir(), msg=f"tree: {self.tree()}")

    def test_and_the_library_inside_that_one_comes_too(self):
        self.assertOk(self.deploy("-s"))
        self.assertTrue(
            (self.deployed(self.DEEP) / "Versions" / "A" / self.DEEP).is_file(),
            msg=f"tree: {self.tree()}",
        )

    def test_an_ordinary_library_behind_a_framework_is_reached(self):
        """The walk leaves a bundle as well as entering one."""
        self.assertOk(self.deploy("-s"))
        self.assertTrue(
            (self.out / f"lib{self.PLAIN}.dylib").is_file(), msg=f"tree: {self.tree()}"
        )

    def test_every_one_of_them_is_resolved_in_turn(self):
        """Each thing found is then resolved itself, so there is a line for the
        application and one for each of the three behind it."""
        r = self.deploy("-s", "-d", "-V")
        self.assertOk(r)
        resolved = [line for line in r.out.splitlines() if line.startswith("Resolve:")]
        self.assertEqual(len(resolved), 4, msg=str(r))

    def test_the_one_in_the_middle_is_resolved_as_the_library_inside_it(self):
        """A bundle has nothing to read. What the walk opens is the library."""
        r = self.deploy("-s", "-d", "-V")
        self.assertOk(r)
        self.assertOut(r, f"{self.LIB}.framework/Versions/A/{self.LIB}")

    def test_excluding_the_middle_one_hides_what_is_behind_it(self):
        """It is never opened, so what only it asked for is never found."""
        self.assertOk(self.deploy("-s", "-e", self.LIB))
        self.assertFalse(self.deployed(self.LIB).exists(), msg=f"tree: {self.tree()}")
        self.assertFalse(self.deployed(self.DEEP).exists(), msg=f"tree: {self.tree()}")
        self.assertFalse((self.out / f"lib{self.PLAIN}.dylib").exists())

    def test_the_deeper_bundle_is_pointed_somewhere_of_its_own(self):
        self.assertOk(self.deploy("-s"))
        library = self.deployed(self.DEEP) / "Versions" / "A" / self.DEEP
        self.assertIn("@loader_path", " ".join(rpaths(library)), msg=f"tree: {self.tree()}")

    def test_the_middle_one_still_names_what_is_behind_it_by_rpath(self):
        self.assertOk(self.deploy("-s"))
        library = self.deployed_bundle / "Versions" / "A" / self.LIB
        named = " ".join(install_names(library))
        self.assertIn(f"{self.DEEP}.framework", named)
        self.assertIn("@rpath", named)
        self.assertNotIn(str(self.built), named)


class TestAFrameworkNothingLinks(FrameworkTestCase):
    """The reason -c exists, in framework form.

    A plugin is loaded by name at run time and a framework can be too, so no
    amount of following the dependency graph arrives at one. Naming it with -c
    is the only way it is ever deployed, and it goes through the deployment by a
    different path from the ones that were resolved.
    """

    def alone_dir(self) -> Path:
        return self.sandbox / "plugins"

    def deployed_alone(self) -> Path:
        return self.alone_dir() / f"{self.ALONE}.framework"

    def deploy_with_alone(self, *extra: str):
        return self.deploy("-c", str(self.alone), str(self.alone_dir()), *extra)

    def test_following_the_graph_never_reaches_it(self):
        self.assertOk(self.deploy("-s"))
        self.assertFalse(
            (self.out / f"{self.ALONE}.framework").exists(), msg=f"tree: {self.tree()}"
        )

    def test_naming_it_brings_the_bundle(self):
        self.assertOk(self.deploy_with_alone("-s"))
        self.assertTrue(self.deployed_alone().is_dir(), msg=f"tree: {self.tree()}")

    def test_it_goes_where_it_was_told_rather_than_to_the_output(self):
        self.assertOk(self.deploy_with_alone("-s"))
        self.assertFalse(
            (self.out / f"{self.ALONE}.framework").exists(), msg=f"tree: {self.tree()}"
        )

    def test_the_library_inside_it_comes_too(self):
        self.assertOk(self.deploy_with_alone("-s"))
        self.assertTrue(
            (self.deployed_alone() / "Versions" / "A" / self.ALONE).is_file(),
            msg=f"tree: {self.tree()}",
        )

    def test_its_headers_are_left_behind_as_well(self):
        self.assertTrue((self.alone / "Versions" / "A" / "Headers").is_dir())
        self.assertOk(self.deploy_with_alone("-s"))
        self.assertFalse(
            (self.deployed_alone() / "Versions" / "A" / "Headers").exists(),
            msg=f"tree: {self.tree()}",
        )

    def test_it_is_pointed_back_at_where_the_libraries_went(self):
        """It landed in a directory of its own, so its rpath has to reach across
        to the output directory rather than naming only itself."""
        self.assertOk(self.deploy_with_alone("-s"))
        library = self.deployed_alone() / "Versions" / "A" / self.ALONE
        self.assertIn("@loader_path", " ".join(rpaths(library)))

    def test_what_it_was_copied_from_is_left_as_it_was(self):
        self.assertOk(self.deploy_with_alone("-s"))
        self.assertTrue((self.alone / "Versions" / "A" / self.ALONE).is_file())


class TestTheGraphThroughAFramework(FrameworkTestCase):
    def test_a_dry_run_reports_the_framework_and_writes_nothing(self):
        r = self.deploy("-s", "-d")
        self.assertOk(r)
        self.assertOut(r, f"{self.LIB}.framework")
        self.assertFalse(self.out.exists(), msg=f"tree: {self.tree()}")

    def test_excluding_it_leaves_it_behind(self):
        self.assertOk(self.deploy("-s", "-e", self.LIB))
        self.assertFalse(self.deployed_bundle.exists(), msg=f"tree: {self.tree()}")

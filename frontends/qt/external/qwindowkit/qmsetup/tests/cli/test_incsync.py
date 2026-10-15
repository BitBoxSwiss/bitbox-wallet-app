"""`incsync` reorganises a source tree's headers into an include directory,
either by copying them or by leaving a one-line stub that includes the real one.
"""

import os
import shutil
import tempfile
from pathlib import Path

from testing.harness import QmTestCase


def directory_on_another_drive(besides: Path):
    """A temporary directory on some drive other than the one ``besides`` is on.

    Answers None where there is no second drive to write to. Windows only,
    since everywhere else there is one root and so no such thing as two paths
    with nothing in common.
    """
    if os.name != "nt":
        return None

    here = besides.drive.upper()
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        if f"{letter}:" == here or not os.path.isdir(f"{letter}:\\"):
            continue
        try:
            return Path(tempfile.mkdtemp(prefix="qmcorecmd-test-", dir=f"{letter}:\\"))
        except OSError:
            continue  # Not writable, which is ordinary for a disc or a share
    return None


class IncsyncTestCase(QmTestCase):
    """Every case here starts from the same small source tree."""

    def setUp(self):
        super().setUp()
        self.write("src/foo.h", "// foo")
        self.write("src/foo.cpp", "// not a header")
        self.write("src/bar.hpp", "// bar")
        self.write("src/sub/baz.h", "// baz")
        self.write("src/sub/qux_p.h", "// private qux")
        self.write("src/readme.txt", "// not a header either")


class TestWhatItPicksUp(IncsyncTestCase):
    def test_headers_are_collected_and_other_files_left_behind(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/foo.h")
        self.assertFile("include/bar.hpp")
        self.assertNoFile("include/foo.cpp")
        self.assertNoFile("include/readme.txt")

    def test_the_tree_is_flattened(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/baz.h")
        self.assertNoDir("include/sub")

    def test_the_other_header_extensions_are_picked_up_too(self):
        self.write("src/one.hh", "// hh")
        self.write("src/two.hxx", "// hxx")
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/one.hh")
        self.assertFile("include/two.hxx")

    def test_the_extension_check_ignores_case(self):
        self.write("src/upper.H", "// upper")
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/upper.H")


class TestStubsAndCopies(IncsyncTestCase):
    def test_by_default_a_stub_pointing_at_the_real_header_is_left(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        stub = self.read("include/foo.h")
        self.assertIn("#include", stub)
        self.assertIn("foo.h", stub)
        self.assertNotIn("// foo", stub)

    def test_the_stub_points_back_with_forward_slashes(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertNotIn("\\", self.read("include/foo.h"))

    def test_the_stub_is_a_relative_reference(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertIn("..", self.read("include/foo.h"))

    def test_copy_copies_the_header_instead_of_pointing_at_it(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-c"))
        self.assertFileContains("include/foo.h", "// foo")
        self.assertFileLacks("include/foo.h", "#include")


class TestClassifying(IncsyncTestCase):
    def test_include_puts_what_matches_into_a_subdirectory(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-i", "sub/", "nested"))
        self.assertFile("include/nested/baz.h")
        self.assertFile("include/foo.h")

    def test_include_may_be_given_more_than_once(self):
        self.write("src/other/thing.h", "// thing")
        self.assertOk(
            self.run_cmd(
                "incsync", "src", "include",
                "-i", "sub/", "nested",
                "-i", "other/", "elsewhere",
            )
        )
        self.assertFile("include/nested/baz.h")
        self.assertFile("include/elsewhere/thing.h")

    def test_standard_sends_the_private_headers_to_private(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-s"))
        self.assertFile("include/private/qux_p.h")
        self.assertFile("include/foo.h")

    def test_not_all_drops_whatever_no_pattern_claimed(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-s", "-n"))
        self.assertFile("include/private/qux_p.h")
        self.assertNoFile("include/foo.h")
        self.assertNoFile("include/bar.hpp")


class TestExcluding(IncsyncTestCase):
    def test_exclude_keeps_a_header_out(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-e", "bar"))
        self.assertFile("include/foo.h")
        self.assertNoFile("include/bar.hpp")

    def test_exclude_keeps_a_whole_subdirectory_out(self):
        self.assertOk(self.run_cmd("incsync", "src", "include", "-e", "/sub/"))
        self.assertFile("include/foo.h")
        self.assertNoFile("include/baz.h")


class TestAcrossDrives(IncsyncTestCase):
    """A source tree on one drive and an include directory on another.

    Only Windows has two paths with no root in common. Asked for a relative path
    between them, the standard library answers an empty one rather than treating
    it as an error, so nothing was there to be caught and the stub was written
    out as an include of nothing at all.

    Reported as https://github.com/stdware/qmsetup/issues/16.
    """

    def setUp(self):
        super().setUp()
        if os.name != "nt":
            self.skipTest("only Windows has paths with no root in common")

        self.elsewhere = directory_on_another_drive(self.sandbox)
        if self.elsewhere is None:
            self.skipTest("no second drive here to sync to")
        self.addCleanup(shutil.rmtree, self.elsewhere, ignore_errors=True)

        self.include = self.elsewhere / "include"

    def stub(self, name: str) -> str:
        return (self.include / name).read_text(encoding="utf-8")

    def test_the_headers_still_arrive(self):
        self.assertOk(self.run_cmd("incsync", "src", str(self.include)))
        self.assertTrue((self.include / "foo.h").is_file())

    def test_the_stub_includes_something(self):
        self.assertOk(self.run_cmd("incsync", "src", str(self.include)))
        self.assertNotIn('#include ""', self.stub("foo.h"))

    def test_and_what_it_includes_is_the_header(self):
        self.assertOk(self.run_cmd("incsync", "src", str(self.include)))
        self.assertIn("foo.h", self.stub("foo.h"))

    def test_it_falls_back_to_the_whole_path(self):
        """There is no relative form, so the absolute one is what is left."""
        self.assertOk(self.run_cmd("incsync", "src", str(self.include)))
        self.assertIn(self.sandbox.drive.lower(), self.stub("foo.h").lower())

    def test_which_is_still_written_with_forward_slashes(self):
        self.assertOk(self.run_cmd("incsync", "src", str(self.include)))
        self.assertNotIn("\\", self.stub("foo.h"))

    def test_copying_across_drives_was_never_the_broken_one(self):
        """Only the stub goes through a relative path, so this held throughout
        and is here to say which half of the command the fault was in."""
        self.assertOk(self.run_cmd("incsync", "src", str(self.include), "-c"))
        self.assertIn("// foo", self.stub("foo.h"))


class TestDryRunForceAndVerbosity(IncsyncTestCase):
    def test_dryrun_writes_nothing(self):
        r = self.run_cmd("incsync", "src", "include", "-d")
        self.assertOk(r)
        self.assertOut(r, "Sync: from")
        self.assertNoDir("include")

    def test_verbose_says_what_it_synced(self):
        r = self.run_cmd("incsync", "src", "include", "-V")
        self.assertOk(r)
        self.assertOut(r, "Sync: from")
        self.assertFile("include/foo.h")

    def test_without_verbose_it_says_nothing(self):
        r = self.run_cmd("incsync", "src", "include")
        self.assertOk(r)
        self.assertEqual(r.out, "")

    def test_force_clears_the_destination_first(self):
        self.write("include/stale.h", "// left over from before")
        self.assertOk(self.run_cmd("incsync", "src", "include", "-f"))
        self.assertFile("include/foo.h")
        self.assertNoFile("include/stale.h")

    def test_without_force_what_was_already_there_stays(self):
        self.write("include/stale.h", "// left over from before")
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/foo.h")
        self.assertFile("include/stale.h")

    def test_running_it_twice_is_not_an_error(self):
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertOk(self.run_cmd("incsync", "src", "include"))
        self.assertFile("include/foo.h")

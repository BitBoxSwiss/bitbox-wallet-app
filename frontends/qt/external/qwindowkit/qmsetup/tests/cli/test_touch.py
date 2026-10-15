"""`touch` updates a file's timestamps, optionally from a reference file."""

import time

from testing.harness import QmTestCase


class TestTouch(QmTestCase):
    def test_an_existing_file_is_touched(self):
        self.write("a.txt", "content")
        self.assertOk(self.run_cmd("touch", "a.txt"))
        self.assertFileContains("a.txt", "content")

    def test_touching_moves_the_modification_time_forward(self):
        self.write("a.txt", "a")
        old = self.path("a.txt").stat().st_mtime
        time.sleep(1.1)  # the tool stores whole seconds
        self.assertOk(self.run_cmd("touch", "a.txt"))
        self.assertGreater(self.path("a.txt").stat().st_mtime, old)

    def test_a_reference_file_gives_its_own_time(self):
        self.write("ref.txt", "ref")
        time.sleep(1.1)
        self.write("a.txt", "a")
        self.assertGreater(
            self.path("a.txt").stat().st_mtime, self.path("ref.txt").stat().st_mtime
        )
        self.assertOk(self.run_cmd("touch", "a.txt", "ref.txt"))
        self.assertAlmostEqual(
            self.path("a.txt").stat().st_mtime,
            self.path("ref.txt").stat().st_mtime,
            delta=1.0,
        )

    def test_the_reference_argument_is_optional(self):
        self.write("a.txt", "a")
        self.assertOk(self.run_cmd("touch", "a.txt"))

    def test_touching_does_not_change_the_content(self):
        self.write("a.txt", "the exact content")
        self.assertOk(self.run_cmd("touch", "a.txt"))
        self.assertEqual(self.read("a.txt"), "the exact content")

    def test_verbose_reports_the_three_times_it_set(self):
        self.write("a.txt", "a")
        r = self.run_cmd("touch", "a.txt", "-V")
        self.assertOk(r)
        self.assertOut(r, "Set A-Time:")
        self.assertOut(r, "Set M-Time:")
        self.assertOut(r, "Set C-Time:")
        self.assertRegex(r.out, r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")

    def test_without_verbose_it_says_nothing(self):
        self.write("a.txt", "a")
        r = self.run_cmd("touch", "a.txt")
        self.assertOk(r)
        self.assertEqual(r.out, "")

    def test_a_file_that_is_not_there_is_refused(self):
        r = self.run_cmd("touch", "no_such_file.txt")
        self.assertFails(r)
        self.assertOut(r, "not a regular file")

    def test_a_directory_is_not_a_file_to_touch(self):
        self.mkdir("adir")
        r = self.run_cmd("touch", "adir")
        self.assertFails(r)
        self.assertOut(r, "not a regular file")

    def test_a_reference_that_is_not_there_is_refused(self):
        self.write("a.txt", "a")
        r = self.run_cmd("touch", "a.txt", "no_such_reference.txt")
        self.assertFails(r)
        self.assertOut(r, "not a regular file")

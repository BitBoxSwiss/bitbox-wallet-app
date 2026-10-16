"""`copy` copies files and directories, skipping what has not changed."""

from testing.harness import QmTestCase


class TestFiles(QmTestCase):
    def test_a_file_lands_in_the_destination_directory(self):
        self.write("src/a.txt", "content of a")
        r = self.run_cmd("copy", "src/a.txt", "dest")
        self.assertOk(r)
        self.assertFileContains("dest/a.txt", "content of a")

    def test_the_destination_directory_is_made_when_it_is_not_there(self):
        self.write("src/a.txt", "a")
        self.assertOk(self.run_cmd("copy", "src/a.txt", "deep/nested/dest"))
        self.assertFile("deep/nested/dest/a.txt")

    def test_several_sources_all_land_in_the_one_destination(self):
        for name in ("a", "b", "c"):
            self.write(f"src/{name}.txt", name)
        self.assertOk(self.run_cmd("copy", "src/a.txt", "src/b.txt", "src/c.txt", "dest"))
        self.assertEqual(
            [p for p in self.tree() if p.startswith("dest/")],
            ["dest/a.txt", "dest/b.txt", "dest/c.txt"],
        )


class TestDirectories(QmTestCase):
    def setUp(self):
        super().setUp()
        self.write("src/one.txt", "1")
        self.write("src/sub/two.txt", "2")

    def test_a_directory_is_copied_under_the_destination_by_its_own_name(self):
        self.assertOk(self.run_cmd("copy", "src", "dest"))
        self.assertFile("dest/src/one.txt")
        self.assertFile("dest/src/sub/two.txt")

    def test_a_trailing_slash_copies_the_contents_rather_than_the_directory(self):
        self.assertOk(self.run_cmd("copy", "src/", "dest"))
        self.assertFile("dest/one.txt")
        self.assertFile("dest/sub/two.txt")
        self.assertNoDir("dest/src")

    def test_nesting_is_kept_however_deep_it_goes(self):
        self.write("src/a/b/c/d.txt", "deep")
        self.assertOk(self.run_cmd("copy", "src/", "dest"))
        self.assertFileContains("dest/a/b/c/d.txt", "deep")


class TestExcluding(QmTestCase):
    def setUp(self):
        super().setUp()
        self.write("src/keep.txt", "keep")
        self.write("src/skip.log", "skip")
        self.write("src/skip.tmp", "skip")

    def test_exclude_keeps_a_matching_path_out(self):
        self.assertOk(self.run_cmd("copy", "src/", "dest", "-e", r"\.log$"))
        self.assertFile("dest/keep.txt")
        self.assertNoFile("dest/skip.log")
        self.assertFile("dest/skip.tmp")

    def test_exclude_may_be_given_more_than_once(self):
        self.assertOk(
            self.run_cmd("copy", "src/", "dest", "-e", r"\.log$", "-e", r"\.tmp$")
        )
        self.assertFile("dest/keep.txt")
        self.assertNoFile("dest/skip.log")
        self.assertNoFile("dest/skip.tmp")

    def test_exclude_keeps_a_whole_subdirectory_out(self):
        self.write("src/build/b.txt", "b")
        self.assertOk(self.run_cmd("copy", "src/", "dest", "-e", "/build"))
        self.assertFile("dest/keep.txt")
        self.assertNoDir("dest/build")

    def test_the_long_spelling_means_the_same(self):
        self.assertOk(self.run_cmd("copy", "src/", "dest", "--exclude", r"\.log$"))
        self.assertNoFile("dest/skip.log")


class TestOverwriting(QmTestCase):
    def test_copying_the_same_tree_twice_is_not_an_error(self):
        self.write("src/a.txt", "a")
        self.assertOk(self.run_cmd("copy", "src/", "dest"))
        self.assertOk(self.run_cmd("copy", "src/", "dest"))
        self.assertFile("dest/a.txt")

    def test_force_overwrites_whatever_is_there(self):
        self.write("src/a.txt", "new content")
        self.write("dest/a.txt", "old content")
        self.assertOk(self.run_cmd("copy", "src/", "dest", "-f"))
        self.assertFileContains("dest/a.txt", "new content")


class TestVerbosity(QmTestCase):
    def test_verbose_says_what_it_copied(self):
        self.write("src/a.txt", "a")
        r = self.run_cmd("copy", "src/a.txt", "dest", "-V")
        self.assertOk(r)
        self.assertOut(r, "Copy: from")
        self.assertOut(r, "a.txt")

    def test_without_verbose_it_says_nothing(self):
        self.write("src/a.txt", "a")
        r = self.run_cmd("copy", "src/a.txt", "dest")
        self.assertOk(r)
        self.assertEqual(r.out, "")

    def test_the_long_spelling_means_the_same(self):
        self.write("src/a.txt", "a")
        r = self.run_cmd("copy", "src/a.txt", "dest", "--verbose")
        self.assertOk(r)
        self.assertOut(r, "Copy: from")


class TestOptionPlacement(QmTestCase):
    """An option is an option wherever it appears among the arguments."""

    def test_an_option_in_front_of_the_arguments(self):
        self.write("src/a.txt", "a")
        self.assertOk(self.run_cmd("copy", "-f", "src/a.txt", "dest"))
        self.assertFile("dest/a.txt")

    def test_an_option_in_the_middle_of_them(self):
        self.write("src/a.txt", "a")
        self.write("src/b.txt", "b")
        self.assertOk(self.run_cmd("copy", "src/a.txt", "-f", "src/b.txt", "dest"))
        self.assertFile("dest/a.txt")
        self.assertFile("dest/b.txt")

    def test_an_option_after_them(self):
        self.write("src/a.txt", "a")
        self.assertOk(self.run_cmd("copy", "src/a.txt", "dest", "-f"))
        self.assertFile("dest/a.txt")


class TestRefusals(QmTestCase):
    """What it will not do, rather than what it does.

    A destination inside a source and an argument that is empty both reach the
    walk as an ordinary path and are only wrong once it is under way, so they
    are turned down before it starts.
    """

    def test_a_destination_inside_a_source_is_refused(self):
        self.write("d/x/a.txt", "a")
        self.assertRefused(self.run_cmd("copy", "d", "d/sub"))
        self.assertNoDir("d/sub")

    def test_and_so_is_a_source_copied_over_its_own_contents(self):
        self.write("d/x/a.txt", "a")
        self.assertRefused(self.run_cmd("copy", "d/", "d"))

    def test_a_destination_whose_name_merely_starts_the_same_is_not(self):
        self.write("d/x/a.txt", "a")
        self.assertOk(self.run_cmd("copy", "d", "d-elsewhere"))
        self.assertFile("d-elsewhere/d/x/a.txt")

    def test_an_empty_source_is_refused(self):
        self.mkdir("dest")
        self.assertRefused(self.run_cmd("copy", "", "dest"))

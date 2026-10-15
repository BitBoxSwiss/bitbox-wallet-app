"""`rmdir` removes empty directories, recursively, and keeps the rest."""

from testing.harness import QmTestCase


class TestRmdir(QmTestCase):
    def test_an_empty_directory_is_removed(self):
        self.mkdir("empty")
        self.assertOk(self.run_cmd("rmdir", "empty"))
        self.assertNoDir("empty")

    def test_a_directory_holding_a_file_is_kept(self):
        self.write("full/a.txt", "a")
        self.assertOk(self.run_cmd("rmdir", "full"))
        self.assertFile("full/a.txt")

    def test_empty_directories_are_removed_however_deep_they_go(self):
        self.mkdir("tree/a/b/c")
        self.assertOk(self.run_cmd("rmdir", "tree"))
        self.assertNoDir("tree")

    def test_a_branch_is_kept_as_far_up_as_the_file_in_it(self):
        self.mkdir("tree/empty/deeper")
        self.write("tree/kept/a.txt", "a")
        self.assertOk(self.run_cmd("rmdir", "tree"))
        self.assertDir("tree/kept")
        self.assertFile("tree/kept/a.txt")
        self.assertNoDir("tree/empty")

    def test_several_directories_may_be_given_at_once(self):
        for name in ("one", "two", "three"):
            self.mkdir(name)
        self.assertOk(self.run_cmd("rmdir", "one", "two", "three"))
        for name in ("one", "two", "three"):
            self.assertNoDir(name)

    def test_something_that_is_not_a_directory_is_passed_over(self):
        self.write("a.txt", "a")
        self.mkdir("empty")
        self.assertOk(self.run_cmd("rmdir", "a.txt", "empty"))
        self.assertFile("a.txt")
        self.assertNoDir("empty")

    def test_a_directory_that_is_not_there_is_passed_over(self):
        self.assertOk(self.run_cmd("rmdir", "no_such_directory"))

    def test_verbose_says_what_it_removed(self):
        self.mkdir("empty")
        r = self.run_cmd("rmdir", "empty", "-V")
        self.assertOk(r)
        self.assertOut(r, "Remove:")

    def test_without_verbose_it_says_nothing(self):
        self.mkdir("empty")
        r = self.run_cmd("rmdir", "empty")
        self.assertOk(r)
        self.assertEqual(r.out, "")

    def test_a_link_is_not_walked_into(self):
        """A link counts as one of the things that is not a directory.

        Walking into one would empty out directories the command was never
        given, wherever the link happens to point.
        """
        outside = self.mkdir("outside/keepme/emptysub")
        self.mkdir("tree")
        try:
            (self.path("tree") / "link").symlink_to(
                outside.parent, target_is_directory=True
            )
        except (OSError, NotImplementedError):
            self.skipTest("this machine will not make a symlink")

        self.assertOk(self.run_cmd("rmdir", "tree"))
        self.assertDir("outside/keepme/emptysub")
        self.assertDir("tree")

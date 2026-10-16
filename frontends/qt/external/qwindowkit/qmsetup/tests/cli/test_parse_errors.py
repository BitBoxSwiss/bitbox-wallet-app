"""A command line that does not mean anything must be turned down, rather than
half done or fallen over.

How a refusal is worded, and how the help page is laid out, belong to the
command line library and are tested there. What is asserted here is what
qmcorecmd owes its caller: a non-zero exit, something said about why, and
nothing written on the way out. Where a message is qmcorecmd's own, such as
what it says about a path that is not there, it is asserted as well.
"""

from testing.harness import QmTestCase


class TestUnknownNames(QmTestCase):
    def test_an_unknown_command_is_refused(self):
        self.assertRefused(self.run_cmd("nosuchcommand"))

    def test_a_near_miss_is_offered_as_a_suggestion(self):
        r = self.run_cmd("deploi")
        self.assertRefused(r)
        self.assertOut(r, "deploy")

    def test_an_unknown_option_is_refused(self):
        self.assertRefused(self.run_cmd("copy", "--nosuchoption", "a", "b"))

    def test_an_unknown_option_is_refused_before_a_multi_value_argument(self):
        """The first argument of copy takes any number of values, and an unknown
        option must still be one rather than swallowed as a value."""
        self.assertRefused(self.run_cmd("copy", "--notanoption", "a", "b"))

    def test_an_option_belonging_to_another_command_is_unknown_here(self):
        self.assertRefused(self.run_cmd("configure", "out.h", "--linkdir", "somewhere", "-d"))


class TestNothingOnTheLine(QmTestCase):
    """The root command asks for help to be shown when a line carries nothing at
    all, and its help option is global, so this holds for a subcommand too."""

    def test_a_subcommand_with_nothing_on_its_line_shows_its_help(self):
        for command in ("copy", "touch", "configure", "rmdir", "incsync", "deploy"):
            with self.subTest(command=command):
                r = self.run_cmd(command)
                self.assertOk(r)
                self.assertOut(r, command)


class TestMissingArguments(QmTestCase):
    """Once a line carries anything at all, what is missing from it is an error."""

    def test_copy_with_a_source_but_no_destination_is_refused(self):
        self.assertRefused(self.run_cmd("copy", "onlyone"))

    def test_incsync_with_only_a_source_is_refused(self):
        self.assertRefused(self.run_cmd("incsync", "src"))

    def test_configure_with_only_an_option_is_refused(self):
        self.assertRefused(self.run_cmd("configure", "-d"))

    def test_touch_with_only_an_option_is_refused(self):
        self.assertRefused(self.run_cmd("touch", "-V"))


class TestArgumentCounts(QmTestCase):
    def test_touch_takes_two_arguments_and_no_more(self):
        for name in ("a.txt", "b.txt", "c.txt"):
            self.write(name, name)
        self.assertRefused(self.run_cmd("touch", "a.txt", "b.txt", "c.txt"))

    def test_an_option_needing_a_value_and_not_given_one_is_refused(self):
        self.assertRefused(self.run_cmd("configure", "out.h", "--project"))

    def test_a_two_argument_option_given_only_one_is_refused(self):
        self.mkdir("src")
        self.assertRefused(self.run_cmd("incsync", "src", "dest", "-i", "onlyregex"))

    def test_an_option_given_more_often_than_it_may_be_is_refused(self):
        self.assertRefused(self.run_cmd("configure", "out.h", "-p", "one", "-p", "two", "-d"))


class TestFailuresFromTheWork(QmTestCase):
    """Not the parse, but what the command found once it started. These messages
    are qmcorecmd's own, so they are asserted as written."""

    def test_copying_something_that_is_not_there_is_refused(self):
        r = self.run_cmd("copy", "no_such_file.txt", "dest")
        self.assertRefused(r)
        self.assertOut(r, "not a file or directory")

    def test_touching_a_directory_is_refused(self):
        self.mkdir("adir")
        r = self.run_cmd("touch", "adir")
        self.assertRefused(r)
        self.assertOut(r, "not a regular file")

    def test_touching_against_a_reference_that_is_not_there_is_refused(self):
        self.write("a.txt", "a")
        r = self.run_cmd("touch", "a.txt", "no_such_reference.txt")
        self.assertRefused(r)
        self.assertOut(r, "not a regular file")

    def test_syncing_from_something_that_is_not_a_directory_is_refused(self):
        self.write("notadir.txt", "x")
        r = self.run_cmd("incsync", "notadir.txt", "dest")
        self.assertRefused(r)
        self.assertOut(r, "not a directory")


class TestNothingIsLeftBehind(QmTestCase):
    def test_a_refused_copy_writes_nothing(self):
        self.assertRefused(self.run_cmd("copy", "no_such_file.txt", "dest"))
        self.assertNoDir("dest")

    def test_a_refused_configure_writes_no_header(self):
        self.assertRefused(self.run_cmd("configure", "out.h", "--project"))
        self.assertNoFile("out.h")

    def test_a_refused_incsync_writes_nothing(self):
        self.write("notadir.txt", "x")
        self.assertRefused(self.run_cmd("incsync", "notadir.txt", "dest"))
        self.assertNoDir("dest")

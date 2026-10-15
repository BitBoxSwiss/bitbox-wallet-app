"""Black-box test support for the qmcorecmd executable.

Each test runs the real binary in a sandbox directory of its own and asserts on
the exit code, on what was printed, and on what ended up on disk. Nothing here
needs anything beyond the standard library.

What the tests work on is named by the environment rather than looked for, so
that the build system decides on it. CTest sets all of it, and ``run.py`` sets
it for a run by hand.

    QMCORECMD        the executable under test
    QMTEST_FIXTURES  where the fixture binaries were built
    QMTEST_SCENARIOS the deploy declaration to read

    python tests/cli/run.py build/bin/qmcorecmd
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


def find_executable() -> Path:
    """The binary under test, which the build system decides on.

    Nothing here goes looking through a build tree for it. That is what
    ``QMCORECMD`` says. CTest sets it, and ``run.py`` takes it as an argument.
    """
    raw = os.environ.get("QMCORECMD")
    if not raw:
        raise SystemExit(
            "QMCORECMD is not set. It has to name the qmcorecmd to test. Run the "
            "suite through CTest, or through run.py, which takes the path."
        )
    path = Path(raw)
    if not path.is_file():
        raise SystemExit(f"QMCORECMD points at nothing: {path}")
    return path


class Result:
    """What one run of the tool did."""

    def __init__(self, args: list[str], code: int, out: str):
        self.args = args
        self.code = code
        self.out = out

    @property
    def ok(self) -> bool:
        return self.code == 0

    def __str__(self) -> str:
        printable = " ".join(
            arg if arg and not any(c.isspace() for c in arg) else repr(arg)
            for arg in self.args
        )
        return (
            f"\n  $ qmcorecmd {printable}\n"
            f"  [exit {self.code}]\n"
            + "".join(f"  | {line}\n" for line in self.out.splitlines())
        )


class QmTestCase(unittest.TestCase):
    """Base class giving each test an empty sandbox and a way to run the tool."""

    executable: Path

    @classmethod
    def setUpClass(cls):
        cls.executable = find_executable()

    def setUp(self):
        self.sandbox = Path(tempfile.mkdtemp(prefix="qmcorecmd-test-"))
        self.addCleanup(shutil.rmtree, self.sandbox, ignore_errors=True)

    # Building up a sandbox

    def path(self, rel: str) -> Path:
        return self.sandbox / rel

    def write(self, rel: str, content: str = "") -> Path:
        target = self.path(rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def mkdir(self, rel: str) -> Path:
        target = self.path(rel)
        target.mkdir(parents=True, exist_ok=True)
        return target

    def read(self, rel: str) -> str:
        return self.path(rel).read_text(encoding="utf-8")

    def tree(self) -> list[str]:
        """Every file in the sandbox, as forward-slashed relative paths."""
        return sorted(
            p.relative_to(self.sandbox).as_posix()
            for p in self.sandbox.rglob("*")
            if p.is_file()
        )

    # Running

    def run_cmd(self, *args: str) -> Result:
        """Runs the tool from inside the sandbox.

        The tool writes everything to stdout, but both streams are captured and
        joined so an assertion never misses a line for being on the other one.
        """
        argv = [str(a) for a in args]
        completed = subprocess.run(
            [str(self.executable), *argv],
            cwd=self.sandbox,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
        )
        # The tool speaks UTF-8 whatever the console is set to.
        out = completed.stdout.decode("utf-8", errors="replace")
        return Result(argv, completed.returncode, out)

    # Assertions

    def assertOk(self, result: Result):
        if not result.ok:
            self.fail(f"expected success, exit was {result.code}{result}")

    def assertFails(self, result: Result):
        if result.ok:
            self.fail(f"expected a non-zero exit, got success{result}")

    def assertRefused(self, result: Result):
        """The command line was turned down, and something was said about it.

        How the refusal is worded is the command line library's business, not
        this tool's, so nothing here looks at the wording. What this tool owes
        its caller is a non-zero exit and a diagnostic rather than silence.
        """
        if result.ok:
            self.fail(f"expected a non-zero exit, got success{result}")
        if not result.out.strip():
            self.fail(f"exited {result.code} without saying why{result}")

    def assertOut(self, result: Result, needle: str):
        if needle not in result.out:
            self.fail(f"output does not contain {needle!r}{result}")

    def assertNotOut(self, result: Result, needle: str):
        if needle in result.out:
            self.fail(f"output should not contain {needle!r}{result}")

    def assertOutOrder(self, result: Result, first: str, second: str):
        at_first = result.out.find(first)
        at_second = result.out.find(second)
        if at_first < 0:
            self.fail(f"{first!r} is not in the output at all{result}")
        if at_second < 0:
            self.fail(f"{second!r} is not in the output at all{result}")
        if at_first >= at_second:
            self.fail(f"{first!r} should come before {second!r}{result}")

    def assertFile(self, rel: str):
        if not self.path(rel).is_file():
            self.fail(f"expected a file at {rel}\n  tree: {self.tree()}")

    def assertNoFile(self, rel: str):
        if self.path(rel).exists():
            self.fail(f"{rel} should not exist\n  tree: {self.tree()}")

    def assertDir(self, rel: str):
        if not self.path(rel).is_dir():
            self.fail(f"expected a directory at {rel}\n  tree: {self.tree()}")

    def assertNoDir(self, rel: str):
        if self.path(rel).is_dir():
            self.fail(f"{rel} should not be a directory\n  tree: {self.tree()}")

    def assertFileContains(self, rel: str, needle: str):
        self.assertFile(rel)
        content = self.read(rel)
        if needle not in content:
            self.fail(f"{rel} does not contain {needle!r}\n--- content ---\n{content}")

    def assertFileLacks(self, rel: str, needle: str):
        self.assertFile(rel)
        content = self.read(rel)
        if needle in content:
            self.fail(f"{rel} should not contain {needle!r}\n--- content ---\n{content}")


def run_all() -> int:
    """Runs every test module next to this file. Returns a process exit code."""
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(Path(__file__).parent), pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    return 0 if runner.run(suite).wasSuccessful() else 1

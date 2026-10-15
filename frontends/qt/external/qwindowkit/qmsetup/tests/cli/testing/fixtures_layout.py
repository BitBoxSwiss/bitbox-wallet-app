"""Finding the fixture binaries and putting them where a test can work on them.

The binaries are built by ``fixtures/CMakeLists.txt`` into two trees, one for
the application and one for the framework it uses. The trees are the point, so
a test copies them across whole rather than rearranging anything.

Which directories those are, and which artifact lives in which, is declared in
``deploy_scenarios.json`` and checked here against what the build produced. A
directory renamed in one file and not the other fails at once, with both names
in the message, rather than as a test that quietly skips.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

LIBRARY_SUFFIXES = (".dll", ".so", ".dylib")
EXECUTABLE_SUFFIXES = (".exe", "")

#: What a sandbox is allowed to hold. A build leaves more beside a binary than
#: an installed tree ever does, a debug build on Windows most of all, and a test
#: checks a deployment's output directory for exactly what should be in it. So
#: the copy takes the binaries and nothing else.
BINARY_SUFFIXES = frozenset(LIBRARY_SUFFIXES + EXECUTABLE_SUFFIXES)


def scenario_file() -> Path:
    """The declaration to read, which the build system decides on.

    Nothing here knows where the file is, or what it is called. That is what
    ``QMTEST_SCENARIOS`` says. CTest sets it, and ``run.py`` sets it for a run
    by hand.
    """
    raw = os.environ.get("QMTEST_SCENARIOS")
    if not raw:
        raise SystemExit(
            "QMTEST_SCENARIOS is not set. It has to name the deploy declaration to "
            "read. Run the suite through CTest, or through run.py, which sets it."
        )
    path = Path(raw)
    if not path.is_file():
        raise SystemExit(f"QMTEST_SCENARIOS points at nothing: {path}")
    return path


def load_declaration() -> dict:
    with scenario_file().open(encoding="utf-8") as handle:
        return json.load(handle)


def _find(directory: Path, stem: str, suffixes: tuple[str, ...]) -> Path | None:
    """The one artifact named ``stem``, whatever the platform decorates it with."""
    if not directory.is_dir():
        return None
    wanted = {stem, "lib" + stem}
    for entry in sorted(directory.iterdir()):
        if entry.is_file() and entry.stem in wanted and entry.suffix in suffixes:
            return entry
    return None


def _not_binaries(directory: str, entries: list[str]) -> list[str]:
    """What a copy of a tree should leave behind, for ``shutil.copytree``."""
    here = Path(directory)
    return [
        entry
        for entry in entries
        if not (here / entry).is_dir()
        and (here / entry).suffix.lower() not in BINARY_SUFFIXES
    ]


class Layout:
    """Where each artifact is, as paths relative to the sandbox."""

    def __init__(self, sandbox: Path, directories: dict, placed: dict):
        self.sandbox = sandbox
        self.directories = directories
        self._placed = placed

    def path(self, artifact: str) -> str:
        """The artifact's path in the sandbox."""
        return self._placed[artifact]

    def name(self, artifact: str) -> str:
        """The artifact's file name, which is what a deployment produces."""
        return Path(self._placed[artifact]).name

    def directory(self, key: str) -> str:
        return self.directories[key]

    def names(self) -> dict[str, str]:
        return {artifact: Path(p).name for artifact, p in self._placed.items()}

    def artifact_of(self, file_name: str) -> str | None:
        """The artifact a produced file came from, for readable failures."""
        for artifact, name in self.names().items():
            if name == file_name:
                return artifact
        return None


class Fixtures:
    """The built fixture trees."""

    def __init__(self, directory: Path, declaration: dict | None = None):
        self.directory = directory
        self.declaration = declaration or load_declaration()
        self.trees = self.declaration["trees"]
        self.directories = self.declaration["directories"]
        self.artifacts = self.declaration["artifacts"]

        self.files: dict[str, Path | None] = {}
        for artifact, spec in self.artifacts.items():
            suffixes = (
                EXECUTABLE_SUFFIXES
                if spec["kind"] == "application"
                else LIBRARY_SUFFIXES
            )
            where = directory / self.directories[spec["directory"]]
            self.files[artifact] = _find(where, f"qmtest_{artifact}", suffixes)

    @property
    def missing(self) -> list[str]:
        return [
            f"{artifact} in {self.directories[self.artifacts[artifact]['directory']]}"
            for artifact, path in self.files.items()
            if path is None
        ]

    def copy_into(self, sandbox: Path) -> Layout:
        """Copies the binaries of both trees into the sandbox, structure and all."""
        for tree in self.trees:
            shutil.copytree(
                self.directory / tree,
                sandbox / tree,
                dirs_exist_ok=True,
                ignore=_not_binaries,
            )

        placed = {}
        for artifact, spec in self.artifacts.items():
            directory = self.directories[spec["directory"]]
            placed[artifact] = f"{directory}/{self.files[artifact].name}"
        return Layout(sandbox, dict(self.directories), placed)


def load() -> Fixtures | None:
    """The fixtures, or None when they were not built.

    A directory that is there but holds the wrong thing is a mistake in the
    setup rather than a reason to pass over the tests quietly, so that case
    says what it found instead of answering None.
    """
    raw = os.environ.get("QMTEST_FIXTURES")
    if not raw:
        return None
    directory = Path(raw)
    if not directory.is_dir():
        return None
    fixtures = Fixtures(directory)
    if fixtures.missing:
        present = sorted(
            str(p.relative_to(directory))
            for p in directory.rglob("*")
            if p.is_file()
        )
        raise SystemExit(
            f"QMTEST_FIXTURES points at {directory}, which does not hold "
            f"{'; '.join(fixtures.missing)}.\n"
            f"What is there: {present or 'nothing'}"
        )
    return fixtures

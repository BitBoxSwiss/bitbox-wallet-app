#!/usr/bin/env python3
"""Runs the whole qmcorecmd suite by hand.

    python tests/cli/run.py <qmcorecmd> [<fixture directory>]

Everything the tests need is named by an environment variable, so that the
build system decides on it rather than the test code guessing:

    QMCORECMD        the executable under test
    QMTEST_FIXTURES  where the fixture binaries were built, for the deploy
                     tests. Without it those skip themselves
    QMTEST_SCENARIOS the deploy declaration to read

This script fills in whichever of them were not set already. Under CTest they
all are, and this script is not involved.
"""

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    args = sys.argv[1:]
    if args:
        os.environ["QMCORECMD"] = args.pop(0)
    if args:
        os.environ["QMTEST_FIXTURES"] = args.pop(0)
    if args:
        print(f"unexpected argument: {args[0]}", file=sys.stderr)
        return 2

    # This script sits beside the declaration, so it is the one place that may
    # say where the file is.
    os.environ.setdefault("QMTEST_SCENARIOS", str(HERE / "deploy_scenarios.json"))

    sys.path.insert(0, str(HERE))
    from testing.harness import run_all

    return run_all()


if __name__ == "__main__":
    sys.exit(main())

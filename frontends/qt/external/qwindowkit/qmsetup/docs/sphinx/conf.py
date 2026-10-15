# Sphinx, for the reference pages built out of the comments in cmake/.
#
# The comments are written the way CMake writes its own: a bracket comment whose
# first line is `.rst:`, which sphinxcontrib.moderncmakedomain extracts with the
# `cmake-module` directive. Every .rst under here is a stub naming one module,
# so a module is documented in the module and nothing here has to be kept in
# step with it.
#
# In a directory of its own, the rest of docs/ being written by hand and read
# where it sits rather than built into anything.
#
# A module with no `.rst:` comment in it renders as an empty page rather than as
# an error, and a command whose comment nobody converted is simply absent, so
# neither shows up as a failure here. What catches that is the count, which the
# CI documentation job asserts.
#
#   pip install sphinx sphinxcontrib-moderncmakedomain
#   sphinx-build -b html -W docs/sphinx docs/sphinx/_build

import os
import re
from pathlib import Path

from sphinxcontrib.moderncmakedomain.cmake import CMakeModule

project = "qmsetup"
copyright = "Stdware Collections"

extensions = ["sphinxcontrib.moderncmakedomain"]

# So that :cmake:command:`qm_foo` can be written as :command:`qm_foo`, and a bare
# code block is CMake unless it says otherwise.
primary_domain = "cmake"
highlight_language = "cmake"

html_theme = "alabaster"
exclude_patterns = ["_build"]

# Read out of the project rather than written again here. Where this lives is
# declared once, at the top of the tree, and this is the fourth place that would
# otherwise carry a copy of it.
_project_file = (Path(__file__).resolve().parents[2] / "CMakeLists.txt").read_text(encoding="utf-8")


def _declared(keyword, fallback=""):
    found = re.search(rf'{keyword}\s+"([^"]*)"', _project_file)
    return found.group(1) if found else fallback


# The parts of the page that are a matter of taste rather than of fact. Turn one
# off and build again.
SHOW_DESCRIPTION = True  # the project's one line under the title, in the sidebar
SHOW_GITHUB_RIBBON = True  # the octocat across the top right corner
SHOW_SOURCE_LINKS = True  # the module each page was written in, at its foot

# A link to the repository on every page, which is the sidebar. Not the GitHub
# button alabaster also offers, that one being an iframe from another host and
# these pages being read from an install tree as often as from the web.
_owner, _, _repo = _declared("HOMEPAGE_URL").rpartition("/")

html_theme_options = {
    "extra_nav_links": {"Source on GitHub": _declared("HOMEPAGE_URL")},
    "description": _declared("DESCRIPTION") if SHOW_DESCRIPTION else "",
    # The corner ribbon, which is the one icon the theme can draw without this
    # repository carrying an image and a stylesheet to go with it. Its octocat
    # ships with alabaster, so nothing is fetched from anywhere.
    "github_user": _owner.rpartition("/")[2],
    "github_repo": _repo,
    "github_banner": SHOW_GITHUB_RIBBON,
    # Naming the repository above turns this on by itself, and it is an iframe
    # from a third host that counts stars. These pages are read out of an
    # install tree as often as off the web, so it is turned back off.
    "github_button": False,
}

# No "page source" link and no copy of the sources beside the pages. Every source
# under here is a one line stub, so what the link offers a reader is the name of
# a file rather than the text they are looking at.
html_copy_source = False
html_show_sourcelink = False


# Where the repository is, said once.
#
# The stubs name their module from here, as `cmake/modules/Deploy.cmake`, so that
# none of them counts how deep it was filed and moving one changes nothing in it.
_source_dir = Path(__file__).resolve().parent
_repo_root = _source_dir.parents[1]

# A leading slash is how the directive underneath spells "from the Sphinx source
# directory", and this is the way back out of it. Worked out rather than written,
# so that it is right wherever this file is moved to.
_root_from_source = os.path.relpath(_repo_root, _source_dir).replace(os.sep, "/")


# Which revision the links at the foot of each page point into. A branch rather
# than a tag, the pages being built from whatever was checked out.
_source_branch = os.environ.get("QMSETUP_DOCS_BRANCH", "main")


class QmModule(CMakeModule):
    """`cmake-module`, given a path from the top of the repository.

    An absolute path cannot be handed to the directive underneath, which reads
    one as relative to the Sphinx source directory whatever the platform calls a
    root, so the way out is worked out above and put on the front here.

    The module is named at the foot of the page it makes, and linked. A reader
    who wants to change what is written here needs the .cmake file rather than
    anything under docs/, the stub being one line that names it, and there is no
    other way to tell from the page.
    """

    def run(self):
        source = self.arguments[0]
        self.arguments[0] = f"/{_root_from_source}/{source}"

        if not SHOW_SOURCE_LINKS:
            return super().run()

        machine = self.state_machine
        insert = machine.insert_input

        def with_source_link(lines, path):
            url = f'{_declared("HOMEPAGE_URL")}/blob/{_source_branch}/{source}'
            insert(list(lines) + [
                "",
                ".. rubric:: Where this page comes from",
                "",
                f"The comments in `{source} <{url}>`_, which is what to change.",
                "",
            ], path)

        machine.insert_input = with_source_link
        try:
            return super().run()
        finally:
            machine.insert_input = insert


def _upper_case_heading(app, pagename, templatename, context, doctree):
    """The heading above the sidebar, which alabaster draws from `project`.

    No theme option reaches it, and renaming the project would carry into the
    page titles and the search index as well. What the templates are handed is
    the one thing left, and `project` is read by nothing else the html builder
    draws here.
    """
    context["project"] = context["project"].upper()


def setup(app):
    app.add_directive("qm-module", QmModule)
    app.connect("html-page-context", _upper_case_heading)

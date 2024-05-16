# Contribution guide

The codebase is maintained using the "contributor workflow" where anyone can
contribute patch proposals using
[pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests).

To contribute a patch, the workflow is as follows:

1. Fork the repository.
2. Create a topic branch.
3. Commit patches to the branch.
4. Push changes to the fork.
5. Create a pull request to merge the branch of the fork into this repository.
6. If you had someone specifically in mind, ask them to review the pull request.
Otherwise, just wait for a code review: most members with merge permissions
receive notifications for newly created pull requests.
7. Address review comments, if any.
8. Merge and submit the pull request. If you don't have merge permissions,
a reviewer will do it for you.

> **NOTE:** Before starting any coding work, please make sure to discuss the
> issue first to agree on the optimal way of solving a particular problem.
> If no issue exists, create one unless the change is trivial, such as
> correcting typos and code formatting.
>
> If you don't know where to start, look for issues labeled
> with [good-first-issue](https://github.com/BitBoxSwiss/bitbox-wallet-app/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue).

## Git commits

In general,
[commits should be atomic](https://en.wikipedia.org/wiki/Atomic_commit#Atomic_commit_convention)
and diffs should be easy to read. Please, do not mix style, formatting or moving
code around with the actual code changes in the same commit. If a change is
larger than 500 lines, consider creating multiple pull requests or multiple
commits depending on how closely the patches are related to each other.

For example, if a change is much easier to do after a certain code reformatting,
make the reformatting in a first commit and the actual change in the second.
On the other hand, if a change includes multiple backend commits to create
a new API endpoint as well as some UI modifications on the frontend, consider
splitting backend and frontend into separate pull requests.

A commit message consists of a subject, the first line, and a body separated
from the subject by a blank line.

The subject is conventionally formatted as "context: summary", fitting in 60
characters. The context is a short name of the primary spot in the codebase
affected by the change. The summary is in imperative form so the line can be
read as

    This change modifies the _context_ to _summary_.

> **NOTE:** That means the first line starts with lower case and does not end
> with a period.

The goal is that reading the commit message on any line using `git blame`
explains why the line exists.

For nontrivial changes, the subject alone is rarely self-explanatory.
In this case, please add the body describing why this change is necessary,
what it improves and how. Make sure the body lines fit in 72 characters,
doesn't contain HTML, Markdown or any other markup language. Just plain text.

Try putting yourself in a reviewer's shoes and see whether they can, without
prior knowledge of the issue, understand the _why_, the _what_ and the _how_.
Add any relevant benchmarks, performance and other information such as forums
and mailing list discussions that helps in understanding and evaluating whether
the change is the optimal way among alternatives.

If the change resolves an existing issue, bugfix or a feature implementation,
append to the body `Fixes #123` or `Closes #123` where `#123` is the issue
number. If it's a partial resolution, use `Updates #123` or `Refs #123` instead.

Here's an example of a good commit message:

    docs: add contribution guidelines

    As the contributors list keeps growing, we really need to get on the
    same page in how to propose and make changes to the codebase.
    The guidelines in this commit align with what people with merge
    permissions to this repo consider common practices.

    There are other git repos, such as bitbox02-firmware, api-go and api-js.
    We'll need the same guidelines in those, too. An alternative was to
    publish a single copy on a website but having independent
    self-sufficient repos was a prevailing benefit. So, will copy these
    guidelines over to the other repos once this is committed.

    Closes #96

See `git log` for more examples.

For details on working with git, please refer to the
[git manual](https://git-scm.com/doc).

## Pull requests

A pull request contains one or more related git commits. Please, do not bundle
independent and unrelated commits into a single pull request.

Just like a git commit message, a pull request consists of a subject and a body.
If a pull request contains only one git commit, set its title and description to
the commit's subject and the body. Otherwise, make an overall summary of what
all the commits accomplish together, in a way similar to a commit message.

Before creating a pull request, please make sure all tests and lints pass
locally on your machine. In a case where a pull request isn't ready for
a regular code review and you're just looking for some early feedback,
it's ok to let some tests fail but please mention it explicitly in the request
description. See readme file in the root of the repository for setting up
development environment and building/testing instructions.

At this stage one should expect comments and code reviews from other contributors.
To address review comments, amend an existing commit with the new changes using

    git commit --amend

and overwrite remote branch with

    git push --force

See the following docs on creating github pull requests:
https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request

# About qmcorecmd

`qmcorecmd` is a small C++ executable that does the things a CMake script either cannot do or would do badly. It is built once, installed with qmsetup, and called by the `qm_*` functions. Nothing stops you calling it yourself, and this document is what to read if you do.

It has six subcommands under two headings.

| Filesystem | |
|---|---|
| `copy` | Copy files or directories if different |
| `rmdir` | Remove empty directories recursively |
| `touch` | Update file timestamp |

| Buildsystem | |
|---|---|
| `configure` | Generate a configuration header |
| `incsync` | Reorganise the headers of an include directory |
| `deploy` | Resolve and deploy a binary's shared library dependencies |

Every subcommand takes `-h` for its own help and `-V` to say what it is doing. Without `-V` they say nothing at all when they succeed. A command line it cannot make sense of is refused with a non-zero exit and a message.

An argument may sit anywhere among the options. `qmcorecmd copy -V a b`, `qmcorecmd copy a -V b` and `qmcorecmd copy a b -V` are the same command line.

---

## copy

```
qmcorecmd copy [options] <src>... <dest>
```

Copies files and directories into `<dest>`, which is made if it is not there. Several sources may be named, and all of them land in the one destination.

| Option | |
|---|---|
| `-e, --exclude <regex>` | Leave out anything whose path matches. May be given more than once |
| `-f, --force` | Overwrite whatever is there, without comparing |
| `-V, --verbose` | Name each thing copied |

**A trailing separator is the one thing that changes the meaning of a source.** Without it the directory is copied as itself, with it the contents are copied and the directory is not:

```sh
qmcorecmd copy assets out    # out/assets/one.txt
qmcorecmd copy assets/ out   # out/one.txt
```

Nesting is kept however deep it goes. An existing file is overwritten only when the source is the newer of the two, which is what "if different" means, and `-f` skips that comparison. Copying the same tree twice is not an error and the second run does nothing. A file that would be copied over itself is passed over rather than refused, which is what lets a deployment name binaries that are already where they belong.

Each copy is given the timestamps of what it was copied from, so the comparison holds on the run after.

`-e` is matched against the path rather than the file name, so a pattern naming a directory keeps everything under it out.

## rmdir

```
qmcorecmd rmdir [options] <dir>...
```

Removes empty directories, and the directories that are left empty by removing them, as far up as each named directory. A branch is kept as far up as the first thing in it that is not a directory.

CMake's `install(DIRECTORY ...)` creates every directory it walks whether or not anything was installed into it. This is what clears them out afterwards.

A name that is not a directory, or is not there at all, is passed over rather than refused, so a build script can name a directory it is not sure about.

## touch

```
qmcorecmd touch [options] <file> [<ref file>]
```

Sets the timestamps of `<file>`, to now, or to those of `<ref file>` if one is named. The content is not touched.

Windows has no such command of its own, which is why this exists. Only the part of the Unix `touch` that a build needs is implemented: it will not create a file that is not there, and a directory is refused rather than touched.

With `-V` it reports the three times it set. On Windows the third is the creation time and elsewhere it is the status change time, which is not settable, so it is read back rather than written.

## configure

```
qmcorecmd configure [options] <output file>
```

Writes a header of `#define` lines, guarded, with a hash of what went into it.

| Option | |
|---|---|
| `-D, --define <expr>` | A definition. `<key>`, `<key>=<value>` or `%<raw>` |
| `-p, --project <name>` | Put a project name in front of the include guard |
| `-w, --warning [<file>]` | Write a do-not-edit notice at the top, from `<file>` if given |
| `-f, --force` | Leave the hash out and write every time |
| `-d, --dryrun` | Print what would be written and write nothing |

The three spellings of a definition:

```sh
qmcorecmd configure -D FEATURE_ONE -D ANSWER=42 -D '%#include <stddef.h>' config.h
```

A bare key becomes `#define FEATURE_ONE`. A key and a value become `#define ANSWER 42`, and everything after the first `=` is the value, so `-D A=b=c` gives `#define A b=c`. A `%` in front means the rest of the line is written through as it stands, which is how anything that is not a `#define` gets in, a blank line included. Raw lines keep their place among the definitions.

Definitions keep the order they were given. Naming a key twice keeps the first position and takes the last value.

The include guard is built from the file name, upper cased, with anything that cannot be in an identifier replaced by an underscore and a leading underscore added if it would otherwise start with a digit. `-p` puts a project name in front of it. The path is not part of it, only the name.

`-w` on its own writes a standard do-not-edit notice as a comment at the top. Given a file, the lines of that file are used instead, each as a comment, with blank ones dropped. A file that is not there falls back to the standard text rather than being refused. Without `-w` there is no notice at all.

**The hash is the point of the command.** A SHA-256 of the definitions is written into the header, and a second run over the same definitions reads it back, finds nothing changed and leaves the file alone. Nothing that includes the header rebuilds. `-f` writes without the hash and so writes every time.

## incsync

```
qmcorecmd incsync [options] <src> <dest>
```

Builds an include directory out of a source tree. Headers are found wherever they are under `<src>` and gathered into `<dest>`, flattened, so that `#include <foo.h>` works whatever subdirectory `foo.h` really lives in.

| Option | |
|---|---|
| `-i, --include <regex> <subdir>` | Put what matches into a subdirectory. May be repeated |
| `-e, --exclude <regex>` | Leave out anything that matches |
| `-s, --standard` | Send the private headers to `private/` |
| `-n, --not-all` | Drop whatever no pattern claimed |
| `-c, --copy` | Copy the headers instead of pointing at them |
| `-d, --dryrun` | Print what would happen |
| `-f, --force` | Clear the destination first |

**By default nothing is copied.** What lands in `<dest>` is a one line stub holding a relative `#include` of the real header, with forward slashes whatever the platform. Editing the header in its own directory is then the only place it is edited, and the include directory never goes stale. `-c` copies instead, which is what an install wants.

`.h`, `.hpp`, `.hh` and `.hxx` are taken, ignoring case. Anything else is left where it is.

`-i` takes two arguments, a pattern and the subdirectory that what matches it goes into, and may be given once for each subdirectory wanted. `-s` is shorthand for the public and private convention, sending a header whose name ends in `_p` to `private/`.

`-n` drops whatever no pattern claimed, rather than putting it at the top level. Note what that means alongside `-s` and nothing else: the private headers are claimed and the public ones are not, so `-s -n` gives an include directory holding `private/` and nothing besides.

Timestamps decide whether to write, so running it again does nothing. Without `-f` whatever was already in the destination stays, which is what `qm_sync_include` relies on when it decides not to run the command at all.

## deploy

```
qmcorecmd deploy [options] <file>...
```

Works out what shared libraries the named binaries need, finds them, and copies them into one directory. The named binaries themselves are not moved.

| Option | |
|---|---|
| `-c, --copy <src> <dir>` | Also deploy `<src>`, into `<dir>` |
| `-o, --out <dir>` | Where the dependencies go. The current directory by default |
| `-L, --linkdir <dir>` | Another directory to look in. May be repeated |
| `-e, --exclude <regex>` | Do not deploy anything matching, nor go on through it |
| `-s, --standard` | Leave the C and C++ runtime and the system libraries alone |
| `-d, --dryrun` | Print what was resolved and copy nothing |
| `-f, --force` | Overwrite what is already in the output directory |

How a dependency is discovered is not the same anywhere. Windows reads the import table of the PE file. macOS asks `otool`. Linux asks `patchelf` for the binary's own `DT_NEEDED` and `ldd` for what those names resolve to, which is why it is the direct dependencies that are followed rather than the flattened list a loader would report.

Where they are looked for follows from that. Everywhere, the directory each named binary sits in and every `-L` directory are searched. On Unix whatever the loader itself would find, through the binary's own rpath and the places the system keeps libraries, is taken first, and `-L` answers the names it could not place. Windows has only the two.

**`-c` is for what nothing links.** A plugin is loaded by name at runtime, so no amount of following the dependency graph arrives at it. Naming it with `-c` brings it along, and brings along whatever it needs, which is often a library nothing else asked for. It takes two arguments, the plugin and where to put it, and may be given as many times as there are plugins.

`-e` cuts a subtree out rather than only skipping one file. An excluded library is never opened, so what only it asked for is never found either.

**On Unix the copies are rewritten.** A library that has moved cannot find its neighbours by the path it was built with, so every binary that was named and every plugin that was copied has its rpath rewritten to point where the libraries went. The binaries in the output directory no longer name the machine they were built on. Windows has nothing of the sort and needs none.

`-s` leaves out what every machine already has. On Windows nothing under the system directories is ever deployed whether or not `-s` was given, and `-s` additionally drops the MSVC runtime. On Unix nothing is filtered until `-s` says so, and a deployment without it drags the C library along.

Every library deployed must have a different file name, since they all land in the one directory.

### An example

A program installed beside a framework, of which the framework's plugins are loaded by name:

```sh
qmcorecmd deploy myapp/bin/app myapp/bin/core.dll \
    -c thirdparty/lib/audio/plugins/audioplugin.dll myapp/lib/audio/plugins \
    -L thirdparty/bin \
    -o myapp/bin \
    -s
```

`app` and `core` stay where they are. What they need is found through `-L` and copied into `myapp/bin`. `audioplugin` is copied to where `-c` says, and the library it alone needs is found and copied into `myapp/bin` with the rest.

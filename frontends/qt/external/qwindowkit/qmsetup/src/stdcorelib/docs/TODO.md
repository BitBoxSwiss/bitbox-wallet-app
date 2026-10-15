# Status

Released as v1.1.0.0, and used by qmsetup's `qmcorecmd`. What the version promises is written down: the headers stay source compatible across a major version, and the soname carries the minor as well, so a minor bump is free to change what the binary exports.

## Known gaps

- `vlarray::get_allocator()` returns a `const` reference to the allocator it holds. A standard container answers by value, and there is nothing about an allocator that wants borrowing.
- `support/commandline.h` is over a thousand lines of inline code, paid for by every translation unit that includes it
- `DynamicRegistry::remove_listener()` waits for every notification in flight, not only the ones that reach the listener being removed. It is safe and it is conservative: with other threads registering steadily the count may not be seen at zero, and there is no timeout, so a caller can be made to wait far longer than the callbacks it actually has to outlive. A per-listener count, or a generation number, would bound it.
- `processMemoryUsage()` in `src/system.cpp` has never had a caller. It is `[[maybe_unused]] static`, is declared in no header, and carries `<Psapi.h>` and `<mach/mach.h>` in with it. Either delete it or promote it to `system::` with a comment and a case, since nothing can cover it as it stands.

## Wanted

- Mutually exclusive option groups for `cli`, so that `--json` and `--xml` can rule each other out. SysCmdLine's version of this interacts with its option priority ladder, so decide what the semantics should be rather than copying its shape.
- `communicate()` on **Windows** starts one worker thread per open pipe, and with a single pipe there is nothing to interleave with, so the thread is only there to make a timeout interruptible. CPython skips it in that case (`Lib/subprocess.py:1199`, at most one pipe and no timeout). POSIX here has nothing to fix: it is one `poll()` loop and no threads, which is what CPython does on that side too. Probably not worth doing at all, since a thread costs tens of microseconds against the milliseconds of `CreateProcessW` beside it, and it buys a second path through the one function in this library whose deadlock reasoning is subtle. Measure before writing it.

## Unverified

- `console::width()` reading a Windows console is checked against the console the suite is attached to, and skipped where there is none. That it reads the visible window rather than the scrollback buffer is not: Windows Terminal gives the buffer the same width as the window, so reading `dwSize.X` instead passes, measured. It would fail on a console whose buffer somebody widened, which is the case the code is written for.

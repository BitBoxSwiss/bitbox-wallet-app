# STDCORELIB

Portable C++ Application Infrastructure.

## Introduction

Most of it exists because the answer differs between Windows and the rest of the world: console color, UTF-8 that survives a Windows console, launching a child process, loading a shared object. The rest is a handful of containers and utilities that kept getting rewritten.

Header-only where it can be, compiled where it has to be. No dependencies beyond the standard library, and Boost.Test for the test suite alone.

## Requirements

- A C++17 compiler.
- CMake 3.16 or later.
- Windows, Linux or macOS. MSVC, clang-cl, GCC and Clang are all built and tested.

## Build & Install

```bash
git clone https://github.com/stdware/stdcorelib.git
cd stdcorelib
cmake -B build -S . \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build --config Release
cmake --install build --config Release
```

## Integration

Install the library, make its installation prefix discoverable by CMake, and consume its exported target:

```cmake
find_package(stdcorelib CONFIG REQUIRED)
target_link_libraries(myapp PRIVATE stdcorelib::stdcorelib)
```

Or as a subdirectory:

```cmake
add_subdirectory(stdcorelib)
target_link_libraries(myapp PRIVATE stdcorelib::stdcorelib)
```

## Components

| Component | |
| --- | --- |
| Command line | Declaring what a program takes, and reading back what it was given |
| Processes and libraries | Starting a child process, loading a shared object |
| Text | Strings, formatting, the console, UTF conversion |
| Containers and views | `array_view`, `vlarray`, `linked_map`, `any` |
| Type identity | Naming a type without RTTI, and registries built on that |
| Logging | Named categories with per-level switches and filter rules |
| JSON and CBOR | One tree, both encodings |
| Platform and system | Program and machine information, the Windows registry |
| Utilities | Flags, scope guards, version numbers |

Each carries its own description and an example. Build the `stdcorelib_docs` target with `-DSTDC_BUILD_DOCS=ON`, or read the headers, which is where that text lives.

## Credits

Code derived from these is cited where it is used:

- [CPython](https://github.com/python/cpython)
- [qtbase](https://github.com/qt/qtbase)
- [xmake](https://github.com/xmake-io/xmake)
- [LLVM](https://github.com/llvm/llvm-project)

The test suites use:

- [Boost.Test](https://www.boost.org/users/history/test.html)

The documentation is built and styled with:

- [Doxygen](https://www.doxygen.nl/)
- [doxygen-awesome-css](https://github.com/jothepro/doxygen-awesome-css)

## License

MIT. See [LICENSE](LICENSE).

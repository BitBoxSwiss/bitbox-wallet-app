// SPDX-License-Identifier: MIT

#include <filesystem>
#include <utility>

#ifdef _WIN32
#  ifndef NOMINMAX
#    define NOMINMAX // or windows.h's max() and min() reach flags.h below
#  endif
#  ifndef WIN32_LEAN_AND_MEAN
#    define WIN32_LEAN_AND_MEAN
#  endif
#  include <windows.h>
#else
#  include <dlfcn.h>
#endif

#include <stdcorelib/scope_guard.h>
#include <stdcorelib/support/sharedlibrary.h>

#include <boost/test/unit_test.hpp>

namespace fs = std::filesystem;

using namespace stdc;

BOOST_AUTO_TEST_SUITE(test_sharedlibrary)

namespace {

    // Whether the loader still holds this module, asked of the loader rather than of the object
    // that was supposed to have let go of it. Nothing else in this binary loads it, so what
    // comes back is about the case that asked.
    bool still_loaded(const fs::path &path) {
#ifdef _WIN32
        return ::GetModuleHandleW(path.c_str()) != nullptr;
#else
        // RTLD_NOLOAD answers without loading, but it does take a reference to what is already
        // there, so the answer has to be given back.
        void *handle = ::dlopen(path.c_str(), RTLD_NOLOAD | RTLD_LAZY);
        if (handle) {
            ::dlclose(handle);
        }
        return handle != nullptr;
#endif
    }

    // Named once rather than expanded at every use, since a macro standing where a value belongs
    // reads as a value the reader has to go and look up.
    const char UnloadablePath[] = TEST_SHAREDLIBRARY_UNLOADABLE_PATH;
    const char PinnedPath[] = TEST_SHAREDLIBRARY_PINNED_PATH;
    const char NeedsDependencyPath[] = TEST_SHAREDLIBRARY_NEEDS_DEPENDENCY_PATH;

#ifndef _WIN32
    // The variable setLibraryPath() writes, named the same way the implementation names it.
#  ifdef __APPLE__
    const char PriorLibraryPathKey[] = "DYLD_LIBRARY_PATH";
#  else
    const char PriorLibraryPathKey[] = "LD_LIBRARY_PATH";
#  endif
#endif

    fs::path unloadable() {
        return fs::path(UnloadablePath);
    }
    fs::path pinned() {
        return fs::path(PinnedPath);
    }
    fs::path needsDependency() {
        return fs::path(NeedsDependencyPath);
    }

    // A library that is guaranteed to be present, plus a symbol it is guaranteed to export.
    // Returns an empty path when the platform has no dependable candidate, in which case the
    // cases that need a real library are skipped rather than failed.
    struct Candidate {
        fs::path path;
        const char *symbol;
    };

    Candidate system_library() {
#if defined(_WIN32)
        for (const char *p :
             {"C:\\Windows\\System32\\kernel32.dll", "C:\\WINNT\\System32\\kernel32.dll"}) {
            if (fs::exists(p)) {
                return {p, "GetProcessHeap"};
            }
        }
#elif defined(__APPLE__)
        for (const char *p : {"/usr/lib/libSystem.B.dylib"}) {
            if (fs::exists(p)) {
                return {p, "malloc"};
            }
        }
#else
        for (const char *p : {"/lib/x86_64-linux-gnu/libm.so.6", "/usr/lib/libm.so.6",
                              "/lib64/libm.so.6", "/usr/lib64/libm.so.6"}) {
            if (fs::exists(p)) {
                return {p, "cos"};
            }
        }
#endif
        return {};
    }

}

BOOST_AUTO_TEST_CASE(test_default_state) {
    SharedLibrary lib;
    BOOST_CHECK(!lib.isOpen());
    BOOST_CHECK(lib.handle() == nullptr);
    BOOST_CHECK(lib.path().empty());
}

BOOST_AUTO_TEST_CASE(test_open_failure) {
    SharedLibrary lib;

    BOOST_CHECK(!lib.open("no_such_library_9f3a.dll"));
    BOOST_CHECK(!lib.isOpen());
    BOOST_CHECK(lib.path().empty()); // a failed open leaves no path behind
    BOOST_CHECK(!lib.errorMessage().empty());

    // Each platform says it in its own vocabulary. Windows names the loader failure, and the dl
    // platforms have none to give, so that side is answered from the path.
    BOOST_CHECK(lib.errorCode());
#ifndef _WIN32
    BOOST_CHECK(lib.errorCode() == std::errc::no_such_file_or_directory);
#endif

    // A file that is there and is not a library reads differently from one that is not there,
    // which is the point of having a code at all.
    {
        SharedLibrary notALibrary;
        const auto self = std::filesystem::path(__FILE__);
        BOOST_REQUIRE(std::filesystem::exists(self));
        BOOST_CHECK(!notALibrary.open(self));
        BOOST_CHECK(!notALibrary.errorMessage().empty());
        BOOST_CHECK(notALibrary.errorCode());
        BOOST_CHECK(notALibrary.errorCode() != lib.errorCode());
    }

    // Resolving on a library that was never opened is refused by this class rather than by the
    // platform, so both answer the same way.
    BOOST_CHECK(lib.resolve("anything") == nullptr);
    BOOST_CHECK(lib.errorCode() == std::errc::operation_not_permitted);
}

BOOST_AUTO_TEST_CASE(test_system_library) {
    auto candidate = system_library();
    if (candidate.path.empty()) {
        BOOST_TEST_MESSAGE("no dependable system library on this platform, skipping");
        return;
    }

    SharedLibrary lib;
    BOOST_REQUIRE(lib.open(candidate.path));
    BOOST_CHECK(lib.isOpen());
    BOOST_CHECK(lib.handle() != nullptr);

    // the recorded path is canonical and points at the file that was opened
    BOOST_CHECK(!lib.path().empty());
    BOOST_CHECK(lib.path().is_absolute());
    BOOST_CHECK(fs::exists(lib.path()));
    BOOST_CHECK(fs::equivalent(lib.path(), candidate.path));

    // an exported symbol resolves, a made-up one does not
    BOOST_CHECK(lib.resolve(candidate.symbol) != nullptr);
    BOOST_CHECK(lib.resolve("no_such_symbol_9f3a") == nullptr);

    BOOST_CHECK(lib.close());
    BOOST_CHECK(!lib.isOpen());
    BOOST_CHECK(lib.path().empty());
}

BOOST_AUTO_TEST_CASE(test_reopen) {
    auto candidate = system_library();
    if (candidate.path.empty()) {
        return;
    }

    // An already-open object is left alone and the second open fails, so the caller cannot
    // mistake the first library for the one it asked for.
    SharedLibrary lib;
    BOOST_REQUIRE(lib.open(candidate.path));
    auto first = lib.handle();
    BOOST_CHECK(!lib.open("no_such_library_9f3a.dll"));
    BOOST_CHECK(!lib.errorMessage().empty());
    BOOST_CHECK(lib.isOpen());
    BOOST_CHECK_EQUAL(lib.handle(), first);
    BOOST_CHECK(lib.resolve(candidate.symbol) != nullptr);

    // close() is what makes the swap possible
    BOOST_REQUIRE(lib.close());
    BOOST_REQUIRE(lib.open(candidate.path));
    BOOST_CHECK(lib.isOpen());

    // resolving on a closed object says so rather than leaving the last system error to speak
    SharedLibrary shut;
    BOOST_CHECK(shut.resolve(candidate.symbol) == nullptr);
    BOOST_CHECK(!shut.errorMessage().empty());

    // a call that succeeded leaves nothing behind, so an empty message means no failure
    BOOST_CHECK(lib.resolve(candidate.symbol) != nullptr);
    BOOST_CHECK(lib.errorMessage().empty());

    // and a missing symbol is reported by the system rather than by us
    BOOST_CHECK(lib.resolve("no_such_symbol_9f3a") == nullptr);
    BOOST_CHECK(!lib.errorMessage().empty());

    // opening the same library from two objects is fine, and both resolve
    SharedLibrary other;
    BOOST_REQUIRE(other.open(candidate.path));
    BOOST_CHECK(other.resolve(candidate.symbol) != nullptr);
    BOOST_CHECK(lib.resolve(candidate.symbol) != nullptr);
}

BOOST_AUTO_TEST_CASE(test_move) {
    auto candidate = system_library();
    if (candidate.path.empty()) {
        return;
    }

    // move construct: the destination takes over the handle
    // The moved-from object has no pimpl and must not be used again except for destruction or
    // assignment.
    {
        SharedLibrary source;
        BOOST_REQUIRE(source.open(candidate.path));
        auto handle = source.handle();
        auto path = source.path();

        SharedLibrary moved(std::move(source));
        BOOST_CHECK(moved.isOpen());
        BOOST_CHECK_EQUAL(moved.handle(), handle);
        BOOST_CHECK(moved.path() == path);
        BOOST_CHECK(moved.resolve(candidate.symbol) != nullptr);
    }

    // move assign
    {
        SharedLibrary source;
        BOOST_REQUIRE(source.open(candidate.path));
        auto handle = source.handle();

        SharedLibrary target;
        target = std::move(source);
        BOOST_CHECK(target.isOpen());
        BOOST_CHECK_EQUAL(target.handle(), handle);
        BOOST_CHECK(target.resolve(candidate.symbol) != nullptr);
    }
}

// What release() promises is that the destructor will not unload, and the case that used to
// stand for it opened libm, which the test process is holding open anyway. It passed whatever
// ownership did. This one asks the loader about a module nothing else here touches.
BOOST_AUTO_TEST_CASE(test_release_keeps_the_library_loaded) {
    BOOST_REQUIRE(fs::exists(unloadable()));
    BOOST_REQUIRE_MESSAGE(!still_loaded(unloadable()), "another case left this module loaded");

    // Ordinary ownership first, so the query is known to answer both ways.
    {
        SharedLibrary lib;
        BOOST_REQUIRE(lib.open(unloadable()));
        BOOST_CHECK(still_loaded(unloadable()));
    }
    BOOST_CHECK(!still_loaded(unloadable()));

    // Released and then destroyed, which is the whole of what release() is for.
    void *handle = nullptr;
    {
        SharedLibrary lib;
        BOOST_REQUIRE(lib.open(unloadable()));
        handle = lib.handle();
        lib.release();
    }
    BOOST_CHECK(still_loaded(unloadable()));

    // The handle is still good, since nobody closed it.
    SharedLibrary again;
    BOOST_REQUIRE(again.open(unloadable()));
    BOOST_CHECK(again.handle() == handle);
    BOOST_CHECK(again.resolve("test_sharedlibrary_unloadable_answer") != nullptr);
    BOOST_CHECK(again.close());

    // Two references were taken and one was given back, so it is still there. The one release()
    // gave up is given back here so the rest of the binary starts from where it began.
#ifdef _WIN32
    BOOST_CHECK(::FreeLibrary(static_cast<HMODULE>(handle)));
#else
    BOOST_CHECK_EQUAL(::dlclose(handle), 0);
#endif
    BOOST_CHECK(!still_loaded(unloadable()));
}

// PreventUnloadHint said it was ignored only where the platform has no equivalent, and glibc
// has RTLD_NODELETE, so on Linux it was being ignored where there is one. Its own module: a
// module that was pinned stays for the life of the process, which is the point of it.
BOOST_AUTO_TEST_CASE(test_preventing_the_unload_keeps_it_after_the_object_is_gone) {
    BOOST_REQUIRE(fs::exists(pinned()));
    BOOST_REQUIRE_MESSAGE(!still_loaded(pinned()), "another case left this module loaded");

    {
        SharedLibrary lib;
        BOOST_REQUIRE(lib.open(pinned(), SharedLibrary::PreventUnloadHint));
        BOOST_CHECK(lib.resolve("test_sharedlibrary_unloadable_answer") != nullptr);
    }
    BOOST_CHECK(still_loaded(pinned()));

    // And closing it by hand does not take it away either, which is the same promise said the
    // other way round.
    {
        SharedLibrary lib;
        BOOST_REQUIRE(lib.open(pinned(), SharedLibrary::PreventUnloadHint));
        BOOST_CHECK(lib.close());
        BOOST_CHECK(!lib.isOpen());
        BOOST_CHECK(lib.path().empty());
        BOOST_CHECK(lib.handle() == nullptr);
    }
    BOOST_CHECK(still_loaded(pinned()));
}

// A module whose own dependency sits beside it, in a directory the loader is given no other
// reason to look in. The two are built into a directory of their own rather than next to the
// test binary, or the dependency would be found through the application directory and the case
// would pass whatever the hint did.
BOOST_AUTO_TEST_CASE(test_searching_the_directory_the_library_came_from) {
    BOOST_REQUIRE(fs::exists(needsDependency()));

    {
        SharedLibrary lib;
        const bool opened =
            lib.open(needsDependency(), SharedLibrary::SearchLibraryLoadDirectoryHint);
        BOOST_REQUIRE_MESSAGE(opened, lib.errorMessage());
        auto answer = reinterpret_cast<int (*)()>(lib.resolve("test_sharedlibrary_needs_dependency_answer"));
        BOOST_REQUIRE(answer != nullptr);
        BOOST_CHECK_EQUAL(answer(), 7); // reached through the dependency
    }

#ifdef _WIN32
    // Without it the loader never looks there, so the dependency is missing and the module does
    // not load. This is the half that says the hint is doing something.
    {
        SharedLibrary lib;
        BOOST_CHECK(!lib.open(needsDependency()));
        BOOST_CHECK(!lib.errorMessage().empty());
    }
#else
    // POSIX finds it either way, through the $ORIGIN the module was linked with, so what the
    // case asks here is that the hint changes nothing rather than that it is needed.
    {
        SharedLibrary lib;
        BOOST_REQUIRE_MESSAGE(lib.open(needsDependency()), lib.errorMessage());
        BOOST_CHECK(lib.resolve("test_sharedlibrary_needs_dependency_answer") != nullptr);
    }
#endif
}

// Released and then closed by hand, which is the other half: close() forgets the handle rather
// than unloading it, and the object is empty afterwards either way.
BOOST_AUTO_TEST_CASE(test_release_then_close_forgets_without_unloading) {
    BOOST_REQUIRE(!still_loaded(unloadable()));

    SharedLibrary lib;
    BOOST_REQUIRE(lib.open(unloadable()));
    void *handle = lib.handle();
    lib.release();

    BOOST_CHECK(lib.close());
    BOOST_CHECK(!lib.isOpen());
    BOOST_CHECK(lib.path().empty());
    BOOST_CHECK(lib.handle() == nullptr);
    BOOST_CHECK(still_loaded(unloadable()));

#ifdef _WIN32
    BOOST_CHECK(::FreeLibrary(static_cast<HMODULE>(handle)));
#else
    BOOST_CHECK_EQUAL(::dlclose(handle), 0);
#endif
    BOOST_CHECK(!still_loaded(unloadable()));
}

// The path a caller gave is not the path that comes back: it is made absolute so it does not
// depend on where the process is standing, and tidied where the filesystem will tidy it. Both
// used to go through the throwing overloads, inside a function that answers with a bool and a
// reason, in a library three of whose builds have exceptions turned off.
BOOST_AUTO_TEST_CASE(test_the_path_that_comes_back_is_absolute) {
    auto here = fs::current_path();
    auto guard = stdc::make_scope_guard([&] {
        std::error_code ignored;
        fs::current_path(here, ignored);
    });

    // Named the way somebody standing next to it would name it.
    fs::current_path(unloadable().parent_path());
    auto relative = unloadable().filename();
    BOOST_REQUIRE(relative.is_relative());

    SharedLibrary lib;
    BOOST_REQUIRE_MESSAGE(lib.open(relative), lib.errorMessage());
    BOOST_CHECK(lib.path().is_absolute());
    BOOST_CHECK(fs::equivalent(lib.path(), unloadable()));
    BOOST_CHECK(lib.resolve("test_sharedlibrary_unloadable_answer") != nullptr);
    BOOST_CHECK(lib.close());
}

// isLibrary() is a name check: it never looks at the filesystem.
BOOST_AUTO_TEST_CASE(test_is_library) {
#if defined(_WIN32)
    BOOST_CHECK(SharedLibrary::isLibrary("foo.dll"));
    BOOST_CHECK(SharedLibrary::isLibrary("C:\\dir\\foo.DLL")); // case insensitive
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.exe"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo"));
    BOOST_CHECK(!SharedLibrary::isLibrary(""));
#elif defined(__APPLE__)
    BOOST_CHECK(SharedLibrary::isLibrary("foo.dylib"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo"));
#else
    BOOST_CHECK(SharedLibrary::isLibrary("foo.so"));
    BOOST_CHECK(SharedLibrary::isLibrary("libfoo.so.6"));     // versioned
    BOOST_CHECK(SharedLibrary::isLibrary("libfoo.so.1.2.3")); // multi-part version
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so.beta"));    // not a version
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so1"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so.1."));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.so..1"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo.dll"));
    BOOST_CHECK(!SharedLibrary::isLibrary("foo"));
#endif
}

BOOST_AUTO_TEST_CASE(test_locate_library_path) {
    BOOST_CHECK(SharedLibrary::locateLibraryPath(nullptr).empty());

    auto candidate = system_library();
    if (candidate.path.empty()) {
        return;
    }

    SharedLibrary lib;
    BOOST_REQUIRE(lib.open(candidate.path));

    // an address inside the library maps back to the file it came from
    auto *symbol = lib.resolve(candidate.symbol);
    BOOST_REQUIRE(symbol != nullptr);

    auto located = SharedLibrary::locateLibraryPath(symbol);
    BOOST_CHECK(!located.empty());
    if (!located.empty()) {
        BOOST_CHECK(fs::equivalent(located, candidate.path));
    }
}

// A process-wide setting that hands back what it replaced, which is the whole reason it is a
// getter as well as a setter. Nothing had ever called it, so nothing had said the returned path
// is the old one rather than the new.
BOOST_AUTO_TEST_CASE(test_setting_the_library_path_gives_back_the_old_one) {
    auto original = SharedLibrary::setLibraryPath(std::filesystem::path());

    // Restored whatever this case does, since the setting outlives it.
    auto guard = stdc::make_scope_guard([&] { SharedLibrary::setLibraryPath(original); });

    auto first = std::filesystem::temp_directory_path();
    auto wasEmpty = SharedLibrary::setLibraryPath(first);
    BOOST_CHECK(wasEmpty.empty());

    // The second call answers with the first path, not the second.
    auto second = std::filesystem::temp_directory_path() / "elsewhere";
    auto wasFirst = SharedLibrary::setLibraryPath(second);
    BOOST_CHECK(wasFirst == first);

    // And putting the empty path back reports the one that was in force.
    auto wasSecond = SharedLibrary::setLibraryPath(std::filesystem::path());
    BOOST_CHECK(wasSecond == second);

#ifndef _WIN32
    // What the empty path leaves behind, which is the whole of what a caller does with the
    // value this hands out. Set to nothing and never set both come back empty, so unless the
    // empty path takes the variable away, a process that started without one can never be put
    // back the way it was.
    BOOST_CHECK(std::getenv(PriorLibraryPathKey) == nullptr);

    SharedLibrary::setLibraryPath(first);
    BOOST_REQUIRE(std::getenv(PriorLibraryPathKey) != nullptr);
    SharedLibrary::setLibraryPath(std::filesystem::path());
    BOOST_CHECK(std::getenv(PriorLibraryPathKey) == nullptr);
#endif
}

// What it is worth differs by platform, and the header says so rather than promising one thing
// three times. This is the half that can be asked from here: on Windows the setting is the
// loader's own and takes effect for what this process loads next, and on Linux it is an
// environment variable the loader read before main and will not read again.
BOOST_AUTO_TEST_CASE(test_what_the_library_path_reaches) {
    auto original = SharedLibrary::setLibraryPath(std::filesystem::path());
    auto guard = stdc::make_scope_guard([&] { SharedLibrary::setLibraryPath(original); });

    auto dir = std::filesystem::temp_directory_path();
    SharedLibrary::setLibraryPath(dir);

#ifdef _WIN32
    // The loader was told, and it is the loader that answers.
    wchar_t buf[4096] = {};
    DWORD n = ::GetDllDirectoryW(DWORD(std::size(buf)), buf);
    BOOST_REQUIRE(n > 0);
    BOOST_CHECK(std::filesystem::path(std::wstring(buf, n)) == dir);
#else
    // The variable was set, and that is all that happened. Nothing here can show the loader
    // ignoring it, since a dependency search that already succeeded would succeed either way.
    const char *env = std::getenv(PriorLibraryPathKey);
    BOOST_REQUIRE(env != nullptr);
    BOOST_CHECK(std::filesystem::path(env) == dir);
#endif
}

BOOST_AUTO_TEST_SUITE_END()

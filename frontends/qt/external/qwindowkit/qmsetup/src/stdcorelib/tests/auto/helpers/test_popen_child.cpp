// SPDX-License-Identifier: MIT

// A child process for the Popen tests to start.
//
// The shell can stand in for most of what a child has to do, but not for all of it. It cannot
// report the argument vector it was handed, because the shell parses the command line again
// before the program sees it, and on Windows that is the one thing worth checking. It also
// cannot write a known number of bytes quickly enough for a test that wants two pipes full.
//
// Deliberately built against nothing but the standard library, so a defect in stdcorelib cannot
// be hidden by the same defect on both sides of the pipe.

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#ifdef _WIN32
#  include <fcntl.h>
#  include <io.h>
#endif

namespace {

    // Byte counts have to come back exactly, so nothing may rewrite a newline on the way out.
    void use_binary_streams() {
#ifdef _WIN32
        _setmode(_fileno(stdout), _O_BINARY);
        _setmode(_fileno(stderr), _O_BINARY);
        _setmode(_fileno(stdin), _O_BINARY);
#endif
    }

    int usage() {
        std::fputs("usage: test_popen_child arg0|argv|exit|fill|cat ...\n", stderr);
        return 2;
    }

    void fill(FILE *stream, long bytes) {
        static const char block[] =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde\n";
        const size_t size = sizeof(block) - 1;
        long written = 0;
        while (written < bytes) {
            size_t n = size_t(bytes - written) < size ? size_t(bytes - written) : size;
            if (std::fwrite(block, 1, n, stream) != n) {
                return;
            }
            written += long(n);
        }
        std::fflush(stream);
    }

}

int main(int argc, char *argv[]) {
    use_binary_streams();
    if (argc < 2) {
        return usage();
    }

    std::string mode = argv[1];

    // The name this process was given, which is not the file it was loaded from when the parent
    // set those apart.
    if (mode == "arg0") {
        std::fwrite(argv[0], 1, std::strlen(argv[0]), stdout);
        std::fputc('\n', stdout);
        std::fflush(stdout);
        return 0;
    }

    // Every argument after the mode, one per line. What arrives here is what the parent's
    // quoting produced and the runtime parsed back.
    if (mode == "argv") {
        for (int i = 2; i < argc; ++i) {
            std::fwrite(argv[i], 1, std::strlen(argv[i]), stdout);
            std::fputc('\n', stdout);
        }
        std::fflush(stdout);
        return 0;
    }

    if (mode == "exit") {
        return argc > 2 ? std::atoi(argv[2]) : 0;
    }

    // Bytes on stdout, on stderr, or the same count on both at once. The last of those is what
    // fills two pipes together, which is the case a reader draining one at a time deadlocks on.
    if (mode == "fill") {
        long bytes = argc > 2 ? std::atol(argv[2]) : 0;
        std::string where = argc > 3 ? argv[3] : "out";
        if (where == "out") {
            fill(stdout, bytes);
        } else if (where == "err") {
            fill(stderr, bytes);
        } else if (where == "both") {
            // Interleaved in small pieces, so neither pipe is drained to the end before the
            // other one is written to.
            const long piece = 4096;
            for (long done = 0; done < bytes; done += piece) {
                long n = bytes - done < piece ? bytes - done : piece;
                fill(stdout, n);
                fill(stderr, n);
            }
        } else {
            return usage();
        }
        return 0;
    }

    // Copies stdin to stdout and finishes at end of input, so a parent that never closes its
    // end of the pipe waits forever.
    if (mode == "cat") {
        char buf[8192];
        size_t n;
        while ((n = std::fread(buf, 1, sizeof(buf), stdin)) > 0) {
            std::fwrite(buf, 1, n, stdout);
        }
        std::fflush(stdout);
        return 0;
    }

    return usage();
}

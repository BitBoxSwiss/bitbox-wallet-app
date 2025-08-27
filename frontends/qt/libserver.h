#ifndef BACKEND_H
#define BACKEND_H
#include <string.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>

// Workaround to be able to use `const char*` as a param type in the exported Go functions.
typedef const char cchar_t;

typedef void (*pushNotificationsCallback) (const char*);
static void pushNotify(pushNotificationsCallback f, const char* msg) {
    f(msg);
}

typedef void (*responseCallback) (int, const char*);
static void respond(responseCallback f, int queryID, const char* msg) {
    f(queryID, msg);
}

typedef void (*notifyUserCallback) (const char*);
static void notifyUser(notifyUserCallback f, const char* msg) {
    f(msg);
}

typedef char* (*getSaveFilenameCallback) (const char*);
static char* getSaveFilename(getSaveFilenameCallback f, const char* suggestedfilename) {
    return f(suggestedfilename);
}

// equivalent to C.free but suitable for releasing a memory malloc'ed
// in a non-posix portable environment, incompatible with cgo.
// this is especially important on windows where the standard C runtime
// memory management used by cgo and mingw is different from win32 API used
// when compiling C++ code with MSVC. hence, the memory allocated with malloc
// in C++ must always be freed by this function in Go instead of C.free.
typedef void (*cppHeapFree) (void* ptr);
static void customHeapFree(cppHeapFree f, void* ptr) {
	f(ptr);
}

#endif

#ifdef __cplusplus
extern "C" {
#endif

extern void backendCall(int queryID, cchar_t* s);
extern void setOnline(bool online);
extern void handleURI(cchar_t* uri);
extern void serve(cppHeapFree cppHeapFreeFn, pushNotificationsCallback pushNotificationsFn, responseCallback responseFn, notifyUserCallback notifyUserFn, cchar_t* preferredLocale, getSaveFilenameCallback getSaveFilenameFn);
extern void systemOpen(cchar_t* url);
extern void goLog(cchar_t* msg);
extern void backendShutdown();
#ifdef __cplusplus
}
#endif

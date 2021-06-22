#ifndef BACKEND_H
#define BACKEND_H
#include <string.h>
#include <stdint.h>

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
#endif

#ifdef __cplusplus
extern "C" {
#endif


extern void backendCall(int p0, char* p1);

extern void handleURI(char* p0);

extern void serve(
    pushNotificationsCallback p0,
    responseCallback p1,
    notifyUserCallback p2,
    const char* preferredLocale
);

extern void systemOpen(char* p0);

#ifdef __cplusplus
}
#endif

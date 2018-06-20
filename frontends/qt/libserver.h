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

typedef struct ConnectionData {
    char* token;
} ConnectionData;
#endif

#ifdef __cplusplus
extern "C" {
#endif


extern void backendCall(int p0, char* p1);

extern struct ConnectionData serve(pushNotificationsCallback p0, responseCallback p1);

#ifdef __cplusplus
}
#endif

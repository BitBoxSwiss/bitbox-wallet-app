/* The SDK plugin that drags in a library the application never linked. */
#include "fixture.h"

int qmtest_sdk_alone_value(void);

QMTEST_EXPORT int qmtest_sdk_plugin_alone_entry(void) {
    return qmtest_sdk_alone_value();
}

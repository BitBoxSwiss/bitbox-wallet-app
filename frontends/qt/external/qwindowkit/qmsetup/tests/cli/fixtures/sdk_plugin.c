/* One of the SDK's plugins, which a deployment has to bring along
   even though nothing links it. */
#include "fixture.h"

int qmtest_sdk_lib_value(void);

QMTEST_EXPORT int qmtest_sdk_plugin_entry(void) {
    return qmtest_sdk_lib_value();
}

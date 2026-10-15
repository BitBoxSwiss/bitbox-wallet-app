/* A plugin of the application's that reaches past its own tree into the SDK. */
#include "fixture.h"

int qmtest_sdk_lib_value(void);

QMTEST_EXPORT int qmtest_app_plugin_sdk_entry(void) {
    return qmtest_sdk_lib_value();
}

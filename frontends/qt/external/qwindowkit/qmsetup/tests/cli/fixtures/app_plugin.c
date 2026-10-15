/* A plugin of the application's, over what it already carries. */
#include "fixture.h"

int qmtest_app_lib_value(void);

QMTEST_EXPORT int qmtest_app_plugin_entry(void) {
    return qmtest_app_lib_value();
}

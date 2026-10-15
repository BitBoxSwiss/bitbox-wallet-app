/* The SDK's main library, and the way into its tree. */
#include "fixture.h"

int qmtest_sdk_leaf_value(void);

QMTEST_EXPORT int qmtest_sdk_lib_value(void) {
    return qmtest_sdk_leaf_value() + 1;
}

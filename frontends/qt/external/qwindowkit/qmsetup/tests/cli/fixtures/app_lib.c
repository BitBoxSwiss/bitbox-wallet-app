/* Links app_leaf of its own tree and sdk_lib of the other, which is what
   drags the SDK into this deployment. */
#include "fixture.h"

int qmtest_app_leaf_value(void);
int qmtest_sdk_lib_value(void);

QMTEST_EXPORT int qmtest_app_lib_value(void) {
    return qmtest_app_leaf_value() + qmtest_sdk_lib_value();
}

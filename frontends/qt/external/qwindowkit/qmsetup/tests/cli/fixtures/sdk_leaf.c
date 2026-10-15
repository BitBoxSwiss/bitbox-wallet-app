/* A leaf of the SDK's tree, reached only through sdk_lib. */
#include "fixture.h"

QMTEST_EXPORT int qmtest_sdk_leaf_value(void) {
    return 10;
}

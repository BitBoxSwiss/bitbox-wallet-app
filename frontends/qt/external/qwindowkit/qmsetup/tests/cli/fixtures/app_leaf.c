/* A leaf of the application's tree, reached only through app_lib. */
#include "fixture.h"

QMTEST_EXPORT int qmtest_app_leaf_value(void) {
    return 1;
}

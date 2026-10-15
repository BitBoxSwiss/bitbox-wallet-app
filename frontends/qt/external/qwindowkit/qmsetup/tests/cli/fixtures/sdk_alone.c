/* Nothing the application links reaches this one. It arrives only
   because a plugin was named, which is the whole reason plugin deployment
   cannot be worked out from the dependency graph alone. */
#include "fixture.h"

QMTEST_EXPORT int qmtest_sdk_alone_value(void) {
    return 100;
}

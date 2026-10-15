#include "fixture.h"

/* Inside a real macOS framework bundle, so that a deployment has to carry the
   bundle across rather than a file.

   It needs another framework and an ordinary library, so that resolving it is
   not the end of the walk. Reaching either of them means going into this bundle
   for the library, reading what that names, and coming back out. */
QMTEST_EXPORT int qmtest_fw_deep_value(void);
QMTEST_EXPORT int qmtest_fw_plain_value(void);

QMTEST_EXPORT int qmtest_fw_lib_value(void) {
    return qmtest_fw_deep_value() + qmtest_fw_plain_value();
}

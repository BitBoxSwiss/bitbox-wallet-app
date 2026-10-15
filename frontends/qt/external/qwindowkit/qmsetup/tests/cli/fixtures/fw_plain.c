#include "fixture.h"

/* An ordinary shared library that a framework needs, so that the walk leaves
   bundles as well as entering them. */
QMTEST_EXPORT int qmtest_fw_plain_value(void) { return 13; }

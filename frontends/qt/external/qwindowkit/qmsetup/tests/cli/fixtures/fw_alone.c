#include "fixture.h"

/* In a framework bundle that nothing links, so no amount of following the
   dependency graph arrives at it. It comes along only when -c names it, which
   is the whole reason -c exists. */
QMTEST_EXPORT int qmtest_fw_alone_value(void) { return 9; }

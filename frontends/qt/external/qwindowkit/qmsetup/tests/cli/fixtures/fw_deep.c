#include "fixture.h"

/* A framework reached only through another framework. The walk has to go from a
   bundle to the library inside it, read that library, and come back out to a
   bundle again, which is the one thing a single level of framework never
   exercises. */
QMTEST_EXPORT int qmtest_fw_deep_value(void) { return 11; }

#include "fixture.h"

QMTEST_EXPORT int qmtest_fw_lib_value(void);

/* Links the framework, and is what a deployment is pointed at. */
int main(void) { return qmtest_fw_lib_value() - 7; }

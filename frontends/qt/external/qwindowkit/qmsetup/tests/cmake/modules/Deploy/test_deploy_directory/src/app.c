#include "lib.h"

QMTEST_EXPORT int qmtest_extra_value(void);

int main(void) { return qmtest_extra_value() - 2; }

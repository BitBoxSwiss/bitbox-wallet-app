#include "lib.h"

// Stands in for a Qt plugin: linked by nothing, loaded by name at run time, and
// found only because PLUGINS named it and EXTRA_PLUGIN_PATHS said where to look.
QMTEST_EXPORT int qmtest_svgicon_value(void) { return 8; }

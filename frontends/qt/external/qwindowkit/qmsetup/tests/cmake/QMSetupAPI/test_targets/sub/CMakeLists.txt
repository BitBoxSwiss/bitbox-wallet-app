# A subdirectory with targets in it, for qm_collect_targets to walk down into.

add_library(qmtest_sub_static STATIC sub.c)
add_library(qmtest_sub_shared SHARED sub.c)

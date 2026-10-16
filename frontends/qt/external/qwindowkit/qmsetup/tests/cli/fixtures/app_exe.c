/* The application. Links app_lib alone, so everything else is reached only
   by following it. */

int qmtest_app_lib_value(void);

int main(void) {
    return qmtest_app_lib_value() > 0 ? 0 : 1;
}

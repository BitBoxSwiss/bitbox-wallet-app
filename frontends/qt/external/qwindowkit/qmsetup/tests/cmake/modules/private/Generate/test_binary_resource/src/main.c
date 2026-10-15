#include <stddef.h>
#include <string.h>

extern unsigned char embedded_data_c[];
extern unsigned int embedded_data_c_len;

int main(void) {
    static const unsigned char expected[] = "QMSetup binary resource";

    if (embedded_data_c_len != sizeof(expected) - 1) {
        return 1;
    }

    return memcmp(embedded_data_c, expected, sizeof(expected) - 1) == 0 ? 0 : 2;
}

// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_STR_P_H
#define STDCORELIB_STR_P_H

#include <stdcorelib/str.h>

#include <stdcorelib/adt/vlarray.h>

namespace stdc::str {

    enum class varexp_part_type {
        literal,
        literal_with_dollar,
        variable,
        nested_variable,
    };

    struct varexp_part {
        varexp_part_type type;
        const char *data;
        size_t size;
    };

    STDC_DECL_HIDDEN bool varexp_split(const std::string_view &s,
                                       vlarray_base<varexp_part> &result);

    STDC_DECL_HIDDEN std::string varexp_post(const std::string_view &s);

}

#endif // STDCORELIB_STR_P_H

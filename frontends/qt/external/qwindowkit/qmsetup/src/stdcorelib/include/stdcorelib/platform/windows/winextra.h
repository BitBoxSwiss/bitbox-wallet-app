// SPDX-License-Identifier: MIT

#ifndef STDCORELIB_WINEXTRA_H
#define STDCORELIB_WINEXTRA_H

#include "stdc_windows.h"

#include <string>
#include <chrono>

#include <stdcorelib/stdc_global.h>

namespace stdc::windows {

    /// \addtogroup platform
    /// @{

    STDC_EXPORT std::wstring systemError(DWORD errorCode, DWORD languageId = 0);

    STDC_EXPORT RTL_OSVERSIONINFOW systemVersion();

    STDC_EXPORT std::chrono::system_clock::time_point fileTimeToTimePoint(const FILETIME &ft);

    STDC_EXPORT FILETIME timePointToFileTime(const std::chrono::system_clock::time_point &tp);

    /// @}
}

#endif // STDCORELIB_WINEXTRA_H

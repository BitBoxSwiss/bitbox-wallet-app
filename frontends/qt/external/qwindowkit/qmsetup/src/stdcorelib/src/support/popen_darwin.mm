// SPDX-License-Identifier: MIT

#include "popen.h"
#include "popen_p.h"

#import <CoreFoundation/CoreFoundation.h>
#import <Foundation/Foundation.h>

#include "str.h"
#include "system.h"
#include "utf.h"

namespace stdc {

    static std::string NSStringToString(NSString *string) {
        if (!string)
            return {};
        std::u16string u16;
        u16.resize([string length]);
        [string getCharacters:reinterpret_cast<unichar *>(u16.data())
                        range:NSMakeRange(0, [string length])];
        return utf::utf16_to_utf8(u16);
    }

    namespace system {

        std::map<std::string, std::string> environment() {
            __block std::map<std::string, std::string> env;
            [[[NSProcessInfo processInfo] environment]
                enumerateKeysAndObjectsUsingBlock:^(NSString *name, NSString *value,
                                                    BOOL *__unused stop) {
                    env.insert(std::make_pair(NSStringToString(name), NSStringToString(value)));
                }];
            return env;
        }

    }

}

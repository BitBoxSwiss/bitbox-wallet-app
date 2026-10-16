// SPDX-License-Identifier: MIT

#include "systempaths.h"

#import <Foundation/Foundation.h>

namespace fs = std::filesystem;

namespace stdc::system {

    static std::optional<fs::path> fromNSString(NSString *value) {
        if (!value) {
            return std::nullopt;
        }

        const char *rawPath = value.fileSystemRepresentation;
        if (!rawPath || !*rawPath) {
            return std::nullopt;
        }

        fs::path path(rawPath);
        if (!path.is_absolute()) {
            return std::nullopt;
        }
        return path;
    }

    static NSString *searchPath(NSSearchPathDirectory directory) {
        NSArray<NSString *> *paths =
            NSSearchPathForDirectoriesInDomains(directory, NSUserDomainMask, YES);
        return paths.firstObject;
    }

    std::optional<fs::path> SystemPaths::writableDirectory(Directory directory) {
        @autoreleasepool {
            switch (directory) {
                case HomeDirectory:
                    return fromNSString(NSHomeDirectory());
                case TempDirectory:
                    return fromNSString(NSTemporaryDirectory());
                case ConfigDirectory:
                    return fromNSString([searchPath(NSLibraryDirectory)
                        stringByAppendingPathComponent:@"Preferences"]);
                case AppDataDirectory:
                    return fromNSString(searchPath(NSApplicationSupportDirectory));
                case CacheDirectory:
                    return fromNSString(searchPath(NSCachesDirectory));
                case StateDirectory:
                    return fromNSString([[searchPath(NSLibraryDirectory)
                        stringByAppendingPathComponent:@"Preferences"]
                        stringByAppendingPathComponent:@"State"]);
            }
        }
        return std::nullopt;
    }

}

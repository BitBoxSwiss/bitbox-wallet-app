// SPDX-License-Identifier: Apache-2.0

#ifndef NETWORK_H
#define NETWORK_H
#include <stdbool.h>

// setupReachabilityNotifier connects to the QNetworkInformation::reachabilityChanged signal
// in otder to react to changes in reachability.
void setupReachabilityNotifier();
// isReachable uses QNetworkInformation to retrieve info about the online status.
// Note: it treats cases in which QT can't determine if we are online as if we were.
bool isReachable();

#endif // NETWORK_H

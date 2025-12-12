// SPDX-License-Identifier: Apache-2.0

#include <QNetworkInformation>
#include "libserver.h"
#include "network.h"

void setupReachabilityNotifier() {
    auto loaded = QNetworkInformation::loadBackendByFeatures(QNetworkInformation::Feature::Reachability);
    if (!loaded) {
        goLog("can't load QNetworkInformation backend");
        // If we can't load the backend, we can't determine whether or not to show the banner.
        setOnline(true);
        return;
    }
    QNetworkInformation* info = QNetworkInformation::instance();
    if (info) {
      QObject::connect(info, &QNetworkInformation::reachabilityChanged, [](QNetworkInformation::Reachability reachability){
          // We include Reachability::Unknown, Reachability::Site, etc here as we prefer not include
          // false positives. If QT can't determine whether we are online, we do not show the
          // banner.
          bool isReachable = reachability != QNetworkInformation::Reachability::Disconnected;
          setOnline(isReachable);
      });
    }
}

bool isReachable() {
    auto loaded = QNetworkInformation::loadBackendByFeatures(QNetworkInformation::Feature::Reachability);
    if (!loaded) {
        goLog("can't load QNetworkInformation backend");
        return true;
    }
    QNetworkInformation* info = QNetworkInformation::instance();
    if (info) {
        return info->reachability() != QNetworkInformation::Reachability::Disconnected;
    }
    // Same as above, if we can't obtain information, we don't show any banner at all.
    return true;
}

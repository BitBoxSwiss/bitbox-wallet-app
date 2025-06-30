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
          // We include Reachability::Unknown here as we prefer not include false positives. If QT can't determine whether
          // we are online, we do not show the banner.
          bool isReachable = (reachability == QNetworkInformation::Reachability::Online || reachability == QNetworkInformation::Reachability::Unknown);
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
        return info->reachability() == QNetworkInformation::Reachability::Online || info->reachability() == QNetworkInformation::Reachability::Unknown;
    }
    // Same as above, if we can't obtain information, we don't show any banner at all.
    return true;
}

#include <QNetworkInformation>
#include "libserver.h"

void setupReachabilityNotifier() {
    auto loaded = QNetworkInformation::loadBackendByFeatures(QNetworkInformation::Feature::Reachability);
    if (!loaded) {
        return;
    }
    QNetworkInformation* info = QNetworkInformation::instance();
    if (info) {
      QObject::connect(info, &QNetworkInformation::reachabilityChanged, [](QNetworkInformation::Reachability reachability){
        bool isReachable = (reachability == QNetworkInformation::Reachability::Online);
        onlineStatusChanged(isReachable);
      });
    }
}

bool isReachable() {
    auto loaded = QNetworkInformation::loadBackendByFeatures(QNetworkInformation::Feature::Reachability);
    if (!loaded) {
        return false;
    }
    QNetworkInformation* info = QNetworkInformation::instance();
    if (info) {
        return info->reachability() == QNetworkInformation::Reachability::Online;
    } else {
        return false;
    }
}

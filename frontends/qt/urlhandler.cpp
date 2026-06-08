// SPDX-License-Identifier: Apache-2.0

#include "urlhandler.h"
#include "libserver.h"

#include <iostream>
#include <QDesktopServices>

UrlHandler::UrlHandler(QObject *parent) : QObject(parent) {
}

void UrlHandler::setup() {
    // This is only supported on macOS and is used to handle URIs that are opened with
    // the BitBoxApp using "aopp:..." links. The event is received and handled both
    // if the BitBoxApp is launched and also when it is already running, in which case
    // it is brought to the foreground automatically.
    QDesktopServices::setUrlHandler("aopp", this, "handleUrlSlot");
}

void UrlHandler::handleUrlSlot(const QUrl &url) {
    handleURI(url.toString().toUtf8().constData());
}

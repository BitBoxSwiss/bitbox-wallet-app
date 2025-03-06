// Copyright 2025 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

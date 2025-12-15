// SPDX-License-Identifier: Apache-2.0

#ifndef URLHANDLER_H
#define URLHANDLER_H

#include <QObject>
#include <QUrl>

class UrlHandler : public QObject {
    Q_OBJECT

public:
    UrlHandler(QObject *parent = nullptr);

    void setup();

public slots:
    void handleUrlSlot(const QUrl &url);
};

#endif // URLHANDLER_H

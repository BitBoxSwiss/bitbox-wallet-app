// SPDX-License-Identifier: Apache-2.0

#include <QApplication>

#include "libserver.h"

class WebClass : public QObject
{
    Q_OBJECT
public slots:
    void call(int queryID, const QString& query) {
        backendCall(queryID, query.toUtf8().constData());
    }
signals:
    void gotResponse(int queryID, QString response);
    void pushNotify(QString msg);
};

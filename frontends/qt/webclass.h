// Copyright 2021 Shift Crypto AG
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

#include <QApplication>

#include "server/libserver.h"

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

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

#include "filedialog.h"

#include <QFileDialog>
#include <QCoreApplication>
#include <QString>
#include <QThread>
#include <QWidget>

FileDialogCaller::FileDialogCaller(QObject* parent) : QObject(parent) {
    // The helper object will live in the GUI thread
    moveToThread(QCoreApplication::instance()->thread());
}

QString FileDialogCaller::getSaveFileName(QWidget* parent, const QString& caption, const QString& dir) {
    QString fileName;

    // Not in GUI thread
    if (QThread::currentThread() != QCoreApplication::instance()->thread()->thread()) {
        QMetaObject::invokeMethod(this, "getSaveFileName_", Qt::BlockingQueuedConnection,
                                  Q_RETURN_ARG(QString, fileName),
                                  Q_ARG(QWidget*, parent),
                                  Q_ARG(QString, caption),
                                  Q_ARG(QString, dir));
    } else { // in GUI thread, direct call
        fileName = getSaveFileName_(parent, caption, dir);
    }

    return fileName;
}

QString FileDialogCaller::getSaveFileName_(QWidget* parent, const QString& caption, const QString& dir) {
    return QFileDialog::getSaveFileName(parent, caption, dir);
}

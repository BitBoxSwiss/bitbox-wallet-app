// SPDX-License-Identifier: Apache-2.0

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

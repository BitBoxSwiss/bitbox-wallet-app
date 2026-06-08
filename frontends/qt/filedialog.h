// SPDX-License-Identifier: Apache-2.0

#include <QObject>
#include <QString>
#include <QWidget>

// A class wrapping QFileDialog so it can be forced to the GUI thread. If QFileDialog is used
// outside the GUI thread, there can be segfaults/crashes.
// Based on: https://stackoverflow.com/a/47092405
class FileDialogCaller : public QObject {
    Q_OBJECT

public:
    FileDialogCaller(QObject* parent = 0);

    QString getSaveFileName(QWidget* parent, const QString& caption, const QString& dir);

private:
    Q_INVOKABLE
    QString getSaveFileName_(QWidget* parent, const QString& caption, const QString& dir);
};

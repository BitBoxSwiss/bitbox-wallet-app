// SPDX-License-Identifier: Apache-2.0

#include <QApplication>
#include <QFileDialog>
#include <QPointer>
#include <QSaveFile>

#include "libserver.h"

class WebClass : public QObject
{
    Q_OBJECT
public:
    explicit WebClass(QWidget *window) : window_(window) {}
public slots:
    void call(int queryID, const QString& query) {
        backendCall(queryID, query.toUtf8().constData());
    }
    QString saveAppearancePreset(const QString &contents, const QString &caption) {
        const auto bytes = contents.toUtf8();
        if (!window_ || bytes.size() > 64 * 1024) return "error";
        const auto filename = QFileDialog::getSaveFileName(window_, caption.left(200), "bitbox-design.json", "JSON (*.json)");
        if (filename.isEmpty()) return "cancelled";
        QSaveFile file(filename);
        if (!file.open(QIODevice::WriteOnly) || file.write(bytes) != bytes.size() || !file.commit()) return "error";
        return "saved";
    }
signals:
    void gotResponse(int queryID, QString response);
    void pushNotify(QString msg);
private:
    QPointer<QWidget> window_;
};

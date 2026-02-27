// SPDX-License-Identifier: Apache-2.0

#include <QApplication>
#include <QWidget>
#include <QWindow>
#include <QJsonDocument>
#include <QJsonObject>

#include "libserver.h"

class WebClass : public QObject
{
    Q_OBJECT
private:
    QWidget* m_window;

public:
    WebClass() : m_window(nullptr) {}

    void setWindow(QWidget* window) {
        m_window = window;
    }

public slots:
    void call(int queryID, const QString& query) {
        // Check for window control actions
        QJsonDocument doc = QJsonDocument::fromJson(query.toUtf8());
        if (!doc.isNull() && doc.isObject()) {
            QJsonObject obj = doc.object();
            QString action = obj.value("action").toString();

            // Window control actions - WebChannel callbacks run on the main thread,
            // so we can call GUI methods directly without QMetaObject::invokeMethod.
            // We emit gotResponse to resolve the frontend Promise and prevent memory leaks.
            if (action == "windowMinimize") {
                if (m_window) {
                    m_window->showMinimized();
                }
                emit gotResponse(queryID, QStringLiteral("{\"success\":true}"));
                return;
            }
            if (action == "windowMaximize") {
                if (m_window) {
                    if (m_window->isMaximized()) {
                        m_window->showNormal();
                    } else {
                        m_window->showMaximized();
                    }
                }
                emit gotResponse(queryID, QStringLiteral("{\"success\":true}"));
                return;
            }
            if (action == "windowClose") {
                if (m_window) {
                    m_window->close();
                }
                emit gotResponse(queryID, QStringLiteral("{\"success\":true}"));
                return;
            }
            if (action == "windowStartDrag") {
                if (m_window) {
                    QWindow* handle = m_window->windowHandle();
                    if (handle) {
                        handle->startSystemMove();
                    }
                }
                emit gotResponse(queryID, QStringLiteral("{\"success\":true}"));
                return;
            }
        }

        // Default: pass to backend
        backendCall(queryID, query.toUtf8().constData());
    }
signals:
    void gotResponse(int queryID, QString response);
    void pushNotify(QString msg);
};

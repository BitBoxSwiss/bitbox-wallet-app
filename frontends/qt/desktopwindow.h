// SPDX-License-Identifier: Apache-2.0
#pragma once

#include <QWidget>
#include <QVariantMap>
#include <QImage>
#include <QHash>
#include <QPointer>
#include <QVector>

class QWebEngineView;
class QAbstractButton;
namespace QWK { class WidgetWindowAgent; }

class DesktopWindow final : public QWidget {
    Q_OBJECT
public:
    explicit DesktopWindow(QWebEngineView *view, QWidget *parent = nullptr);
    QVariantMap state() const;
    QSize sizeHint() const override { return QSize(1257, 785); }
    void resetDocument();
    void updateLayout(const QVariantMap &snapshot);
    void updateAppearance(const QVariantMap &appearance);
    void prepareStartup(quint64 document);
    void setNativeDecorations(bool enabled);
    void minimize();
    void toggleMaximize();
    void requestClose();
signals:
    void stateChanged();
protected:
    void resizeEvent(QResizeEvent *) override;
    void changeEvent(QEvent *) override;
    void closeEvent(QCloseEvent *) override;
    void paintEvent(QPaintEvent *) override;
    bool event(QEvent *) override;
private:
    void syncFrame();
    void placeControls();
    void safeTitle();
    void updateControls();
    void invalidateViewport();
    QRect bodyRect() const;
    QWebEngineView *view_;
    QWK::WidgetWindowAgent *agent_ = nullptr;
    QWidget *title_ = nullptr;
    QWidget *trafficLights_ = nullptr;
    QVector<QWidget *> exclusions_;
    QVector<QAbstractButton *> buttons_;
    bool native_ = false;
    bool syncFrame_ = false;
    QMargins shadowMargins_;
    QHash<QString, QColor> captionColors_;
    qreal radius_ = 12;
    int tiledEdges_ = 0;
    QColor background_{"#f5f5f5"};
    QColor foreground_{"#1d1d1b"};
    quint64 document_ = 0;
    quint64 startupReadyDocument_ = 0;
    quint64 startupPendingDocument_ = 0;
    quint64 viewport_ = 0;
    quint64 sequence_ = 0;
};

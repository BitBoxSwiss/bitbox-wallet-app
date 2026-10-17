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
class QQuickWindow;
namespace QWK { class WidgetWindowAgent; }
class LinuxDecorationPreferences;

class DesktopWindow final : public QWidget {
    Q_OBJECT
public:
    explicit DesktopWindow(QWebEngineView *view, QWidget *parent = nullptr);
    QVariantMap state() const;
    QSize sizeHint() const override { return QSize(1257, 785); }
    void invalidateLayout();
    void updateLayout(const QVariantMap &snapshot);
    void updateAppearance(const QVariantMap &appearance);
    void setNativeDecorations(bool enabled);
    void setPreviewHeaderHeight(int height);
    void setPreviewLogoVisible(bool visible);
    void setPreviewButtonStyle(const QString &style);
    void setPreviewSeparateTitlebar(bool enabled);
signals:
    void stateChanged();
protected:
    void resizeEvent(QResizeEvent *) override;
    void changeEvent(QEvent *) override;
    void closeEvent(QCloseEvent *) override;
    void paintEvent(QPaintEvent *) override;
    bool event(QEvent *) override;
    bool eventFilter(QObject *, QEvent *) override;
private:
    void toggleMaximize();
    void syncFrame();
    void placeControls();
    void safeTitle();
    void updateControls();
    void rebuildShadow();
    void syncWebBackground();
    QRect bodyRect() const;
    int captionHeight() const;
    QWebEngineView *view_;
    QPointer<QQuickWindow> webScene_;
    QWK::WidgetWindowAgent *agent_ = nullptr;
    QWidget *title_ = nullptr;
    QWidget *trafficLights_ = nullptr;
    QVector<QWidget *> exclusions_;
    QVector<QAbstractButton *> buttons_;
    QVector<QWidget *> resizeTargets_;
    LinuxDecorationPreferences *preferences_ = nullptr;
    bool native_ = false;
    int headerHeight_ = 70;
    QString buttonStyle_ = "system";
    bool separateTitlebar_ = false;
    bool logoVisible_ = true;
    bool syncFrame_ = false;
    QMargins shadowMargins_;
    QImage shadow_;
    qreal shadowDpr_ = 0;
    bool shadowActive_ = false;
    bool shadowLight_ = true;
    QHash<QString, QColor> captionColors_;
    qreal radius_ = 12;
    int tiledEdges_ = 0;
    QColor background_{"#f5f5f5"};
    QColor foreground_{"#1d1d1b"};
    quint64 revision_ = 0;
    quint64 sequence_ = 0;
};

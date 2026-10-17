// SPDX-License-Identifier: Apache-2.0
#pragma once

#include <QObject>
#include <QPointer>
#include "desktopwindow.h"

// Publish only the desktop contract, never QWidget's inherited native methods.
class WindowChrome final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QVariantMap state READ state NOTIFY stateChanged)
public:
    explicit WindowChrome(DesktopWindow *window) : QObject(window), window_(window) {
        connect(window, &DesktopWindow::stateChanged, this, &WindowChrome::stateChanged);
    }
    QVariantMap state() const { return window_ ? window_->state() : QVariantMap(); }
    // Geometry and appearance arrive together. WebChannel's method reply lets
    // the renderer keep at most one transaction awaiting the Qt GUI thread.
    Q_INVOKABLE void updateFrame(const QVariantMap &value) {
        if (!window_) return;
        const auto layout = value.value("layout").toMap();
        const auto appearance = value.value("appearance").toMap();
        if (!layout.isEmpty()) window_->updateLayout(layout);
        if (!appearance.isEmpty()) window_->updateAppearance(appearance);
    }
    Q_INVOKABLE void setNativeDecorations(bool value) { if (window_) window_->setNativeDecorations(value); }
    Q_INVOKABLE void setPreviewHeaderHeight(int value) { if (window_) window_->setPreviewHeaderHeight(value); }
    Q_INVOKABLE void setPreviewLogoVisible(bool value) { if (window_) window_->setPreviewLogoVisible(value); }
    Q_INVOKABLE void setPreviewButtonStyle(const QString &value) { if (window_) window_->setPreviewButtonStyle(value); }
signals:
    void stateChanged();
private:
    QPointer<DesktopWindow> window_;
};

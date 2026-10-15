// SPDX-License-Identifier: Apache-2.0
#include "desktopwindow.h"

#include <QAbstractButton>
#include <QApplication>
#include <QCloseEvent>
#include <QMouseEvent>
#include <QPainter>
#include <QPainterPath>
#include <QResizeEvent>
#include <QSettings>
#include <QStyle>
#include <QTimer>
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QWindow>
#include <QtMath>
#include <cmath>
#include <QWKWidgets/widgetwindowagent.h>
#if defined(Q_OS_LINUX)
#include "linuxdecorationpreferences.h"
#endif

namespace {
bool supportsCsd() {
    return false;
}

constexpr int shadowSize = 16;
constexpr int chromeHeight = 70;
constexpr int controlHeight = 36;
constexpr int maxExclusions = 32;
constexpr int resizeBorder = 4;
constexpr int resizeShadow = 6;

class WindowButton final : public QAbstractButton {
public:
    WindowButton(const QString &action, QWidget *parent) : QAbstractButton(parent), action(action) {
        // Caption controls use the window manager's keyboard shortcuts and
        // accessible press actions; they must not steal web-content focus.
        setFocusPolicy(Qt::NoFocus);
        setMouseTracking(true);
        setAccessibleName(action);
    }
    QString action;
    QColor color = Qt::black;
    bool restored = false;
protected:
    void enterEvent(QEnterEvent *event) override { QAbstractButton::enterEvent(event); update(); }
    void leaveEvent(QEvent *event) override { QAbstractButton::leaveEvent(event); update(); }
    void paintEvent(QPaintEvent *) override {
        QPainter painter(this);
        painter.setRenderHint(QPainter::Antialiasing);
        const bool highlighted = underMouse() || isDown();
        QColor fill = color;
        fill.setAlpha(highlighted ? 40 : 15);
        painter.setPen(Qt::NoPen);
        painter.setBrush(fill);
        painter.drawEllipse(QPointF(width() / 2.0, height() / 2.0), 13, 13);
        const auto stroke = color;
        painter.setPen(QPen(stroke, 1.4));
        const QRectF glyph(width() / 2.0 - 5, height() / 2.0 - 5, 10, 10);
        if (action == "close") {
            painter.drawLine(glyph.topLeft(), glyph.bottomRight());
            painter.drawLine(glyph.bottomLeft(), glyph.topRight());
        } else if (action == "minimize") {
            painter.drawLine(glyph.bottomLeft(), glyph.bottomRight());
        } else {
            painter.setBrush(Qt::NoBrush);
            painter.drawRect(restored ? glyph.adjusted(0, 3, -3, 0) : glyph);
            if (restored) {
                painter.drawLine(glyph.topLeft() + QPointF(3, 0), glyph.topRight());
                painter.drawLine(glyph.topRight(), glyph.bottomRight() - QPointF(0, 3));
            }
        }
    }
};

bool readRect(const QVariantMap &input, qreal zoom, const QRect &bounds, QRect *output) {
    const QStringList keys{"x", "y", "width", "height"};
    double values[4];
    for (int i = 0; i < 4; ++i) {
        bool ok;
        values[i] = input.value(keys[i]).toDouble(&ok);
        if (!ok || !std::isfinite(values[i]) || qAbs(values[i]) > 100000) return false;
    }
    if (values[2] < 0 || values[3] < 0) return false;
    const QRectF rect(values[0] * zoom, values[1] * zoom, values[2] * zoom, values[3] * zoom);
    *output = rect.toAlignedRect().intersected(bounds);
    return true;
}
}

DesktopWindow::DesktopWindow(QWebEngineView *view, QWidget *parent) : QWidget(parent), view_(view) {
    QSettings settings;
    native_ = !supportsCsd() || settings.value("nativeDecorations", false).toBool() || qEnvironmentVariableIsSet("BITBOXAPP_NATIVE_DECORATIONS");
    setWindowTitle("BitBoxApp");
    setMouseTracking(true);
#if defined(Q_OS_LINUX)
    preferences_ = new LinuxDecorationPreferences(this);
    connect(preferences_, &LinuxDecorationPreferences::colorSchemeChanged, this, [this] { emit stateChanged(); });
#endif
    if (!native_) {
        agent_ = new QWK::WidgetWindowAgent(this);
        if (!agent_->setup(this)) {
            delete agent_;
            agent_ = nullptr;
            native_ = true;
        }
    }
    view_->setParent(this);
    if (agent_) {
        title_ = new QWidget(this);
        title_->setAttribute(Qt::WA_TransparentForMouseEvents);
        title_->setAttribute(Qt::WA_NoSystemBackground);
        title_->show();
        agent_->setTitleBar(title_);
        for (int i = 0; i < maxExclusions; ++i) {
            auto *proxy = new QWidget(title_);
            proxy->setAttribute(Qt::WA_TransparentForMouseEvents);
            proxy->setAttribute(Qt::WA_NoSystemBackground);
            agent_->setHitTestVisible(proxy, true);
            exclusions_.append(proxy);
        }
        for (const auto &action : QStringList{"minimize", "maximize", "close"}) {
            auto *button = new WindowButton(action, this);
            buttons_.append(button);
            const auto role = action == "close" ? QWK::WindowAgentBase::Close :
                              action == "maximize" ? QWK::WindowAgentBase::Maximize : QWK::WindowAgentBase::Minimize;
            agent_->setSystemButton(role, button);
            connect(button, &QAbstractButton::clicked, this, [this, action] {
                if (action == "close") requestClose();
                else if (action == "minimize") minimize();
                else toggleMaximize();
            });
        }
#if defined(Q_OS_LINUX)
        connect(preferences_, &LinuxDecorationPreferences::changed, this, [this] {
            placeControls();
            emit stateChanged();
        });
#endif
    }
    setMinimumSize(360, 375);
    resize(sizeHint());
    syncFrame();
    resetDocument();
}

QRect DesktopWindow::bodyRect() const { return rect().marginsRemoved(shadowMargins_); }

QVariantMap DesktopWindow::state() const {
    const auto body = view_->geometry();
    int leftInset = trafficLights_ && !isFullScreen() ? trafficLights_->geometry().right() - body.x() + 1 : 0;
    int rightInset = 0;
    for (auto *button : buttons_) {
        if (button->isHidden()) continue;
        if (button->x() < body.center().x()) leftInset = qMax(leftInset, button->geometry().right() - body.x() + 1);
        else rightInset = qMax(rightInset, body.right() - button->x() + 1);
    }
    qreal cornerRadius = 0;
    QVariantList captionButtons;
    for (auto *button : buttons_) {
        if (button->isHidden()) continue;
        const auto geometry = button->geometry().translated(-view_->pos());
        captionButtons.append(QVariantMap{{"action", static_cast<WindowButton *>(button)->action},
            {"x", geometry.x() / view_->zoomFactor()}, {"y", geometry.y() / view_->zoomFactor()},
            {"width", geometry.width() / view_->zoomFactor()}, {"height", geometry.height() / view_->zoomFactor()}});
    }
    QVariant systemDark;
    bool systemAppearanceReady = true;
    bool startupReady = true;
#if defined(Q_OS_LINUX)
    systemDark = preferences_->colorScheme() == 1;
    systemAppearanceReady = preferences_->colorSchemeReady();
#endif
    return {{"csd", !native_}, {"nativeDecorations", QSettings().value("nativeDecorations", false).toBool()},
            {"activeNativeDecorations", native_}, {"document", document_}, {"viewport", viewport_},
            {"systemDark", systemDark},
            {"systemAppearanceReady", systemAppearanceReady},
            {"startupReady", startupReady},
            {"topInset", 0}, {"leftInset", leftInset / view_->zoomFactor()}, {"rightInset", rightInset / view_->zoomFactor()},
            {"cornerRadius", cornerRadius}, {"captionButtons", captionButtons},
            {"maximized", isMaximized()}, {"fullScreen", isFullScreen()},
            {"width", view_->width()}, {"height", view_->height()}};
}

void DesktopWindow::resetDocument() {
    ++document_;
    startupPendingDocument_ = 0;
    sequence_ = 0;
    safeTitle();
    emit stateChanged();
}

void DesktopWindow::invalidateViewport() {
    ++viewport_;
    sequence_ = 0;
    safeTitle();
    emit stateChanged();
}

void DesktopWindow::safeTitle() {
    if (!title_) return;
    // Without a fresh exclusion map, web controls must remain normal client input.
    title_->setGeometry(bodyRect().x(), bodyRect().y(), bodyRect().width(), 0);
    for (auto *proxy : exclusions_) proxy->hide();
}

void DesktopWindow::updateLayout(const QVariantMap &snapshot) {
    if (!title_ || snapshot.value("document").toULongLong() != document_ ||
        snapshot.value("viewport").toULongLong() != viewport_) return;
    const auto sequence = snapshot.value("sequence").toULongLong();
    if (sequence <= sequence_) return;
    const auto viewport = snapshot.value("size").toMap();
    const qreal zoom = view_->zoomFactor();
    const double width = viewport.value("width").toDouble();
    const double height = viewport.value("height").toDouble();
    if (!std::isfinite(width) || !std::isfinite(height) ||
        qAbs(width * zoom - view_->width()) > 2 || qAbs(height * zoom - view_->height()) > 2) return;
    const auto list = snapshot.value("exclusions").toList();
    if (list.size() > maxExclusions) { safeTitle(); return; }
    const QRect bounds(0, 0, view_->width(), qMin(256, view_->height()));
    QRect header;
    if (!readRect(snapshot.value("titlebar").toMap(), zoom, bounds, &header)) return;
    QVector<QRect> rectangles;
    rectangles.reserve(list.size());
    for (const auto &item : list) {
        QRect exclusion;
        if (!readRect(item.toMap(), zoom, bounds, &exclusion)) return;
        rectangles.append(exclusion);
    }
    sequence_ = sequence;
    title_->setGeometry(header.translated(view_->pos()));
    title_->setVisible(!isFullScreen());
    for (int i = 0; i < exclusions_.size(); ++i) {
        auto *proxy = exclusions_[i];
        if (i >= rectangles.size() || rectangles[i].isEmpty()) { proxy->hide(); continue; }
        proxy->setGeometry(rectangles[i].translated(-header.topLeft()));
        proxy->show();
    }
}

void DesktopWindow::updateAppearance(const QVariantMap &appearance) {
    const QColor background(appearance.value("background").toString());
    const QColor foreground(appearance.value("foreground").toString());
    if (!background.isValid() || !foreground.isValid()) return;
    background_ = background; foreground_ = foreground;
    const auto captionColors = appearance.value("captionColors").toMap();
    for (auto *button : buttons_) {
        auto *control = static_cast<WindowButton *>(button);
        const QColor color(captionColors.value(control->action).toString());
        captionColors_[control->action] = color.isValid() ? color : foreground_;
    }
    const double radius = appearance.value("buttonRadius").toDouble();
    const qreal newRadius = std::isfinite(radius) && radius >= 8 ? qBound(8.0, radius * view_->zoomFactor(), 64.0) : 12;
    if (radius_ != newRadius) { radius_ = newRadius; syncFrame(); invalidateViewport(); }
    const auto labels = appearance.value("labels").toMap();
    for (auto *button : buttons_) {
        auto *control = static_cast<WindowButton *>(button);
        const auto label = labels.value(control->action).toString().left(100);
        if (!label.isEmpty() && control->accessibleName() != label) { control->setAccessibleName(label); control->setToolTip(label); }
    }
    updateControls();
    // Theme changes affect the native shadow; WebEngine presents its own frames.
    update();
}

void DesktopWindow::prepareStartup(quint64 document) {
    Q_UNUSED(document);
}

void DesktopWindow::setNativeDecorations(bool enabled) {
    QSettings().setValue("nativeDecorations", enabled);
    emit stateChanged();
}
void DesktopWindow::minimize() { showMinimized(); }
void DesktopWindow::toggleMaximize() { if (!isFullScreen()) isMaximized() ? showNormal() : showMaximized(); }
void DesktopWindow::requestClose() { close(); }

void DesktopWindow::placeControls() {
    const auto body = view_->geometry();
    const int controlY = body.y() + (chromeHeight - controlHeight) / 2;
    if (trafficLights_) trafficLights_->setGeometry(body.x() + 8, controlY, 80, controlHeight);
    QStringList left, right{"minimize", "maximize", "close"};
#if defined(Q_OS_LINUX)
    if (preferences_) {
        left = preferences_->buttons().left;
        right = preferences_->buttons().right;
        if (windowHandle()) windowHandle()->setProperty("_qwk_title_double_click", preferences_->buttons().doubleClick);
    }
#endif
    for (auto *button : buttons_) {
        const auto action = static_cast<WindowButton *>(button)->action;
        if (isFullScreen() || (!left.contains(action) && !right.contains(action))) button->hide();
    }
    auto place = [this, body, controlY](const QStringList &actions, bool onLeft) {
        const int width = 36;
        const int offset = (chromeHeight - controlHeight) / 2;
        const int height = controlHeight;
        const int y = controlY;
        int x = onLeft ? body.left() + offset : body.x() + body.width() - offset - actions.size() * width;
        for (const auto &action : actions) {
            for (auto *button : buttons_) {
                if (static_cast<WindowButton *>(button)->action != action) continue;
                button->setGeometry(x, y, width, height);
                button->setVisible(!isFullScreen());
                button->raise();
            }
            x += width;
        }
    };
    place(left, true); place(right, false);
    updateControls();
}

void DesktopWindow::updateControls() {
    for (auto *button : buttons_) {
        auto *control = static_cast<WindowButton *>(button);
        control->color = captionColors_.value(control->action, foreground_);
        if (!isActiveWindow()) control->color.setAlpha(170);
        control->restored = isMaximized();
        control->update();
    }
}

void DesktopWindow::syncFrame() {
    if (syncFrame_) return;
    syncFrame_ = true;
    QMargins margins;
    const auto body = bodyRect();
    view_->setGeometry(body);
    if (windowHandle()) {
        windowHandle()->setProperty("_qwk_resize_frame", body);
        windowHandle()->setProperty("_qwk_resize_border", resizeBorder);
        windowHandle()->setProperty("_qwk_resize_outset", resizeShadow);
        windowHandle()->setProperty("_qwk_resize_corner", qCeil(radius_));
        windowHandle()->setProperty("_qwk_disabled_resize_edges", (tiledEdges_ & 1 ? int(Qt::LeftEdge) : 0) |
            (tiledEdges_ & 2 ? int(Qt::RightEdge) : 0) | (tiledEdges_ & 4 ? int(Qt::TopEdge) : 0) |
            (tiledEdges_ & 8 ? int(Qt::BottomEdge) : 0));
    }
    placeControls();
    syncFrame_ = false;
    update();
}

void DesktopWindow::resizeEvent(QResizeEvent *event) {
    QWidget::resizeEvent(event);
    syncFrame();
    invalidateViewport();
}

void DesktopWindow::changeEvent(QEvent *event) {
    QWidget::changeEvent(event);
    if (event->type() == QEvent::WindowStateChange) { syncFrame(); invalidateViewport(); }
    if (event->type() == QEvent::ActivationChange) { updateControls(); update(); }
}

bool DesktopWindow::event(QEvent *event) {
    const auto type = event->type();
    const bool result = QWidget::event(event);
    if (type == QEvent::WinIdChange || type == QEvent::DevicePixelRatioChange)
        QTimer::singleShot(0, this, [this] { syncFrame(); invalidateViewport(); });
    return result;
}

void DesktopWindow::closeEvent(QCloseEvent *event) {
    QSettings().setValue("mainWindowGeometry", saveGeometry());
    QWidget::closeEvent(event);
}

void DesktopWindow::paintEvent(QPaintEvent *) {
}

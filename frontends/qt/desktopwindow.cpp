// SPDX-License-Identifier: Apache-2.0
#include "desktopwindow.h"

#include <QAbstractButton>
#include <QApplication>
#include <QCloseEvent>
#include <QMouseEvent>
#include <QQuickWidget>
#include <QQuickWindow>
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
#include <qpa/qplatformwindow_p.h>
#include <QtWaylandClient/private/qwaylandwindow_p.h>
#endif

namespace {
constexpr int shadowSize = 16;
constexpr int chromeHeight = 48;
constexpr int controlHeight = 36;
constexpr int maxExclusions = 32;
constexpr int resizeBorder = 4;
constexpr int resizeShadow = 6;

class ResizeTarget final : public QWidget {
public:
    explicit ResizeTarget(QWidget *parent) : QWidget(parent) {
        setAttribute(Qt::WA_NoSystemBackground);
        setMouseTracking(true);
        setFocusPolicy(Qt::NoFocus);
    }
protected:
    void paintEvent(QPaintEvent *) override {}
    void enterEvent(QEnterEvent *event) override { updateCursor(event->position().toPoint()); }
    void mouseMoveEvent(QMouseEvent *event) override { updateCursor(event->position().toPoint()); }
    void mousePressEvent(QMouseEvent *event) override {
        auto *handle = window()->windowHandle();
        const auto edges = edgesAt(event->position().toPoint());
        if (event->button() == Qt::LeftButton && handle && edges && handle->startSystemResize(edges))
            event->accept();
        else event->ignore();
    }
private:
    Qt::Edges edgesAt(const QPoint &local) const {
        const auto *handle = window()->windowHandle();
        if (!handle || handle->visibility() != QWindow::Windowed) return {};
        const auto body = handle->property("_qwk_resize_frame").toRect();
        const auto pos = mapTo(window(), local);
        const int corner = qMax(resizeBorder, handle->property("_qwk_resize_corner").toInt());
        Qt::Edges edges;
        if (pos.x() < body.left() + resizeBorder) edges |= Qt::LeftEdge;
        if (pos.x() > body.right() - resizeBorder) edges |= Qt::RightEdge;
        if (pos.y() < body.top() + resizeBorder) edges |= Qt::TopEdge;
        if (pos.y() > body.bottom() - resizeBorder) edges |= Qt::BottomEdge;
        if (edges & (Qt::LeftEdge | Qt::RightEdge)) {
            if (pos.y() < body.top() + corner) edges |= Qt::TopEdge;
            if (pos.y() > body.bottom() - corner) edges |= Qt::BottomEdge;
        }
        if (edges & (Qt::TopEdge | Qt::BottomEdge)) {
            if (pos.x() < body.left() + corner) edges |= Qt::LeftEdge;
            if (pos.x() > body.right() - corner) edges |= Qt::RightEdge;
        }
        if (window()->minimumWidth() == window()->maximumWidth()) edges &= ~(Qt::LeftEdge | Qt::RightEdge);
        if (window()->minimumHeight() == window()->maximumHeight()) edges &= ~(Qt::TopEdge | Qt::BottomEdge);
        return edges & ~Qt::Edges(handle->property("_qwk_disabled_resize_edges").toInt());
    }
    void updateCursor(const QPoint &local) {
        const auto edges = edgesAt(local);
        if (edges == (Qt::TopEdge | Qt::LeftEdge) || edges == (Qt::BottomEdge | Qt::RightEdge))
            setCursor(Qt::SizeFDiagCursor);
        else if (edges == (Qt::TopEdge | Qt::RightEdge) || edges == (Qt::BottomEdge | Qt::LeftEdge))
            setCursor(Qt::SizeBDiagCursor);
        else if (edges & (Qt::LeftEdge | Qt::RightEdge)) setCursor(Qt::SizeHorCursor);
        else if (edges & (Qt::TopEdge | Qt::BottomEdge)) setCursor(Qt::SizeVerCursor);
        else unsetCursor();
    }
};

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
#if defined(Q_OS_LINUX)
        // Linux preview: approximate AppKit traffic lights without changing the native backend.
        const bool active = window()->isActiveWindow();
        QColor trafficColor = active ? QColor(action == "close" ? "#ff5f57" :
            action == "minimize" ? "#febc2e" : "#28c840") : QColor("#999999");
        if (isDown()) trafficColor = trafficColor.darker(115);
        painter.setPen(QPen(trafficColor.darker(120), 0.6));
        painter.setBrush(trafficColor);
        const QPointF center(width() / 2.0, height() / 2.0);
        painter.drawEllipse(center, 6, 6);
        if (!highlighted || !active) return;
        painter.setPen(QPen(QColor("#4b350b"), 1.1, Qt::SolidLine, Qt::RoundCap));
        if (action == "close") {
            painter.drawLine(center + QPointF(-2.5, -2.5), center + QPointF(2.5, 2.5));
            painter.drawLine(center + QPointF(-2.5, 2.5), center + QPointF(2.5, -2.5));
        } else if (action == "minimize") {
            painter.drawLine(center + QPointF(-3, 0), center + QPointF(3, 0));
        } else {
            painter.setPen(Qt::NoPen);
            painter.setBrush(QColor("#125522"));
            QPainterPath arrows;
            arrows.moveTo(center + QPointF(-3, -3));
            arrows.lineTo(center + QPointF(1, -3));
            arrows.lineTo(center + QPointF(-3, 1));
            arrows.closeSubpath();
            arrows.moveTo(center + QPointF(3, 3));
            arrows.lineTo(center + QPointF(-1, 3));
            arrows.lineTo(center + QPointF(3, -1));
            arrows.closeSubpath();
            painter.drawPath(arrows);
        }
        return;
#endif
        QColor fill = color;
        fill.setAlpha(highlighted ? 40 : 15);
        painter.setPen(Qt::NoPen);
#if defined(Q_OS_WIN)
        const bool closeHover = action == "close" && highlighted;
        painter.fillRect(rect(), closeHover ? QColor("#e81123") : highlighted ? fill : QColor(Qt::transparent));
        const auto stroke = closeHover ? QColor(Qt::white) : color;
#else
        painter.setBrush(fill);
        painter.drawEllipse(QPointF(width() / 2.0, height() / 2.0), 13, 13);
        const auto stroke = color;
#endif
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
    native_ = settings.value("nativeDecorations", false).toBool() || qEnvironmentVariableIsSet("BITBOXAPP_NATIVE_DECORATIONS");
#if defined(Q_OS_LINUX)
    // The preview uses CSD without changing the user's saved decoration preference.
    native_ = qEnvironmentVariableIsSet("BITBOXAPP_NATIVE_DECORATIONS");
#endif
    setWindowTitle("BitBoxApp");
    setMouseTracking(true);
#if defined(Q_OS_LINUX)
    preferences_ = new LinuxDecorationPreferences(this);
    connect(preferences_, &LinuxDecorationPreferences::colorSchemeChanged, this, [this] { emit stateChanged(); });
#endif
    if (!native_) {
#if defined(Q_OS_LINUX)
        // Establish the final surface flags before QWindowKit attaches its
        // WinIdChange hook. Changing them during native creation can remap the
        // window and invalidate WebEngine's initial composited frame.
        const auto systemFlags = windowFlags();
        setWindowFlag(Qt::FramelessWindowHint);
        setAttribute(Qt::WA_TranslucentBackground);
        winId();
#endif
        agent_ = new QWK::WidgetWindowAgent(this);
        if (!agent_->setup(this)) {
            delete agent_;
            agent_ = nullptr;
            native_ = true;
#if defined(Q_OS_LINUX)
            setAttribute(Qt::WA_TranslucentBackground, false);
            setWindowFlags(systemFlags);
#endif
        }
    }
    view_->setParent(this);
#if defined(Q_OS_LINUX)
    if (!native_) view_->installEventFilter(this);
#endif
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
#if defined(Q_OS_MACOS)
        trafficLights_ = new QWidget(this);
        trafficLights_->setAttribute(Qt::WA_TransparentForMouseEvents);
        trafficLights_->show();
        agent_->setWindowAttribute("no-system-buttons", false);
        agent_->setSystemButtonArea(trafficLights_);
#else
#if defined(Q_OS_LINUX)
        trafficLights_ = new QWidget(this);
        trafficLights_->setAttribute(Qt::WA_TransparentForMouseEvents);
        trafficLights_->setAttribute(Qt::WA_NoSystemBackground);
        trafficLights_->show();
#endif
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
#endif
#if defined(Q_OS_LINUX)
        connect(preferences_, &LinuxDecorationPreferences::changed, this, [this] {
            placeControls();
            emit stateChanged();
        });
#endif
    }
    setMinimumSize(360, 375);
#if defined(Q_OS_LINUX)
    if (!native_) for (int i = 0; i < 4; ++i) resizeTargets_.append(new ResizeTarget(this));
#endif
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
#if defined(Q_OS_LINUX)
    if (!native_ && !isMaximized() && !isFullScreen() && !tiledEdges_) cornerRadius = radius_ / view_->zoomFactor();
#endif
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
    startupReady = native_ || startupReadyDocument_ == document_;
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
    if (radius_ != newRadius) { radius_ = newRadius; shadow_ = {}; syncFrame(); invalidateViewport(); }
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
#if defined(Q_OS_LINUX)
    if (native_ || document != document_ || startupReadyDocument_ == document || startupPendingDocument_ == document) return;
    startupPendingDocument_ = document;
    syncWebBackground();
    const auto ready = [this, document] {
        if (document != document_ || startupReadyDocument_ == document) return;
        startupReadyDocument_ = document;
        startupPendingDocument_ = 0;
        emit stateChanged();
    };
    // The loading page stays mounted until Qt renders its initialized surface.
    // This changes neither window nor viewport geometry.
    for (auto *quick : view_->findChildren<QQuickWidget *>()) {
        if (quick->window() != this) continue;
        if (auto *scene = quick->quickWindow()) {
            connect(scene, &QQuickWindow::afterRendering, this, ready,
                    Qt::ConnectionType(Qt::QueuedConnection | Qt::SingleShotConnection));
            scene->update();
            break;
        }
    }
    view_->update();
    update();
    // Hidden windows may suspend rendering; initialization must still complete.
    QTimer::singleShot(500, this, ready);
#else
    Q_UNUSED(document);
#endif
}

void DesktopWindow::syncWebBackground() {
#if defined(Q_OS_LINUX)
    if (native_) return;
    for (auto *quick : view_->findChildren<QQuickWidget *>()) {
        if (quick->window() != this || quick->isHidden() || !quick->quickWindow()) continue;
        if (webScene_ != quick->quickWindow()) {
            webScene_ = quick->quickWindow();
            connect(webScene_, &QQuickWindow::colorChanged, this, &DesktopWindow::syncWebBackground,
                    Qt::QueuedConnection);
        }
        if (webScene_->color().alpha() != 0) {
            // Chromium's content background can override the transparent page
            // default. Reset through the page API to clear both the compositor
            // layer and Qt's surface. Two zero-alpha colors bypass its cached
            // value check without painting an opaque frame or changing size.
            const int red = view_->page()->backgroundColor().red() == 0 ? 1 : 0;
            view_->page()->setBackgroundColor(QColor(red, 0, 0, 0));
        }
        break;
    }
#endif
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
        left = QStringList{"close", "minimize", "maximize"};
        right.clear();
        if (windowHandle()) windowHandle()->setProperty("_qwk_title_double_click", preferences_->buttons().doubleClick);
    }
#endif
    for (auto *button : buttons_) {
        const auto action = static_cast<WindowButton *>(button)->action;
        if (isFullScreen() || (!left.contains(action) && !right.contains(action))) button->hide();
    }
    auto place = [this, body, controlY](const QStringList &actions, bool onLeft) {
#if defined(Q_OS_WIN)
        const int width = 46;
        const int offset = 0;
        const int height = 32;
        const int y = body.y();
#elif defined(Q_OS_LINUX)
        // Match the native macOS reserved area: x=8, width=80, centered lights 20px apart.
        const int width = 20;
        const int offset = 18;
        const int height = controlHeight;
        const int y = controlY;
#else
        const int width = 36;
        const int offset = (chromeHeight - controlHeight) / 2;
        const int height = controlHeight;
        const int y = controlY;
#endif
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
#if defined(Q_OS_LINUX)
    QtWaylandClient::QWaylandWindow *wayland = nullptr;
    if (windowHandle()) wayland = dynamic_cast<QtWaylandClient::QWaylandWindow *>(windowHandle()->handle());
    const int tiles = wayland ? int(wayland->toplevelWindowTilingStates()) : 0;
    tiledEdges_ = tiles;
    if (!native_ && !isMaximized() && !isFullScreen())
        margins = QMargins(tiles & 1 ? 0 : shadowSize, tiles & 4 ? 0 : shadowSize,
                           tiles & 2 ? 0 : shadowSize, tiles & 8 ? 0 : shadowSize);
    if (margins != shadowMargins_) {
        shadowMargins_ = margins;
        if (windowHandle()) {
            auto *native = windowHandle()->nativeInterface<QNativeInterface::Private::QWaylandWindow>();
            if (native) native->setCustomMargins(margins);
        }
    }
#endif
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
#if defined(Q_OS_LINUX)
    // The CSS alpha mask owns the visible curve. This outward-rounded guard
    // bounds stale WebEngine frames during resize without cutting its AA edge.
    const qreal radius = native_ || isMaximized() || isFullScreen() || tiledEdges_ ? 0 :
        qMin(radius_, qMin(view_->width(), view_->height()) / 2.0);
    if (radius > 0) {
        QRegion visible(view_->rect());
        for (int y = 0; y < qCeil(radius); ++y) {
            const qreal distance = qMax(0.0, radius - y - 1);
            const int cut = qMax(0, qFloor(radius - std::sqrt(radius * radius - distance * distance)) - 1);
            if (!cut) continue;
            for (const int row : {y, view_->height() - y - 1}) {
                visible -= QRegion(0, row, cut, 1);
                visible -= QRegion(view_->width() - cut, row, cut, 1);
            }
        }
        view_->setMask(visible);
    } else {
        view_->setMask(QRegion());
    }
    if (wayland && !native_) {
        // Include transparent corner targets and 6px of the outer shadow.
        // The rest of the shadow remains click-through on Wayland.
        windowHandle()->setMask(QRegion(body.adjusted(-resizeShadow, -resizeShadow, resizeShadow, resizeShadow).intersected(rect())));
    }
#endif
    placeControls();
    // Native input targets sit above Chromium and draw no pixels. Their outer
    // 6px lie in the shadow; their inner 4px match the windowkit resize band.
    const auto outer = body.adjusted(-resizeShadow, -resizeShadow, resizeShadow, resizeShadow);
    const int band = resizeBorder + resizeShadow;
    const QRect targets[]{
        QRect(outer.left(), outer.top(), outer.width(), band),
        QRect(outer.left(), body.bottom() - resizeBorder + 1, outer.width(), band),
        QRect(outer.left(), outer.top(), band, outer.height()),
        QRect(body.right() - resizeBorder + 1, outer.top(), band, outer.height())};
    const Qt::Edge targetEdges[]{Qt::TopEdge, Qt::BottomEdge, Qt::LeftEdge, Qt::RightEdge};
    const auto disabled = windowHandle() ? Qt::Edges(windowHandle()->property("_qwk_disabled_resize_edges").toInt()) : Qt::Edges();
    for (int i = 0; i < resizeTargets_.size(); ++i) {
        auto *target = resizeTargets_[i];
        const bool fixed = i < 2 ? minimumHeight() == maximumHeight() : minimumWidth() == maximumWidth();
        target->setGeometry(targets[i].intersected(rect()));
        target->setVisible(!isMaximized() && !isFullScreen() && !fixed && !disabled.testFlag(targetEdges[i]));
        target->raise();
    }
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
#if defined(Q_OS_LINUX)
    if (type == QEvent::UpdateRequest && windowHandle()) {
        auto *platform = dynamic_cast<QtWaylandClient::QWaylandWindow *>(windowHandle()->handle());
        if (platform && int(platform->toplevelWindowTilingStates()) != tiledEdges_)
            QTimer::singleShot(0, this, [this] { syncFrame(); invalidateViewport(); });
    }
#endif
    return result;
}

bool DesktopWindow::eventFilter(QObject *object, QEvent *event) {
#if defined(Q_OS_LINUX)
    if (object == view_ && (event->type() == QEvent::ChildAdded || event->type() == QEvent::ChildPolished)) {
        // ChildAdded occurs before the WebEngine delegate is fully constructed.
        QTimer::singleShot(0, this, &DesktopWindow::syncWebBackground);
    }
#endif
    return QWidget::eventFilter(object, event);
}

void DesktopWindow::closeEvent(QCloseEvent *event) {
    QSettings().setValue("mainWindowGeometry", saveGeometry());
    QWidget::closeEvent(event);
}

void DesktopWindow::rebuildShadow() {
    const qreal dpr = qMin(devicePixelRatioF(), qreal(8));
    const bool active = isActiveWindow();
    const bool light = background_.lightnessF() > 0.5;
    if (!shadow_.isNull() && shadowDpr_ == dpr && shadowActive_ == active && shadowLight_ == light) return;
    shadowDpr_ = dpr;
    shadowActive_ = active;
    shadowLight_ = light;
    const int half = shadowSize + qCeil(radius_);
    shadow_ = QImage(QSize(half * 2, half * 2) * dpr, QImage::Format_ARGB32_Premultiplied);
    shadow_.setDevicePixelRatio(dpr);
    shadow_.fill(Qt::transparent);
    QPainter painter(&shadow_);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setPen(Qt::NoPen);
    const QRectF body(shadowSize, shadowSize, 2 * qCeil(radius_), 2 * qCeil(radius_));
    for (int i = shadowSize; i > 0; --i) {
        const int strength = light ? (active ? 12 : 4) : (active ? 7 : 2);
        painter.setBrush(QColor(0, 0, 0, qRound(strength * std::pow(1.0 - double(i) / (shadowSize + 1), 2))));
        painter.drawRoundedRect(body.adjusted(-i, -i, i, i), radius_ + i, radius_ + i);
    }
    painter.setCompositionMode(QPainter::CompositionMode_Clear);
    painter.drawRoundedRect(body, radius_, radius_);
}

void DesktopWindow::paintEvent(QPaintEvent *) {
#if defined(Q_OS_LINUX)
    if (native_) return;
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setCompositionMode(QPainter::CompositionMode_Source);
    painter.fillRect(rect(), Qt::transparent);
    painter.setCompositionMode(QPainter::CompositionMode_SourceOver);
    if (!shadowMargins_.isNull()) {
        rebuildShadow();
        const qreal half = shadow_.width() / shadowDpr_ / 2;
        const qreal source = shadow_.width() / 2.0;
        const qreal xs[]{0, half, width() - half, double(width())};
        const qreal ys[]{0, half, height() - half, double(height())};
        for (int y = 0; y < 3; ++y) for (int x = 0; x < 3; ++x) {
            if (x == 1 && y == 1) continue;
            const QRectF target(xs[x], ys[y], xs[x + 1] - xs[x], ys[y + 1] - ys[y]);
            const QRectF part(x == 2 ? source : x == 1 ? source : 0,
                              y == 2 ? source : y == 1 ? source : 0,
                              x == 1 ? 1 : source, y == 1 ? 1 : source);
            painter.drawImage(target, shadow_, part);
        }
    }
    // Cover newly exposed areas while Chromium catches up with a resize. Keep
    // the backdrop inside the web contour's AA fringe to avoid edge buildup.
    const qreal radius = isMaximized() || isFullScreen() || tiledEdges_ ? 0 : radius_;
    const qreal inset = radius > 0 ? 1.0 / devicePixelRatioF() : 0;
    painter.setPen(Qt::NoPen);
    painter.setBrush(background_);
    const QRectF backdrop = QRectF(bodyRect()).adjusted(inset, inset, -inset, -inset);
    painter.drawRoundedRect(backdrop, qMax(0.0, radius - inset), qMax(0.0, radius - inset));
#endif
}

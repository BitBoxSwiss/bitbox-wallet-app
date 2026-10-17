// Copyright (C) 2021-2023 wangwenx190 (Yuhang Zhao)
// Copyright (C) 2023-present Stdware Collections (https://www.github.com/stdware)
// SPDX-License-Identifier: Apache-2.0

#include "qtwindowcontext_p.h"

#include <QtCore/QDebug>

#include "qwkglobal_p.h"
#include "systemwindow_p.h"

namespace QWK {

    static constexpr const quint8 kDefaultResizeBorderThickness = 8;

    // Hit testing uses the visible body, with a bounded outset into its shadow.
    static QRect resizeFrame(const QWindow *window) {
        const auto rect = window->property("_qwk_resize_frame").toRect();
        return rect.isValid() ? rect : QRect(QPoint(), window->size());
    }

    static Qt::Edges calculateWindowEdges(const QWindow *window, const QPoint &pos) {
#ifdef Q_OS_MACOS
        Q_UNUSED(window);
        Q_UNUSED(pos);
        return {};
#else
        if (!window || window->visibility() != QWindow::Windowed) return {};
        const auto frame = resizeFrame(window);
        const int configured = window->property("_qwk_resize_border").toInt();
        const int border = configured > 0 ? qBound(4, configured, 32) : kDefaultResizeBorderThickness;
        const auto outsetValue = window->property("_qwk_resize_outset");
        const int outset = outsetValue.isValid() ? qBound(0, outsetValue.toInt(), 32) : border;
        if (!frame.adjusted(-outset, -outset, outset, outset).contains(pos)) return {};
        const int x = pos.x() - frame.x();
        const int y = pos.y() - frame.y();
        const int corner = qMax(border, qBound(0, window->property("_qwk_resize_corner").toInt(), 64));
        Qt::Edges edges;
        if (x < border) edges |= Qt::LeftEdge;
        if (x >= frame.width() - border) edges |= Qt::RightEdge;
        if (y < border) edges |= Qt::TopEdge;
        if (y >= frame.height() - border) edges |= Qt::BottomEdge;
        // Extend diagonal targets along the rounded arc, keeping one identical
        // hit test for the cursor and the native compositor resize request.
        if (edges.testFlag(Qt::LeftEdge) || edges.testFlag(Qt::RightEdge)) {
            if (y < corner) edges |= Qt::TopEdge;
            if (y >= frame.height() - corner) edges |= Qt::BottomEdge;
        }
        if (edges.testFlag(Qt::TopEdge) || edges.testFlag(Qt::BottomEdge)) {
            if (x < corner) edges |= Qt::LeftEdge;
            if (x >= frame.width() - corner) edges |= Qt::RightEdge;
        }
        if (window->minimumWidth() == window->maximumWidth()) edges &= ~(Qt::LeftEdge | Qt::RightEdge);
        if (window->minimumHeight() == window->maximumHeight()) edges &= ~(Qt::TopEdge | Qt::BottomEdge);
        return edges & ~Qt::Edges(window->property("_qwk_disabled_resize_edges").toInt());
#endif
    }

    static Qt::CursorShape calculateCursorShape(const QWindow *window, const QPoint &pos) {
        const auto edges = calculateWindowEdges(window, pos);
        if (edges == (Qt::LeftEdge | Qt::TopEdge) || edges == (Qt::RightEdge | Qt::BottomEdge))
            return Qt::SizeFDiagCursor;
        if (edges == (Qt::RightEdge | Qt::TopEdge) || edges == (Qt::LeftEdge | Qt::BottomEdge))
            return Qt::SizeBDiagCursor;
        if (edges.testFlag(Qt::LeftEdge) || edges.testFlag(Qt::RightEdge)) return Qt::SizeHorCursor;
        if (edges.testFlag(Qt::TopEdge) || edges.testFlag(Qt::BottomEdge)) return Qt::SizeVerCursor;
        return Qt::ArrowCursor;
    }

    class QtWindowEventFilter : public SharedEventFilter {
    public:
        explicit QtWindowEventFilter(AbstractWindowContext *context);
        ~QtWindowEventFilter() override;

        enum WindowStatus {
            Idle,
            WaitingRelease,
            PreparingMove,
            Moving,
            Resizing,
        };

    protected:
        bool sharedEventFilter(QObject *object, QEvent *event) override;

    private:
        AbstractWindowContext *m_context;
        bool m_cursorShapeChanged;
        WindowStatus m_windowStatus;
    };

    QtWindowEventFilter::QtWindowEventFilter(AbstractWindowContext *context)
        : m_context(context), m_cursorShapeChanged(false), m_windowStatus(Idle) {
        m_context->installSharedEventFilter(this);
    }

    QtWindowEventFilter::~QtWindowEventFilter() = default;

    bool QtWindowEventFilter::sharedEventFilter(QObject *obj, QEvent *event) {
        Q_UNUSED(obj)

        auto type = event->type();
        if (type < QEvent::MouseButtonPress || type > QEvent::MouseMove) {
            return false;
        }
        auto host = m_context->host();
        auto window = m_context->window();
        auto delegate = m_context->delegate();
        auto me = static_cast<const QMouseEvent *>(event);
        bool fixedSize = m_context->isHostSizeFixed();

        QPoint scenePos = getMouseEventScenePos(me);
        QPoint globalPos = getMouseEventGlobalPos(me);

        bool inTitleBar = m_context->isInTitleBarDraggableArea(scenePos);

        const auto& updateCursorShape{ [&](){
            if (fixedSize) {
                return;
            }
            const Qt::CursorShape shape = calculateCursorShape(window, scenePos);
            if (shape == Qt::ArrowCursor) {
                if (m_cursorShapeChanged) {
                    delegate->restoreCursorShape(host);
                    m_cursorShapeChanged = false;
                }
            } else {
                delegate->setCursorShape(host, shape);
                m_cursorShapeChanged = true;
            }
        } };

        bool handled = false;

        switch (type) {
            case QEvent::MouseButtonPress: {
                m_windowStatus = WaitingRelease;
                switch (me->button()) {
                    case Qt::LeftButton: {
                        if (!fixedSize) {
                            Qt::Edges edges = calculateWindowEdges(window, scenePos);
                            if (edges != Qt::Edges()) {
                                startSystemResize(window, edges);
                                m_windowStatus = Resizing;
                                handled = true;
                                break;
                            }
                        }
                        if (inTitleBar) {
                            // If we call startSystemMove() now but release the mouse without actual
                            // movement, there will be no MouseReleaseEvent, so we defer it when the
                            // mouse is actually moving for the first time
                            m_windowStatus = PreparingMove;
                            handled = true;
                        }
                        break;
                    }
                    case Qt::RightButton: {
                        if (inTitleBar) {
                            m_context->showSystemMenu(globalPos);
                            m_windowStatus = Idle;
                            handled = true;
                        }
                        break;
                    }
                    default:
                        break;
                }
                break;
            }

            case QEvent::MouseButtonRelease: {
                switch (m_windowStatus) {
                    case Idle: {
                        if (inTitleBar) {
                            handled = true;
                        }
                        break;
                    }
                    case WaitingRelease:
                        break;
                    case PreparingMove:
                    case Moving:
                    case Resizing: {
                        handled = true;
                        break;
                    }
                }
                m_windowStatus = Idle;
                break;
            }

            case QEvent::MouseMove: {
                switch (m_windowStatus) {
                    case Idle:
                    case WaitingRelease: {
                        updateCursorShape();
                        break;
                    }
                    case PreparingMove: {
                        startSystemMove(window);
                        m_windowStatus = Moving;
                        handled = true;
                        break;
                    }
                    case Moving:
                    case Resizing: {
                        handled = true;
                        break;
                    }
                }
                break;
            }

            case QEvent::MouseButtonDblClick: {
                if (me->button() == Qt::LeftButton && inTitleBar && !fixedSize) {
                    const auto action = window->property("_qwk_title_double_click").toString();
                    if (action == QStringLiteral("none")) {
                        handled = true;
                        break;
                    }
                    if (action == QStringLiteral("minimize")) {
                        delegate->setWindowState(host, delegate->getWindowState(host) | Qt::WindowMinimized);
                        handled = true;
                        break;
                    }
                    Qt::WindowFlags windowFlags = delegate->getWindowFlags(host);
                    Qt::WindowStates windowState = delegate->getWindowState(host);
                    if ((windowFlags & Qt::WindowMaximizeButtonHint) &&
                        !(windowState & Qt::WindowFullScreen)) {
                        if (windowState & Qt::WindowMaximized) {
                            delegate->setWindowState(host, windowState & ~Qt::WindowMaximized);
                        } else {
                            delegate->setWindowState(host, windowState | Qt::WindowMaximized);
                        }
                        handled = true;
                    }
                }
                break;
            }

            default:
                break;
        }

        if (handled) {
            event->accept();
            return true;
        }

        return false;
    }

    QtWindowContext::QtWindowContext() : AbstractWindowContext() {
        qtWindowEventFilter = std::make_unique<QtWindowEventFilter>(this);
    }

    QtWindowContext::~QtWindowContext() = default;

    QString QtWindowContext::key() const {
        return QStringLiteral("qt");
    }

    void QtWindowContext::virtual_hook(int id, void *data) {
        AbstractWindowContext::virtual_hook(id, data);
    }

    void QtWindowContext::winIdChanged(WId winId, WId oldWinId) {
        if (!m_windowHandle) {
            m_delegate->setWindowFlags(m_host, m_delegate->getWindowFlags(m_host) &
                                                   ~Qt::FramelessWindowHint);
            return;
        }

        // Allocate new resources
        m_delegate->setWindowFlags(m_host,
                                   m_delegate->getWindowFlags(m_host) | Qt::FramelessWindowHint);
    }

}

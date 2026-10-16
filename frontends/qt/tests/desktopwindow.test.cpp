// SPDX-License-Identifier: Apache-2.0
#include <QtTest>
#include <QSettings>
#include <QTemporaryDir>
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QQuickWidget>
#include <QQuickWindow>
#include <QAbstractButton>
#include <QWindow>
#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusVariant>
#include <QDBusVirtualObject>
#include <memory>
#include <limits>
#include "desktopwindow.h"
#include "linuxdecorationpreferences.h"
#include "windowchrome.h"

namespace {
QVariant evaluate(QWebEnginePage *page, const QString &script) {
    QVariant result;
    QEventLoop loop;
    page->runJavaScript(script, [&result, &loop](const QVariant &value) { result = value; loop.quit(); });
    QTimer::singleShot(3000, &loop, &QEventLoop::quit);
    loop.exec();
    return result;
}
QVariantMap rectangle(int x, int y, int width, int height) {
    return {{"x", x}, {"y", y}, {"width", width}, {"height", height}};
}
QVariantMap snapshot(DesktopWindow &window, QWebEngineView &view) {
    auto state = window.state();
    return {{"document", state.value("document")}, {"viewport", state.value("viewport")},
            {"sequence", 1}, {"size", QVariantMap{{"width", view.width()}, {"height", view.height()}}},
            {"titlebar", rectangle(0, 0, view.width(), 120)},
            {"exclusions", QVariantList{rectangle(50, 50, 100, 30)}}};
}
bool transparentCornersWithOpaqueContent(QQuickWidget *quick, const QColor &contentColor) {
    const QImage image = quick->grabFramebuffer();
    if (image.isNull() || image.width() < 4 || image.height() < 4) return false;
    for (const auto &point : {QPoint(1, 1), QPoint(image.width() - 2, 1),
                             QPoint(1, image.height() - 2), QPoint(image.width() - 2, image.height() - 2)}) {
        if (image.pixelColor(point).alpha() != 0) return false;
    }
    return image.pixelColor(image.rect().center()) == contentColor;
}
}

class RecordingPage final : public QWebEnginePage {
    Q_OBJECT
signals:
    void rendererBusy();
protected:
    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel, const QString &message,
                                 int, const QString &) override {
        if (message == "renderer-busy") emit rendererBusy();
    }
};

class PortalFixture final : public QDBusVirtualObject {
public:
    QString layout = ":close";
    QString doubleClick = "toggle-maximize";
    uint colorScheme = 2;
    bool legacy = false;
    QString introspect(const QString &) const override { return {}; }
    bool handleMessage(const QDBusMessage &message, const QDBusConnection &connection) override {
        if (message.interface() != "org.freedesktop.portal.Settings") return false;
        if (legacy && message.member() == "ReadOne") {
            connection.send(message.createErrorReply("org.freedesktop.DBus.Error.UnknownMethod", "Legacy settings API"));
            return true;
        }
        if (message.member() != "ReadOne" && message.member() != "Read") return false;
        const QVariant value = message.arguments().value(0).toString() == "org.freedesktop.appearance" ? QVariant(colorScheme) :
            QVariant(message.arguments().value(1).toString() == "button-layout" ? layout : doubleClick);
        QVariant wrapped = QVariant::fromValue(QDBusVariant(value));
        if (message.member() == "Read") wrapped = QVariant::fromValue(QDBusVariant(wrapped));
        connection.send(message.createReply(QVariantList{wrapped}));
        return true;
    }
    void notify() {
        auto message = QDBusMessage::createSignal("/org/freedesktop/portal/desktop", "org.freedesktop.portal.Settings", "SettingChanged");
        message << QStringLiteral("org.gnome.desktop.wm.preferences") << QStringLiteral("button-layout")
                << QVariant::fromValue(QDBusVariant(layout));
        QDBusConnection::sessionBus().send(message);
    }
    void notifyColor(const QVariant &value) {
        auto message = QDBusMessage::createSignal("/org/freedesktop/portal/desktop", "org.freedesktop.portal.Settings", "SettingChanged");
        message << QStringLiteral("org.freedesktop.appearance") << QStringLiteral("color-scheme")
                << QVariant::fromValue(QDBusVariant(value));
        QDBusConnection::sessionBus().send(message);
    }
};

class DesktopWindowTest final : public QObject {
    Q_OBJECT
private slots:
    void initTestCase() {
        QSettings::setDefaultFormat(QSettings::IniFormat);
        QSettings::setPath(QSettings::IniFormat, QSettings::UserScope, settings_.path());
        qApp->setOrganizationName("BitBoxCSDTest");
        qApp->setApplicationName("BitBoxCSDTest");
        qunsetenv("BITBOXAPP_NATIVE_DECORATIONS");
    }
    void init() { QSettings().clear(); }

    void buttonPreferences() {
        auto gnome = parseGnomeButtons("close,maximize:minimize,close,unknown");
        QCOMPARE(gnome.left, (QStringList{"close", "maximize"}));
        QCOMPARE(gnome.right, (QStringList{"minimize"}));
        gnome = parseGnomeButtons(":");
        QVERIFY(gnome.left.isEmpty() && gnome.right.isEmpty());
        auto kde = parseKdeButtons("XIA", "MX");
        QCOMPARE(kde.left, (QStringList{"close", "minimize", "maximize"}));
        QVERIFY(kde.right.isEmpty());
    }

    void webContractDoesNotExposeWidgets() {
        DesktopWindow window(new QWebEngineView);
        WindowChrome chrome(&window);
        QVERIFY(chrome.metaObject()->indexOfMethod("updateFrame(QVariantMap)") >= 0);
        QVERIFY(chrome.metaObject()->indexOfMethod("setGeometry(int,int,int,int)") < 0);
        QVERIFY(chrome.metaObject()->indexOfMethod("setWindowFlags(Qt::WindowFlags)") < 0);
    }

    void portalReadSignalsAndLegacyFallback() {
        auto bus = QDBusConnection::sessionBus();
        QVERIFY(bus.isConnected());
        PortalFixture portal;
        QVERIFY(bus.registerVirtualObject("/org/freedesktop/portal/desktop", &portal));
        QVERIFY(bus.registerService("org.freedesktop.portal.Desktop"));
        const auto desktop = qgetenv("XDG_CURRENT_DESKTOP");
        qputenv("XDG_CURRENT_DESKTOP", "GNOME");
        {
            LinuxDecorationPreferences preferences;
            portal.layout = "close:maximize,minimize";
            portal.doubleClick = "none";
            portal.notify();
            QTRY_COMPARE(preferences.buttons().left, (QStringList{"close"}));
            QTRY_COMPARE(preferences.buttons().right, (QStringList{"maximize", "minimize"}));
            QTRY_COMPARE(preferences.buttons().doubleClick, QStringLiteral("none"));
            portal.legacy = true;
            portal.layout = "minimize,maximize:close";
            portal.doubleClick = "minimize";
            portal.notify();
            QTRY_COMPARE(preferences.buttons().left, (QStringList{"minimize", "maximize"}));
            QTRY_COMPARE(preferences.buttons().right, (QStringList{"close"}));
            QTRY_COMPARE(preferences.buttons().doubleClick, QStringLiteral("minimize"));
        }
        if (desktop.isNull()) qunsetenv("XDG_CURRENT_DESKTOP"); else qputenv("XDG_CURRENT_DESKTOP", desktop);
        bus.unregisterService("org.freedesktop.portal.Desktop");
        bus.unregisterObject("/org/freedesktop/portal/desktop");
    }

    void cornersAndRestartPreference() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(window.state().value("csd").toBool());
        QCOMPARE(window.state().value("cornerRadius").toDouble(), 12.0);
        QVERIFY(!view->mask().isEmpty());
        const auto appearance = [](double radius) {
            return QVariantMap{{"background", "#ffffff"}, {"foreground", "#000000"},
                               {"sidebar", "#333333"}, {"buttonRadius", radius}};
        };
        window.updateAppearance(appearance(7.5));
        QCOMPARE(window.state().value("cornerRadius").toDouble(), 12.0);
        window.updateAppearance(appearance(8));
        QCOMPARE(window.state().value("cornerRadius").toDouble(), 8.0);
        window.setNativeDecorations(true);
        QVERIFY(window.state().value("nativeDecorations").toBool());
        QVERIFY(window.state().value("csd").toBool());
        auto *nativeView = new QWebEngineView;
        DesktopWindow nativeWindow(nativeView);
        QVERIFY(!nativeWindow.state().value("csd").toBool());
        QVERIFY(nativeView->mask().isEmpty());
    }

    void transparentWebSurfaceAfterOpaqueHtmlStartup() {
        auto *view = new QWebEngineView;
        auto *page = new QWebEnginePage(view);
        page->setBackgroundColor(Qt::transparent);
        view->setPage(page);
        DesktopWindow window(view);
        connect(view, &QWebEngineView::loadStarted, &window, &DesktopWindow::resetDocument);
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml(R"HTML(
            <style>
                html, body { margin: 0; width: 100%; height: 100%; background: #f5f5f5; }
                #content { width: 100%; height: 100%; background: #1d1d1b; }
            </style>
            <div id="content"></div>
        )HTML");
        window.resize(640, 480);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        auto *quick = view->findChild<QQuickWidget *>();
        QVERIFY(quick);
        const QRect windowGeometry = window.geometry();
        const QRect viewGeometry = view->geometry();
        evaluate(page, R"JS(
            document.documentElement.style.background = 'transparent';
            document.body.style.background = 'transparent';
            document.body.style.clipPath = 'inset(0 round 12px)';
        )JS");
        window.prepareStartup(window.state().value("document").toULongLong());
        QTRY_COMPARE(quick->quickWindow()->color().alpha(), 0);
        QTRY_VERIFY(!quick->testAttribute(Qt::WA_OpaquePaintEvent));
        QTRY_VERIFY_WITH_TIMEOUT(transparentCornersWithOpaqueContent(quick, QColor("#1d1d1b")), 5000);
        QCOMPARE(window.geometry(), windowGeometry);
        QCOMPARE(view->geometry(), viewGeometry);
    }

    void transparentWebSurfaceSurvivesBackgroundResetAndReload() {
        auto *view = new QWebEngineView;
        auto *page = new QWebEnginePage(view);
        page->setBackgroundColor(Qt::transparent);
        view->setPage(page);
        DesktopWindow window(view);
        connect(view, &QWebEngineView::loadStarted, &window, &DesktopWindow::resetDocument);
        const QString html = R"HTML(
            <style>
                html, body { margin: 0; width: 100%; height: 100%; background: transparent; }
                body { clip-path: inset(0 round 12px); }
                #content { width: 100%; height: 100%; background: #205060; }
            </style>
            <div id="content"></div>
        )HTML";
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml(html);
        window.resize(640, 480);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        auto *quick = view->findChild<QQuickWidget *>();
        QVERIFY(quick);
        const QRect windowGeometry = window.geometry();
        const QRect viewGeometry = view->geometry();
        for (const auto &color : {QColor("#f5f5f5"), QColor("#444444")}) {
            // Renderer background reports use this same Qt compositor reset path.
            page->setBackgroundColor(color);
            QCOMPARE(quick->quickWindow()->color(), color);
            QVERIFY(quick->testAttribute(Qt::WA_OpaquePaintEvent));
            QTRY_COMPARE(quick->quickWindow()->color().alpha(), 0);
            QTRY_VERIFY(!quick->testAttribute(Qt::WA_OpaquePaintEvent));
            QTRY_VERIFY_WITH_TIMEOUT(transparentCornersWithOpaqueContent(quick, QColor("#205060")), 5000);
        }
        loaded.clear();
        page->triggerAction(QWebEnginePage::Reload);
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        quick = view->findChild<QQuickWidget *>();
        QVERIFY(quick);
        QTRY_COMPARE(quick->quickWindow()->color().alpha(), 0);
        QTRY_VERIFY_WITH_TIMEOUT(transparentCornersWithOpaqueContent(quick, QColor("#205060")), 5000);
        QCOMPARE(window.geometry(), windowGeometry);
        QCOMPARE(view->geometry(), viewGeometry);
        QCOMPARE(window.windowHandle()->property("_qwk_resize_border").toInt(), 4);
        QCOMPARE(window.windowHandle()->property("_qwk_resize_outset").toInt(), 6);
        for (const auto &size : {QSize(800, 600), QSize(480, 400)}) {
            window.resize(size);
            QTRY_COMPARE(quick->size(), view->size());
            QTRY_VERIFY_WITH_TIMEOUT(transparentCornersWithOpaqueContent(quick, QColor("#205060")), 5000);
        }
        window.move(window.pos() + QPoint(25, 25));
        QTRY_VERIFY_WITH_TIMEOUT(transparentCornersWithOpaqueContent(quick, QColor("#205060")), 5000);
    }

    void portalAppearanceValuesAndLiveUpdates() {
        auto bus = QDBusConnection::sessionBus();
        PortalFixture portal;
        QVERIFY(bus.registerVirtualObject("/org/freedesktop/portal/desktop", &portal));
        QVERIFY(bus.registerService("org.freedesktop.portal.Desktop"));
        {
            DesktopWindow window(new QWebEngineView);
            QTRY_COMPARE(window.state().value("systemDark"), QVariant(false));
            portal.colorScheme = 1;
            portal.notifyColor(portal.colorScheme);
            QTRY_COMPARE(window.state().value("systemDark"), QVariant(true));
            portal.colorScheme = 0;
            portal.notifyColor(portal.colorScheme);
            QTRY_COMPARE(window.state().value("systemDark"), QVariant(false));
            portal.legacy = true;
            LinuxDecorationPreferences legacy;
            QTRY_COMPARE(legacy.colorScheme(), 0);
            portal.notifyColor(QStringLiteral("invalid"));
            QTRY_COMPARE(legacy.colorScheme(), -1);
            portal.notifyColor(uint(2));
            QTRY_COMPARE(legacy.colorScheme(), 2);
        }
        bus.unregisterService("org.freedesktop.portal.Desktop");
        bus.unregisterObject("/org/freedesktop/portal/desktop");
    }

    void resizeCursorsCoverAllEdgesAndCorners() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
        const QVector<QPair<QPoint, Qt::CursorShape>> targets{
            {{body.left() + 5, body.center().y()}, Qt::SizeHorCursor},
            {{body.right() - 5, body.center().y()}, Qt::SizeHorCursor},
            {{body.center().x(), body.top() + 5}, Qt::SizeVerCursor},
            {{body.center().x(), body.bottom() - 5}, Qt::SizeVerCursor},
            {{body.left() + 5, body.top() + 5}, Qt::SizeFDiagCursor},
            {{body.right() - 5, body.top() + 5}, Qt::SizeBDiagCursor},
            {{body.left() + 5, body.bottom() - 5}, Qt::SizeBDiagCursor},
            {{body.right() - 5, body.bottom() - 5}, Qt::SizeFDiagCursor},
            {{body.left() - 5, body.top() + 10}, Qt::SizeFDiagCursor},
        };
        for (const auto &target : targets) {
            QTest::mouseMove(window.windowHandle(), target.first);
            QCOMPARE(window.cursor().shape(), target.second);
        }
        QTest::mouseMove(window.windowHandle(), view->geometry().center());
        QCOMPARE(window.cursor().shape(), Qt::ArrowCursor);
        window.windowHandle()->setProperty("_qwk_disabled_resize_edges", int(Qt::LeftEdge));
        QTest::mouseMove(window.windowHandle(), QPoint(body.left() + 5, body.center().y()));
        QCOMPARE(window.cursor().shape(), Qt::ArrowCursor);
        QTest::mouseMove(window.windowHandle(), body.topLeft() + QPoint(5, 5));
        QCOMPARE(window.cursor().shape(), Qt::SizeVerCursor);
        window.windowHandle()->setProperty("_qwk_disabled_resize_edges", 0);
        window.showMaximized();
        QTRY_VERIFY(window.isMaximized());
        QTest::mouseMove(window.windowHandle(), QPoint(5, 100));
        QCOMPARE(window.cursor().shape(), Qt::ArrowCursor);
    }

    void nativeCornersSurviveResizeAndShadowFollowsFocus() {
        auto *view = new QWebEngineView;
        auto *page = new RecordingPage;
        page->setParent(view);
        view->setPage(page);
        DesktopWindow window(view);
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml("<style>html {background:white}</style>");
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        const auto checkCorner = [&window, view] {
            // QWidget::grab flushes pending native resize events before painting.
            const auto image = window.grab().toImage();
            const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
            QCOMPARE(view->x() - body.x(), 6);
            QCOMPARE(view->y() - body.y(), 6);
            for (const auto &point : {body.topLeft() + QPoint(1, 1), body.topRight() + QPoint(-1, 1),
                                      body.bottomLeft() + QPoint(1, -1), body.bottomRight() + QPoint(-1, -1)}) {
                QVERIFY(image.pixelColor(point).alpha() < 128);
                QVERIFY(image.pixelColor(point).red() < 50);
            }
        };
        QSignalSpy busy(page, &RecordingPage::rendererBusy);
        auto completed = std::make_shared<bool>(false);
        page->runJavaScript("console.log('renderer-busy'); const until = performance.now() + 1500; while (performance.now() < until) {}", [completed](const QVariant &) { *completed = true; });
        QVERIFY(busy.wait(3000));
        for (const auto size : {QSize(800, 600), QSize(1100, 750), QSize(700, 500)}) {
            window.resize(size);
            checkCorner();
        }
        QVERIFY(!*completed);
        QApplication::setActiveWindow(&window);
        QVERIFY(window.isActiveWindow());
        const auto active = window.grab().toImage();
        QApplication::setActiveWindow(nullptr);
        QVERIFY(!window.isActiveWindow());
        const auto inactive = window.grab().toImage();
        const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
        const auto sample = QPoint(body.center().x(), body.top() - 3);
        QVERIFY(active.pixelColor(sample).alpha() > inactive.pixelColor(sample).alpha());
        QTRY_VERIFY_WITH_TIMEOUT(*completed, 3000);
    }

    // The 48px caption centers 36px controls with equal 6px top/side spacing and reserves only the occupied side.
    void controlsReserveOnlyOccupiedSidesAndUseSymmetricLinuxPadding() {
        DesktopWindow window(new QWebEngineView);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QAbstractButton *close = nullptr;
        for (auto *button : window.findChildren<QAbstractButton *>())
            if (button->accessibleName() == "close") close = button;
        QVERIFY(close);
        QVERIFY(!close->hasFocus());
        const auto *view = window.findChild<QWebEngineView *>();
        QCOMPARE(close->y() - view->y(), 6);
        QCOMPARE(view->geometry().right() - close->geometry().right(), 6);
        QCOMPARE(window.state().value("leftInset").toInt(), 0);
        QCOMPARE(window.state().value("rightInset").toInt(), 42);
    }

    void framePaletteFollowsVisiblePanelsAndRejectsInvalidSegments() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        const auto segment = [](double from, double to, const QString &color, const QString &foreground = "white") {
            return QVariantMap{{"from", from}, {"to", to}, {"color", color}, {"foreground", foreground}};
        };
        QVariantMap edges{
            {"top", QVariantList{segment(0, 50, "#2e2e2e"), segment(50, view->width(), "#a0a0a0", "#000000")}},
            {"right", QVariantList{segment(0, 70, "#6699bb"), segment(70, view->height(), "#77aacc")}},
            {"bottom", QVariantList{segment(0, view->width(), "#a0a0a0")}},
            {"left", QVariantList{segment(0, 70, "#2e2e2e"), segment(70, view->height(), "#333333")}},
        };
        QVariantMap appearance{{"background", "#f5f5f5"}, {"foreground", "#1d1d1b"}, {"sidebar", "#333333"},
            {"buttonRadius", 7.5}, {"frameEdges", edges},
            {"size", QVariantMap{{"width", view->width()}, {"height", view->height()}}}};
        window.updateAppearance(appearance);
        const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
        auto image = window.grab().toImage();
        const auto dimmed = QPoint(view->x() + 200, body.y() + 3);
        QCOMPARE(image.pixelColor(dimmed), QColor("#a0a0a0"));
        QCOMPARE(image.pixelColor(QPoint(body.x() + 3, view->y() + 30)), QColor("#2e2e2e"));
        QCOMPARE(image.pixelColor(QPoint(view->geometry().right() + 3, view->y() + 30)), QColor("#6699bb"));
        edges["top"] = QVariantList{segment(0, std::numeric_limits<double>::quiet_NaN(), "#ffffff")};
        appearance["frameEdges"] = edges;
        window.updateAppearance(appearance);
        image = window.grab().toImage();
        QCOMPARE(image.pixelColor(dimmed), QColor("#a0a0a0"));
    }

    void nativeTitleAndWebExclusion() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml("<button id='control' style='position:absolute;left:50px;top:50px;width:100px;height:30px' onclick='window.clicked=true'>Control</button>");
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        window.updateLayout(snapshot(window, *view));
        QTest::mouseClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(80, 65));
        QTRY_VERIFY(evaluate(view->page(), "window.clicked === true").toBool());
        QVERIFY(!window.isMaximized());
        // The native path still works when the web renderer has not handled a DOM drag.
        QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 65));
        QTRY_VERIFY(window.isMaximized());
    }

    void staleLayoutDoesNotRestoreDragArea() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        auto old = snapshot(window, *view);
        window.resetDocument();
        window.updateLayout(old);
        QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 80));
        QVERIFY(!window.isMaximized());
    }

    void rendererStallDoesNotDelayNativeTitleAction() {
        auto *view = new QWebEngineView;
        auto *page = new RecordingPage;
        view->setPage(page);
        DesktopWindow window(view);
        page->setParent(view);
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml("<p>Renderer stall test</p>");
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        window.updateLayout(snapshot(window, *view));
        QSignalSpy busy(page, &RecordingPage::rendererBusy);
        auto completed = std::make_shared<bool>(false);
        page->runJavaScript("console.log('renderer-busy'); const until = performance.now() + 1500; while (performance.now() < until) {}", [completed](const QVariant &) { *completed = true; });
        QVERIFY(busy.wait(3000));
        QVERIFY(!*completed);
        QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 65));
        QTRY_VERIFY_WITH_TIMEOUT(window.isMaximized(), 500);
        QVERIFY(!*completed);
        QTRY_VERIFY_WITH_TIMEOUT(*completed, 3000);
    }
private:
    QTemporaryDir settings_;
};

int main(int argc, char **argv) {
    QCoreApplication::setAttribute(Qt::AA_DontCreateNativeWidgetSiblings);
    QApplication app(argc, argv);
    DesktopWindowTest test;
    return QTest::qExec(&test, argc, argv);
}
#include "desktopwindow.test.moc"

// SPDX-License-Identifier: Apache-2.0
#include <QtTest>
#include <QSettings>
#include <QTemporaryDir>
#include <QFile>
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
#include "webclass.h"

// This fixture exercises the native bridge without starting a wallet backend.
extern "C" void backendCall(int, const char *) {}

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
    return {{"revision", state.value("revision")},
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
        qInfo() << "Platform:" << QGuiApplication::platformName();
        qunsetenv("BITBOXAPP_NATIVE_DECORATIONS");
        QCoreApplication::setAttribute(Qt::AA_DontUseNativeDialogs);
    }
    void init() { QSettings().clear(); QSettings().setValue("nativeDecorations", false); }

    // Reject excessive data and a destroyed parent before presenting a preset chooser.
    void rejectsOversizedAppearancePreset() {
        auto window = std::make_unique<QWidget>();
        WebClass backend(window.get());
        QCOMPARE(backend.saveAppearancePreset(QString(64 * 1024 + 1, 'x'), "Export"), "error");
        QCOMPARE(backend.saveAppearancePreset(QString(32 * 1024 + 1, QChar(0x00e9)), "Export"), "error");
        window.reset();
        QCOMPARE(backend.saveAppearancePreset("{}", "Export"), "error");
    }

    // Preset export preserves save/cancel/write-failure results in both decoration modes.
    void appearancePresetDialog_data() {
        QTest::addColumn<bool>("native");
        QTest::addColumn<QString>("outcome");
        for (const bool native : {true, false})
            for (const auto &outcome : {"saved", "cancelled", "error"})
                QTest::newRow(qPrintable(QString::number(native) + outcome)) << native << QString(outcome);
    }

    // Frame updates during the modal loop must not change the dialog's parent, thread or saved bytes.
    void appearancePresetDialog() {
        QFETCH(bool, native);
        QFETCH(QString, outcome);
        QSettings().setValue("nativeDecorations", native);
        DesktopWindow window(new QWebEngineView);
        WebClass backend(&window);
        WindowChrome chrome(&window);
        QTemporaryDir output;
        QVERIFY(output.isValid());
        const auto filename = output.filePath("preset.json");
        const QString contents = "{\"light\":{},\"dark\":{}}";
        QTimer::singleShot(0, &window, [&] {
            auto *dialog = window.findChild<QFileDialog *>();
            if (!dialog) qFatal("Expected modal preset chooser");
            QTimer::singleShot(0, dialog, &QDialog::reject);
            QCOMPARE(dialog->parentWidget(), &window);
            QCOMPARE(dialog->thread(), qApp->thread());
            QCOMPARE(dialog->windowTitle().size(), 200);
            window.invalidateLayout();
            chrome.updateFrame({{"appearance", QVariantMap{{"background", "#333333"}, {"foreground", "#ffffff"}}}});
            if (outcome == "cancelled") { dialog->reject(); return; }
            dialog->selectFile(filename);
            QMetaObject::invokeMethod(dialog, "accept", Qt::DirectConnection);
            // Remove only this test's directory after chooser validation, before QSaveFile opens it.
            if (outcome == "error") QDir(output.path()).removeRecursively();
        });
        QCOMPARE(backend.saveAppearancePreset(contents, QString(201, 'x')), outcome);
        QFile file(filename);
        if (outcome == "saved") {
            QVERIFY(file.open(QIODevice::ReadOnly));
            QCOMPARE(file.readAll(), contents.toUtf8());
        } else QVERIFY(!file.exists());
    }

    // Dialogs nested in differently colored panels must use their own active palette in both themes.
    void dialogsUseThemeTextInsteadOfParentText() {
        QWebEngineView view;
        view.resize(1000, 700);
        view.show();
        QVERIFY(QTest::qWaitForWindowExposed(&view));
        for (const char *path : {"../../web/src/components/dialog/dialog.module.css",
                                 "../../web/src/components/dialog/dialog-legacy.module.css"}) {
            QFile css(QFINDTESTDATA(path));
            QVERIFY(css.open(QIODevice::ReadOnly));
            QSignalSpy loaded(&view, &QWebEngineView::loadFinished);
            view.setHtml("<style>:root{--color-default:#1d1d1b;--background-secondary:#fff}" +
                         QString::fromUtf8(css.readAll()) + "</style>"
                         "<div id='parent' style='color:white'><div class='modal' id='modal'>"
                         "<h3 id='title'>Unlock test wallet</h3><p id='text'>Description</p><label id='label'>Password</label>"
                         "</div></div>");
            QVERIFY(loaded.wait());
            const QString colors = "['modal','title','text','label'].every(id => getComputedStyle(document.getElementById(id)).color === ";
            QVERIFY(evaluate(view.page(), colors + "'rgb(29, 29, 27)')").toBool());
            evaluate(view.page(), "document.documentElement.style.setProperty('--color-default','#f5f5f5');"
                                 "document.documentElement.style.setProperty('--background-secondary','#333333');"
                                 "document.getElementById('parent').style.color='black';");
            QVERIFY(evaluate(view.page(), colors + "'rgb(245, 245, 245)')").toBool());
            QCOMPARE(evaluate(view.page(), "getComputedStyle(document.getElementById('modal')).backgroundColor").toString(),
                     "rgb(51, 51, 51)");
        }
    }

    // Fresh preferences use the system frame and standard header height without attaching CSD controls.
    void defaultsUseSystemBorders() {
        QSettings().clear();
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        QVERIFY(!window.state().value("csd").toBool());
        QVERIFY(window.state().value("nativeDecorations").toBool());
        QCOMPARE(window.state().value("previewHeaderHeight").toInt(), 70);
        QVERIFY(view->mask().isEmpty());
        QVERIFY(window.findChildren<QAbstractButton *>().isEmpty());
    }

    // A separate CSD row shares the web surface while keeping dragging bounded, dismiss overlays clickable and corners rounded.
    void separateTitlebarReservesOnlyNativeCaptionRow() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.setPreviewButtonStyle("macos");
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        const auto handle = window.windowHandle();
        window.setPreviewSeparateTitlebar(true);
        const auto body = handle->property("_qwk_resize_frame").toRect();
        QCOMPARE(view->geometry(), body);
        QCOMPARE(window.state().value("topInset").toInt(), 36);
        QCOMPARE(window.state().value("leftInset").toInt(), 0);
        QCOMPARE(window.state().value("rightInset").toInt(), 0);
        QCOMPARE(window.state().value("captionButtons").toList().size(), 3);
        QVERIFY(!view->mask().contains(QPoint(0, 0)));
        QVERIFY(!view->mask().contains(QPoint(0, view->height() - 1)));
        for (auto *button : window.findChildren<QAbstractButton *>()) {
            QVERIFY(button->isVisible());
            QVERIFY(button->geometry().bottom() < view->y() + 36);
        }
        auto layout = snapshot(window, *view);
        layout["exclusions"] = QVariantList{rectangle(350, 0, 100, 36)};
        window.updateLayout(layout);
        QTest::mouseDClick(handle, Qt::LeftButton, Qt::NoModifier, body.topLeft() + QPoint(400, 18));
        QVERIFY(!window.isMaximized());
        layout["sequence"] = 2;
        layout["exclusions"] = QVariantList{};
        window.updateLayout(layout);
        QTest::mouseDClick(handle, Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 65));
        QVERIFY(!window.isMaximized());
        QTest::mouseDClick(handle, Qt::LeftButton, Qt::NoModifier, body.topLeft() + QPoint(400, 18));
        QTRY_VERIFY(window.isMaximized());
        window.showNormal();
        QTRY_VERIFY(!window.isMaximized());
        window.setPreviewButtonStyle("windows");
        QCOMPARE(view->geometry(), handle->property("_qwk_resize_frame").toRect());
        QCOMPARE(window.state().value("topInset").toInt(), 32);
        QCOMPARE(window.windowHandle(), handle);
        DesktopWindow restored(new QWebEngineView);
        QVERIFY(restored.state().value("previewSeparateTitlebar").toBool());
        window.setPreviewSeparateTitlebar(false);
        QCOMPARE(window.state().value("topInset").toInt(), 0);
        QCOMPARE(view->geometry(), handle->property("_qwk_resize_frame").toRect());
        QVERIFY(window.state().value("rightInset").toInt() >= 138);
    }

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

    // Linux can preview all caption styles live without replacing the native window or accepting unknown styles.
    void captionStylePreviewUsesCorrectGeometryAndPersists() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        const auto handle = window.windowHandle();
        QCOMPARE(window.state().value("previewButtonStyle").toString(), QString("system"));
        window.setPreviewButtonStyle("macos");
        auto state = window.state();
        QVERIFY(state.value("leftInset").toDouble() > 0);
        QCOMPARE(state.value("rightInset").toDouble(), 0.0);
        QCOMPARE(state.value("captionButtons").toList().size(), 3);
        window.setPreviewButtonStyle("windows");
        state = window.state();
        QCOMPARE(state.value("leftInset").toDouble(), 0.0);
        QVERIFY(state.value("rightInset").toDouble() >= 138);
        for (const auto &entry : state.value("captionButtons").toList()) {
            const auto button = entry.toMap();
            QCOMPARE(button.value("width").toInt(), 46);
            QCOMPARE(button.value("height").toInt(), 32);
            QCOMPARE(button.value("y").toInt(), 0);
        }
        window.setPreviewButtonStyle("unknown");
        QCOMPARE(window.state().value("previewButtonStyle").toString(), QString("windows"));
        QCOMPARE(window.windowHandle(), handle);
        DesktopWindow restored(new QWebEngineView);
        QCOMPARE(restored.state().value("previewButtonStyle").toString(), QString("windows"));
        window.setPreviewButtonStyle("linux");
        QCOMPARE(window.state().value("previewButtonStyle").toString(), QString("linux"));
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

    // The scene-color repair must clear an opaque first frame without a forced redraw or startup handshake.
    void transparentWebSurfaceAfterOpaqueHtmlStartup() {
        auto *view = new QWebEngineView;
        auto *page = new QWebEnginePage(view);
        page->setBackgroundColor(Qt::transparent);
        view->setPage(page);
        DesktopWindow window(view);
        connect(view, &QWebEngineView::loadStarted, &window, &DesktopWindow::invalidateLayout);
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
            document.body.style.borderRadius = '12px';
            document.body.style.maskImage = 'linear-gradient(#000, #000)';
        )JS");
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
        connect(view, &QWebEngineView::loadStarted, &window, &DesktopWindow::invalidateLayout);
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

    // The 4px inner and 6px outer bands must expose native resize cursors without renderer input.
    void resizeCursorsCoverAllEdgesAndCorners() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(window.windowHandle()->property("_qwk_resize_frame").toRect().isValid());
        const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
        const QVector<QPair<QPoint, Qt::CursorShape>> targets{
            {{body.left() + 2, body.center().y()}, Qt::SizeHorCursor},
            {{body.right() - 2, body.center().y()}, Qt::SizeHorCursor},
            {{body.center().x(), body.top() + 2}, Qt::SizeVerCursor},
            {{body.center().x(), body.bottom() - 2}, Qt::SizeVerCursor},
            {{body.left() + 2, body.top() + 2}, Qt::SizeFDiagCursor},
            {{body.right() - 2, body.top() + 2}, Qt::SizeBDiagCursor},
            {{body.left() + 2, body.bottom() - 2}, Qt::SizeBDiagCursor},
            {{body.right() - 2, body.bottom() - 2}, Qt::SizeFDiagCursor},
            {{body.left() - 5, body.top() + 10}, Qt::SizeFDiagCursor},
        };
        for (const auto &target : targets) {
            QTest::mouseMove(window.windowHandle(), target.first);
            const auto *receiver = window.childAt(target.first);
            QTRY_COMPARE(receiver ? receiver->cursor().shape() : window.cursor().shape(), target.second);
        }
        QTest::mouseMove(window.windowHandle(), view->geometry().center());
        QTRY_COMPARE(window.cursor().shape(), Qt::ArrowCursor);
        window.windowHandle()->setProperty("_qwk_disabled_resize_edges", int(Qt::LeftEdge));
        QTest::mouseMove(window.windowHandle(), QPoint(body.left() + 2, body.center().y()));
        QTRY_COMPARE(window.cursor().shape(), Qt::ArrowCursor);
        QTest::mouseMove(window.windowHandle(), body.topLeft() + QPoint(2, 2));
        QTRY_COMPARE(window.cursor().shape(), Qt::SizeVerCursor);
        window.windowHandle()->setProperty("_qwk_disabled_resize_edges", 0);
        // Fixing one dimension must remove only that axis from the shared hit test.
        window.setFixedWidth(window.width());
        QTest::mouseMove(window.windowHandle(), body.center());
        QTest::mouseMove(window.windowHandle(), body.topLeft() + QPoint(2, 2));
        QTRY_COMPARE(window.cursor().shape(), Qt::SizeVerCursor);
        window.setMinimumWidth(360);
        window.setMaximumWidth(QWIDGETSIZE_MAX);
        window.setFixedHeight(window.height());
        QTest::mouseMove(window.windowHandle(), body.center());
        QTest::mouseMove(window.windowHandle(), body.topLeft() + QPoint(2, 2));
        QTRY_COMPARE(window.cursor().shape(), Qt::SizeHorCursor);
        window.setMinimumHeight(375);
        window.setMaximumHeight(QWIDGETSIZE_MAX);
        window.showMaximized();
        QTRY_VERIFY(window.isMaximized());
        QTest::mouseMove(window.windowHandle(), QPoint(5, 100));
        QTRY_COMPARE(window.cursor().shape(), Qt::ArrowCursor);
    }

    void nativeCornersSurviveResizeAndShadowFollowsFocus() {
        auto *view = new QWebEngineView;
        auto *page = new RecordingPage;
        page->setParent(view);
        page->setBackgroundColor(Qt::transparent);
        view->setPage(page);
        DesktopWindow window(view);
        QSignalSpy loaded(view, &QWebEngineView::loadFinished);
        view->setHtml(R"HTML(
            <style>
                html, body { margin: 0; width: 100%; height: 100%; background: transparent; }
                body { border-radius: 12px; mask-image: linear-gradient(#000, #000); }
                main { width: 100%; height: 100%; background: white; }
            </style><main></main>
        )HTML");
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(!loaded.isEmpty() || loaded.wait(5000));
        const auto checkCorner = [&window, view] {
            // QWidget::grab flushes pending native resize events before painting.
            const auto image = window.grab().toImage();
            const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
            QCOMPARE(view->geometry(), body);
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

    // Caption controls stay centered and reserve space only on the side they occupy.
    void controlsReserveOnlyOccupiedSideAndRespectHeaderHeight() {
        DesktopWindow window(new QWebEngineView);
        window.setPreviewHeaderHeight(48);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QAbstractButton *close = nullptr;
        for (auto *button : window.findChildren<QAbstractButton *>())
            if (button->accessibleName() == "close") close = button;
        QVERIFY(close);
        QVERIFY(!close->hasFocus());
        const auto *view = window.findChild<QWebEngineView *>();
        QTRY_COMPARE(close->y() - view->y(), 6);
        const bool left = close->geometry().center().x() < view->geometry().center().x();
        const auto state = window.state();
        const int occupied = left ? close->geometry().right() - view->x() + 1 : view->geometry().right() - close->x() + 1;
        QVERIFY(state.value(left ? "leftInset" : "rightInset").toInt() >= occupied);
        QCOMPARE(state.value(left ? "rightInset" : "leftInset").toInt(), 0);
    }

    // Invalid native colors must leave the last valid backdrop and geometry intact.
    void invalidAppearancePreservesWindowSurface() {
        auto *view = new QWebEngineView;
        DesktopWindow window(view);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(window.windowHandle()->property("_qwk_resize_frame").toRect().isValid());
        view->hide();
        const auto color = [&window] {
            const auto body = window.windowHandle()->property("_qwk_resize_frame").toRect();
            return window.grab().toImage().pixelColor(body.center());
        };
        const QVariantMap valid{{"background", "#205060"}, {"foreground", "#ffffff"}, {"buttonRadius", 12}};
        window.updateAppearance(valid);
        QCOMPARE(color(), QColor("#205060"));
        for (const auto &key : {"background", "foreground"}) {
            auto invalid = valid;
            invalid[key] = "not-a-color";
            invalid["buttonRadius"] = 8;
            window.updateAppearance(invalid);
            QCOMPARE(color(), QColor("#205060"));
            QCOMPARE(window.state().value("cornerRadius").toDouble(), 12.0);
        }
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

    // Reloading and resizing both invalidate cached drag geometry before a new snapshot arrives.
    void staleLayoutDoesNotRestoreDragArea() {
        for (const bool resize : {false, true}) {
            auto *view = new QWebEngineView;
            DesktopWindow window(view);
            window.show();
            QVERIFY(QTest::qWaitForWindowExposed(&window));
            QTRY_VERIFY(window.windowHandle()->property("_qwk_resize_frame").toRect().isValid());
            const auto old = snapshot(window, *view);
            if (resize) window.resize(window.size() + QSize(40, 40));
            else window.invalidateLayout();
            QTRY_VERIFY(window.state().value("revision") != old.value("revision"));
            window.updateLayout(old);
            QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 80));
            QVERIFY(!window.isMaximized());
        }
    }

    // Untrusted non-finite, negative or oversized geometry must never turn web controls into drag areas.
    void invalidLayoutCannotEnableDragging() {
        DesktopWindow window(new QWebEngineView);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(window.windowHandle()->property("_qwk_resize_frame").toRect().isValid());
        auto *view = window.findChild<QWebEngineView *>();
        for (const double width : {std::numeric_limits<double>::quiet_NaN(), -1.0, 1e12}) {
            auto invalid = snapshot(window, *view);
            auto header = invalid.value("titlebar").toMap();
            header["width"] = width;
            invalid["titlebar"] = header;
            window.updateLayout(invalid);
            QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 80));
            QVERIFY(!window.isMaximized());
        }
        window.updateLayout(snapshot(window, *view));
        QTest::mouseDClick(window.windowHandle(), Qt::LeftButton, Qt::NoModifier, view->pos() + QPoint(400, 80));
        QTRY_VERIFY(window.isMaximized());
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

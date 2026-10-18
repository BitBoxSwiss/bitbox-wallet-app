// SPDX-License-Identifier: Apache-2.0
#include <QtTest>
#include <QAbstractButton>
#include <QSettings>
#include <QTemporaryDir>
#include <QWebEngineView>
#include <private/qhighdpiscaling_p.h>
#include <windows.h>
#include "desktopwindow.h"

namespace {
LRESULT hitTest(DesktopWindow &window, const QPoint &position) {
    const auto handle = reinterpret_cast<HWND>(window.winId());
    const auto native = QHighDpi::toNativeLocalPosition(position, window.windowHandle());
    POINT point{native.x(), native.y()};
    if (!ClientToScreen(handle, &point)) return HTERROR;
    return SendMessageW(handle, WM_NCHITTEST, 0, MAKELPARAM(point.x, point.y));
}
QVector<QPair<QPoint, LRESULT>> resizeTargets(const DesktopWindow &window) {
    const int right = window.width() - 3, bottom = window.height() - 3;
    return {{{4, 200}, HTLEFT}, {{right, 200}, HTRIGHT},
            {{200, 4}, HTTOP}, {{200, bottom}, HTBOTTOM},
            {{4, 4}, HTTOPLEFT}, {{right, 4}, HTTOPRIGHT},
            {{4, bottom}, HTBOTTOMLEFT}, {{right, bottom}, HTBOTTOMRIGHT}};
}
}

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
    void init() { QSettings().clear(); QSettings().setValue("nativeDecorations", false); }

    // Fresh settings retain the system frame and do not attach custom caption controls.
    void defaultsUseSystemBorders() {
        QSettings().clear();
        DesktopWindow window(new QWebEngineView);
        QVERIFY(!window.state().value("csd").toBool());
        QVERIFY(window.findChildren<QAbstractButton *>().isEmpty());
    }

    // Caption roles required by Snap survive translated labels, recoloring and window state changes.
    void captionRolesSurviveAppearanceAndMaximization() {
        DesktopWindow window(new QWebEngineView);
        window.resize(800, 600);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QVERIFY(window.state().value("csd").toBool());
        for (const bool maximized : {false, true, false}) {
            if (maximized) window.showMaximized(); else window.showNormal();
            QTRY_COMPARE(window.isMaximized(), maximized);
            QTRY_COMPARE(bool(IsZoomed(reinterpret_cast<HWND>(window.winId()))), maximized);
            window.updateAppearance({{"background", "#333333"}, {"foreground", "#ffffff"},
                {"labels", QVariantMap{{"maximize", "Restore or maximize"}}}});
            const auto buttons = window.state().value("captionButtons").toList();
            QCOMPARE(buttons.size(), 3);
            for (const auto &entry : buttons) {
                const auto button = entry.toMap();
                QCOMPARE(button.value("width").toInt(), 46);
                QCOMPARE(button.value("height").toInt(), 32);
                const auto action = button.value("action").toString();
                const auto expected = action == "maximize" ? HTZOOM : action == "close" ? HTCLOSE : HTREDUCE;
                const QPoint center(button.value("x").toInt() + 23, button.value("y").toInt() + 16);
                QTRY_COMPARE(hitTest(window, center), LRESULT(expected));
            }
            for (auto *button : window.findChildren<QAbstractButton *>()) {
                QCOMPARE(button->focusPolicy(), Qt::NoFocus);
                QVERIFY(!button->accessibleName().isEmpty());
            }
        }
    }

    // All edges/corners resize inside the client area even when compositor shadows are disabled.
    void resizeTargetsRespectFixedDimensionsAndMaximization() {
        DesktopWindow window(new QWebEngineView);
        window.resize(800, 600);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        for (const auto &target : resizeTargets(window)) QCOMPARE(hitTest(window, target.first), target.second);
        window.setFixedWidth(window.width());
        QCOMPARE(hitTest(window, {4, 4}), LRESULT(HTTOP));
        QVERIFY(hitTest(window, {4, 200}) != HTLEFT);
        window.setMinimumWidth(360);
        window.setMaximumWidth(QWIDGETSIZE_MAX);
        window.setFixedHeight(window.height());
        QCOMPARE(hitTest(window, {4, 4}), LRESULT(HTLEFT));
        QVERIFY(hitTest(window, {200, window.height() - 3}) != HTBOTTOM);
        window.setMinimumHeight(375);
        window.setMaximumHeight(QWIDGETSIZE_MAX);
        window.showMaximized();
        QTRY_VERIFY(window.isMaximized());
        for (const auto &target : resizeTargets(window)) {
            const auto hit = hitTest(window, target.first);
            QVERIFY(hit < HTLEFT || hit > HTBOTTOMRIGHT);
        }
    }

    // A fullscreen client has no caption controls or inner resize bands.
    void fullscreenHasNoResizeTargets() {
        DesktopWindow window(new QWebEngineView);
        window.showFullScreen();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(window.isFullScreen());
        for (const auto &target : resizeTargets(window)) QCOMPARE(hitTest(window, target.first), LRESULT(HTCLIENT));
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
#include "desktopwindow-windows.test.moc"

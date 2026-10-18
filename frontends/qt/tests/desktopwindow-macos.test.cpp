// SPDX-License-Identifier: Apache-2.0
#include <QtTest>
#include <QSettings>
#include <QTemporaryDir>
#include <QWebEngineView>
#include <QWKWidgets/widgetwindowagent.h>
#include "desktopwindow.h"

class DesktopWindowTest final : public QObject {
    Q_OBJECT
private slots:
    void initTestCase() {
        QSettings::setDefaultFormat(QSettings::IniFormat);
        QSettings::setPath(QSettings::IniFormat, QSettings::UserScope, settings_.path());
        qApp->setOrganizationName("BitBoxCSDTest");
        qApp->setApplicationName("BitBoxCSDTest");
        qunsetenv("BITBOXAPP_NATIVE_DECORATIONS");
        QSettings().clear();
        QSettings().setValue("nativeDecorations", false);
    }

    // Presets replace native traffic lights without replacing the window; System default restores them.
    void captionPreviewsReplaceAndRestoreTrafficLights() {
        DesktopWindow window(new QWebEngineView);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        const auto handle = window.windowHandle();
        auto *agent = window.findChild<QWK::WidgetWindowAgent *>();
        QVERIFY(agent);
        for (const auto &style : QStringList{"system", "windows", "ubuntu", "fedora", "macos", "system"}) {
            window.setPreviewButtonStyle(style);
            const auto state = window.state();
            QCOMPARE(state.value("previewButtonStyle").toString(), style);
            QCOMPARE(agent->windowAttribute("no-system-buttons").toBool(), style != "system");
            QCOMPARE(state.value("captionButtons").toList().size(), style == "system" ? 0 : style == "fedora" ? 1 : 3);
            QCOMPARE(window.windowHandle(), handle);
            DesktopWindow restored(new QWebEngineView);
            QCOMPARE(restored.state().value("previewButtonStyle").toString(), style);
        }
        QVERIFY(window.state().value("leftInset").toDouble() > 0);
        QCOMPARE(window.state().value("rightInset").toDouble(), 0.0);
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
#include "desktopwindow-macos.test.moc"

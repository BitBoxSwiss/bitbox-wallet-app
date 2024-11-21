// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <singleapplication.h>
#include <QApplication>
#include <QCoreApplication>
#include <QFile>
#include <QWebEngineView>
#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebChannel>
#include <QWebEngineUrlRequestInterceptor>
#include <QContextMenuEvent>
#include <QMenu>
#include <QRegularExpression>
#include <QThread>
#include <QMutex>
#include <QResource>
#include <QByteArray>
#include <QSettings>
#include <QMenu>
#include <QSystemTrayIcon>
#include <QMessageBox>
#include <QtGlobal>
#if defined(_WIN32)
#if QT_VERSION_MAJOR >= 6
#include <private/qguiapplication_p.h>
#else
#include <QtPlatformHeaders/QWindowsWindowFunctions>
#endif
#endif

#include <iostream>
#include <set>
#include <stdlib.h>
#include <string>
#include <string.h>

#include "filedialog.h"
#include "libserver.h"
#include "webclass.h"

#define APPNAME "BitBoxApp"

static QWebEngineView* view;
static QWebEnginePage* mainPage;
static QWebEnginePage* externalPage;
static bool pageLoaded = false;
static WebClass* webClass;
static QMutex webClassMutex;
static QSystemTrayIcon* trayIcon;

class BitBoxApp : public SingleApplication
{
public:
    BitBoxApp(int &argc, char **argv): SingleApplication(
        argc,
        argv,
        true, // allow 2nd instance to launch so we can send a message to the primary instance
        // User: different users can each have one instance.
        // SecondaryNotification: enable instanceStarted event.
        // ExcludeAppVersion: we want one instance independent of its version
        // ExcludeAppPath: the path might not always be the same, especially with .AppImage, it extracts to a new location on every launch.
        Mode::User | Mode::SecondaryNotification | Mode::ExcludeAppVersion | Mode::ExcludeAppPath)
    {
    }

#if defined(Q_OS_MACOS)
    bool event(QEvent *event) override
    {
        if (event->type() == QEvent::FileOpen) {
            QFileOpenEvent* openEvent = static_cast<QFileOpenEvent*>(event);
            if (!openEvent->url().isEmpty()) {
                // This is only supported on macOS and is used to handle URIs that are opened with
                // the BitBoxApp, such as "aopp:..." links. The event is received and handled both
                // if the BitBoxApp is launched and also when it is already running, in which case
                // it is brought to the foreground automatically.

                handleURI(openEvent->url().toString().toUtf8().constData());
            }
        }

        return QApplication::event(event);
    }
#endif
};

class WebEnginePage : public QWebEnginePage {
public:
    WebEnginePage(QObject* parent) : QWebEnginePage(parent) {}

    QWebEnginePage* createWindow(QWebEnginePage::WebWindowType type) {
        return externalPage;
    }

    virtual void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level, const QString &message, int lineNumber, const QString &sourceID)
    {
        // Log frontend console messages to the Go log.txt.
        QString formattedMsg = QString("msg: %1; line %2; source: %3").arg(message).arg(lineNumber).arg(sourceID);
        goLog(formattedMsg.toUtf8().constData());
    }
};

class RequestInterceptor : public QWebEngineUrlRequestInterceptor {
public:
    explicit RequestInterceptor() : QWebEngineUrlRequestInterceptor() { }
    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
        // Do not block qrc:/ local pages or js blobs
        if (info.requestUrl().scheme() == "qrc" || info.requestUrl().scheme() == "blob" || info.requestUrl().scheme() == "data") {
            return;
        }

        auto currentUrl = mainPage->requestedUrl().toString();
        auto requestedUrl = info.requestUrl().toString();

        // We treat the exchange pages specially because we need to allow exchange
        // widgets to load in an iframe as well as let them open external links
        // in a browser.
        bool onExchangePage = currentUrl.contains(QRegularExpression("^qrc:/exchange/.*$"));
        bool onBitsurancePage = currentUrl.contains(QRegularExpression("^qrc:/bitsurance/.*$"));
        if (onExchangePage || onBitsurancePage) {
            if (info.firstPartyUrl().toString() == info.requestUrl().toString()) {
                // Ignore requests for certain file types (e.g., .js, .css) Somehow Moonpay loads
                // https://buy.moonpay.com/serviceWorker.js in a way where `info.navigationType()`
                // is Link (link clicked, see
                // https://doc.qt.io/qt-6/qwebengineurlrequestinfo.html#NavigationType-enum). We
                // can't figure out why that happens or how to easily identify the case other than
                // to exclude such files from being handled here.
                if (requestedUrl.endsWith(".js") || requestedUrl.endsWith(".css")) {
                    return;
                }

                // A link with target=_blank was clicked.
                systemOpen(info.requestUrl().toString().toUtf8().constData());
                // No need to also load it in our page.
                info.block(true);
            }
            return;
        }

        // All the requests originated in the wallet-connect section are allowed, as they are needed to
        // load the Dapp logos and it is not easy to filter out non-images requests.
        bool onWCPage = currentUrl.contains(QRegularExpression(R"(^qrc:/account/[^\/]+/wallet-connect/.*$)"));
        if (onWCPage) {
            return;
        }

        // Needed for the wallet connect workflow.
        bool verifyWCRequest = requestedUrl.contains(QRegularExpression(R"(^https://verify\.walletconnect\.com/.*$)"));
        if (verifyWCRequest) {
            return;
        }

        std::cerr << "Blocked: " << info.requestUrl().toString().toStdString() << std::endl;
        info.block(true);
    };
};

class WebEngineView : public QWebEngineView {
public:
    void closeEvent(QCloseEvent*) override {
        QSettings settings;
        settings.setValue("mainWindowGeometry", saveGeometry());
    }

    QSize sizeHint() const override {
        // Default initial window size.
        return QSize(1257, 785);
    }

    void contextMenuEvent(QContextMenuEvent *event) override {
        std::set<QAction*> whitelist = {
            page()->action(QWebEnginePage::Cut),
            page()->action(QWebEnginePage::Copy),
            page()->action(QWebEnginePage::Paste),
            page()->action(QWebEnginePage::Undo),
            page()->action(QWebEnginePage::Redo),
            page()->action(QWebEnginePage::SelectAll),
            page()->action(QWebEnginePage::Unselect),
        };
#if QT_VERSION_MAJOR >= 6
        QMenu *menu = createStandardContextMenu();
#else
        QMenu *menu = page()->createStandardContextMenu();
#endif
        for (const auto action : menu->actions()) {
            if (whitelist.find(action) == whitelist.cend()) {
                menu->removeAction(action);
            }
        }
        if (!menu->isEmpty()) {
            menu->popup(event->globalPos());
        }
    }
};

static QString loadHtmlFromQrc(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly)) {
        std::cerr << "Failed to load file:" << filePath.toStdString() << std::endl;
        return QString("Failed to load file");
    }
    QTextStream stream(&file);
    return stream.readAll();
}

int main(int argc, char *argv[])
{
    // Enable auto HiDPI scaling to correctly manage scale factor on bigger screens
    QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);

    // Make `@media (prefers-color-scheme: light/dark)` CSS rules work.
    // See https://github.com/qutebrowser/qutebrowser/issues/5915#issuecomment-737115530
    // This might only be needed for Qt 5.15.2, should revisit this when updating Qt.
    qputenv("QTWEBENGINE_CHROMIUM_FLAGS", "--blink-settings=preferredColorScheme=1");

    // QT configuration parameters which change the attack surface for memory
    // corruption vulnerabilities
#if QT_VERSION >= QT_VERSION_CHECK(5,8,0)
    qputenv("QT_ENABLE_REGEXP_JIT", "0");
    qputenv("QV4_FORCE_INTERPRETER", "1");
    qputenv("DRAW_USE_LLVM", "0");
#endif

    // The QtWebEngine may make a clone3 syscall introduced in glibc v2.34.
    // The syscall is missing from the Chromium sandbox whitelist in Qt versions 5.15.2
    // and earlier which visually results in a blank app screen.
    // Disabling the sandbox allows all syscalls.
    //
    // See the following for more details.
    // https://github.com/BitBoxSwiss/bitbox-wallet-app/issues/1447
    // https://bugreports.qt.io/browse/QTBUG-96214
    // https://bugs.launchpad.net/ubuntu/+source/glibc/+bug/1944468
#if defined(Q_OS_LINUX)
    const static char* kDisableWebSandbox = "QTWEBENGINE_DISABLE_SANDBOX";
    if (!qEnvironmentVariableIsSet(kDisableWebSandbox)) {
        qputenv(kDisableWebSandbox, "1");
    }
#endif

    QString renderMode = qEnvironmentVariable("BITBOXAPP_RENDER", "software");
    if (renderMode == "software") {
        // Force software rendering over GPU-accelerated rendering as various rendering artefact
        // issues were observed on Windows and the app crashes on some Linux systems.
        qputenv("QMLSCENE_DEVICE", "softwarecontext");
        qputenv("QT_QUICK_BACKEND", "software");
        goLog("BITBOXAPP_RENDER=software");
    } else if (renderMode == "auto") {
        // Do nothing: leave it to Qt to decide the rendering backend, which is usually hardware
        // accelerated if available.
        //
        // In rare cases, this can lead to rendering artefacts and crashes, which is why it is not
        // enabled by default.
        std::cerr << "Rendering mode: automatic (usually hardware accelerated)" << std::endl;
        goLog("BITBOXAPP_RENDER=auto");
    } else {
        std::cerr << "Invalid value for BITBOXAPP_RENDER" << std::endl;
        goLog("Invalid value for BITBOXAPP_RENDER");
        return 1;
    }

    BitBoxApp a(argc, argv);
    // These three are part of the SingleApplication instance ID - if changed, the user should close
    // th existing app before launching the new one.
    // See https://github.com/BitBoxSwiss/SingleApplication/blob/c557da5d0cb63b8002c1ba99ec18f257620009b1/singleapplication_p.cpp#L135-L137
    a.setApplicationName(APPNAME);
    a.setOrganizationDomain("shiftcrypto.ch");
    a.setOrganizationName("Shift Crypto");
    a.setWindowIcon(QIcon(QCoreApplication::applicationDirPath() + "/bitbox.png"));

    if(a.isSecondary()) {
        // The application is already running. If there is exactly one positional argument, we send
        // assume it is an URI click and send it to the primary instance to parse, validate and
        // handle.

        if (a.arguments().size() == 2) {
            a.sendMessage(a.arguments()[1].toUtf8());
        }
        qDebug() << "App already running.";
        return 0;
    }

    view = new WebEngineView();
    view->setGeometry(0, 0, a.devicePixelRatio() * view->width(), a.devicePixelRatio() * view->height());
    view->setMinimumSize(360, 375);

    // Bring the primary instance to the foreground.
    QObject::connect(
        &a, &SingleApplication::instanceStarted,
        [&]() {
            view->activateWindow();
            view->raise();
        });

    QSettings settings;
    if (settings.contains("mainWindowGeometry")) {
        // std::cout << settings.fileName().toStdString() << std::endl;
        view->restoreGeometry(settings.value("mainWindowGeometry").toByteArray());
    } else {
        view->adjustSize();
    }

    externalPage = new QWebEnginePage(view);
    mainPage = new WebEnginePage(view);
    view->setPage(mainPage);

    pageLoaded = false;
    QObject::connect(view, &QWebEngineView::loadFinished, [](bool ok){ pageLoaded = ok; });

    QResource::registerResource(QCoreApplication::applicationDirPath() + "/assets.rcc");

    QString preferredLocale = "";
    QStringList uiLangs = QLocale::system().uiLanguages();
    if (!uiLangs.isEmpty()) {
        preferredLocale = uiLangs.first();
    }

    QThread workerThread;
    webClass = new WebClass();
    // Run client queries in a separate thread to not block the UI.
    webClass->moveToThread(&workerThread);
    workerThread.start();

    serve(
        // cppHeapFree
        [](void* ptr) { ::free(ptr); },
        // pushNotificationsCallback
        [](const char* msg) {
            if (!pageLoaded) return;
            webClassMutex.lock();
            if (webClass != nullptr) {
                webClass->pushNotify(QString(msg));
            }
            webClassMutex.unlock();
        },
        // responseCallback
        [](int queryID, const char* msg) {
            if (!pageLoaded) return;
            webClassMutex.lock();
            if (webClass != nullptr) {
                webClass->gotResponse(queryID, QString(msg));
            }
            webClassMutex.unlock();
        },
        // notifyUserCallback
        [](const char* msg) {
            if (trayIcon == nullptr) return;
            QMetaObject::invokeMethod(trayIcon, "showMessage",
                                      Qt::QueuedConnection,
                                      Q_ARG(QString, APPNAME),
                                      Q_ARG(QString, msg));
        },
        // user preferred UI language
        preferredLocale.toStdString().c_str(),
        // getSaveFilenameCallback
        [](const char* suggestedFilename) {
            QString filename = FileDialogCaller().getSaveFileName(
                view,
                "Save File",
                suggestedFilename);
            // Copy the string to an area allocated by malloc. The caller of this function has to
            // free the memory.
            std::string stdString = filename.toStdString();
            const char* cString = stdString.c_str();
            char* result = (char*)::malloc(strlen(cString)+1); // Go must free with C.customHeapFree
            memcpy(result, cString, strlen(cString)+1);
            return result;
        });

    RequestInterceptor interceptor;
    view->page()->profile()->setUrlRequestInterceptor(&interceptor);
    QObject::connect(
        view->page(),
        &QWebEnginePage::featurePermissionRequested,
        [&](const QUrl& securityOrigin, QWebEnginePage::Feature feature) {
            if (feature == QWebEnginePage::MediaVideoCapture) {
                // Allow video capture for QR code scanning.
                view->page()->setFeaturePermission(
                    securityOrigin,
                    feature,
                    QWebEnginePage::PermissionGrantedByUser);
            }
        });
    QWebChannel channel;
    channel.registerObject("backend", webClass);
    view->page()->setWebChannel(&channel);
    view->show();
    // We use setHtml instead of load() because on linux, the local mimetype database is changed
    // when FireFox sets itself as the default browser, and .html files are delivered as
    // "application/x-extension-html", making the webview show a blank page instead of our app.
    // The qrc:/ base name is so Moonpay can load (they whitelisted this base domain :o).
    view->setHtml(loadHtmlFromQrc(":/index.html"), QUrl("qrc:/"));

    // Create TrayIcon
    {
        auto quitAction = new QAction("&Quit", &a);
        QObject::connect(quitAction, &QAction::triggered, &a, &QCoreApplication::quit);
        auto trayIconMenu = new QMenu(view);
        trayIconMenu->addAction(quitAction);

        trayIcon = new QSystemTrayIcon(QIcon(":/trayicon.png"), view);
        trayIcon->setToolTip(APPNAME);
        trayIcon->setContextMenu(trayIconMenu);
        trayIcon->show();
    }

    QObject::connect(&a, &QApplication::aboutToQuit, [&]() {
        webClassMutex.lock();
        channel.deregisterObject(webClass);
        delete webClass;
        webClass = nullptr;
        delete view;
        view = nullptr;
        webClassMutex.unlock();
        workerThread.quit();
        workerThread.wait();
    });

#if defined(_WIN32)
    // Allow existing app to be brought to the foreground. See `view->activateWindow()` above.
    // Without this, on Windows, only the taskbar entry would light up.
#if QT_VERSION_MAJOR >= 6
    // See See https://forum.qt.io/topic/133694/using-alwaysactivatewindow-to-gain-foreground-in-win10-using-qt6-2/2
    // Later Qt versions may expose this API again officially. https://www.qt.io/blog/platform-apis-in-qt-6.
    if (auto inf = a.nativeInterface<QNativeInterface::Private::QWindowsApplication>()) {
        inf->setWindowActivationBehavior(QNativeInterface::Private::QWindowsApplication::AlwaysActivateWindow);
    }
#else
    QWindowsWindowFunctions::setWindowActivationBehavior(QWindowsWindowFunctions::AlwaysActivateWindow);
#endif
#endif

    // Receive and handle an URI sent by a secondary instance (see above).
    QObject::connect(
        &a,
        &SingleApplication::receivedMessage,
        [&](int instanceId, QByteArray message) {
            QString arg = QString::fromUtf8(message);
            qDebug() << "Received arg from secondary instance:" << arg;
            handleURI(arg.toUtf8().constData());
        });
    // Handle URI which the app was launched with in the primary instance.
    if (a.arguments().size() == 2) {
        handleURI(a.arguments()[1].toUtf8().constData());
    }

    return a.exec();
}

// SPDX-License-Identifier: Apache-2.0

#include <singleapplication.h>
#include <QApplication>
#include <QCoreApplication>
#include <QWebEngineView>
#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebChannel>
#include <QWebEngineUrlRequestInterceptor>
#include <QWebEngineUrlScheme>
#include <QWebEngineUrlSchemeHandler>
#include <QWebEngineUrlRequestJob>
#include <QWebEngineSettings>
#include <QMimeDatabase>
#include <QFile>
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
#include <QtSystemDetection>
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
#include "urlhandler.h"
#include "network.h"

#define APPNAME "BitBoxApp"

// Custom scheme so we can intercept and serve local files.
// If you change this, MoonPay may break, as this scheme is whitelisted as a frame ancestor in
// their CSP response headers.
static const char* scheme = "bitboxapp";

static QWebEngineProfile* profile;
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
};

class WebEnginePage : public QWebEnginePage {
public:
    WebEnginePage(QWebEngineProfile* profile) : QWebEnginePage(profile) {}

    QWebEnginePage* createWindow(QWebEnginePage::WebWindowType type) {
        Q_UNUSED(type);
        return externalPage;
    }

    virtual void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level, const QString &message, int lineNumber, const QString &sourceID)
    {
        // Log frontend console messages to the Go log.txt.
        Q_UNUSED(level);
        QString formattedMsg = QString("msg: %1; line %2; source: %3").arg(message).arg(lineNumber).arg(sourceID);
        goLog(formattedMsg.toUtf8().constData());
    }
};

// Custom scheme handler so we can force mime type resolution manually.
// Without this, on linux the local mimetype database can mess with the mimetype resolution.
// Programs like monodevelop or Steam/Proton install weird mime types making for example our
// .js or .html files be served with the wrogn mimetype, resulting in the webengine displaying a
// blank page only.
class SchemeHandler : public QWebEngineUrlSchemeHandler {
public:
    // Similar like the built-in qrc scheme handler, but with hardcoded mime-types.
    // https://github.com/qt/qtwebengine/blob/v6.2.4/src/core/net/qrc_url_scheme_handler.cpp
    void requestStarted(QWebEngineUrlRequestJob *request) override {
        QByteArray requestMethod = request->requestMethod();
        if (requestMethod != "GET") {
            request->fail(QWebEngineUrlRequestJob::RequestDenied);
            return;
        }
        QUrl url = request->requestUrl();
        QString path = url.path();

        QMimeDatabase mimeDb;

        QMimeType mimeType = mimeDb.mimeTypeForFile(path);

        QString hardcodedMimeType;
        if (path.endsWith(".html")) {
            hardcodedMimeType = "text/html";
        } else if (path.endsWith(".js")) {
            hardcodedMimeType = "application/javascript";
        } else if (path.endsWith(".css")) {
            hardcodedMimeType = "text/css";
        } else if (path.endsWith(".svg")) {
            hardcodedMimeType = "image/svg+xml";
        } else {
            // Fallback to detected mimetype.
            hardcodedMimeType = mimeType.name();
        }

        // Read resource from QRC (local static assets).
        auto file = new QFile(":" + path);
        if (file->open(QIODevice::ReadOnly)) {
            request->reply(hardcodedMimeType.toUtf8(), file);
            file->setParent(request);
        } else {
            delete file;
            request->fail(QWebEngineUrlRequestJob::UrlNotFound);
        }
    }
};

class RequestInterceptor : public QWebEngineUrlRequestInterceptor {
public:
    explicit RequestInterceptor() : QWebEngineUrlRequestInterceptor() { }
    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
        // Do not block qrc:/ local pages or js blobs
        if (info.requestUrl().scheme() == scheme || info.requestUrl().scheme() == "blob") {
            return;
        }

        auto currentUrl = mainPage->requestedUrl().toString();
        auto requestedUrl = info.requestUrl().toString();

        // We treat the exchange pages specially because we need to allow exchange
        // widgets to load in an iframe as well as let them open external links
        // in a browser.
        bool onExchangePage = currentUrl.contains(QRegularExpression(QString(R"(^%1:/index\.html\#/market/.*$)").arg(scheme)));
        bool onBitsurancePage = currentUrl.contains(QRegularExpression(QString(R"(^%1:/index\.html\#/bitsurance/.*$)").arg(scheme)));
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
        bool onWCPage = currentUrl.contains(QRegularExpression(QString(R"(^%1:/index\.html\#/account/[^\/]+/wallet-connect/.*$)").arg(scheme)));
        if (onWCPage) {
            return;
        }

        // Needed for the wallet connect workflow.
        bool verifyWCRequest = requestedUrl.contains(QRegularExpression(R"(^https://verify\.walletconnect\.org/.*$)"));
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

int main(int argc, char *argv[])
{
    // QT configuration parameters which change the attack surface for memory
    // corruption vulnerabilities
#if QT_VERSION >= QT_VERSION_CHECK(5,8,0)
    qputenv("QT_ENABLE_REGEXP_JIT", "0");
    qputenv("QV4_FORCE_INTERPRETER", "1");
    qputenv("DRAW_USE_LLVM", "0");
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
    // The URI scheme handler for aopp is handled via OS events on macOS. The other platforms invoke
    // the process with the uri as a command line param.
#if defined(Q_OS_MACOS)
    UrlHandler url_handler;
    url_handler.setup();
#endif
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

    QWebEngineUrlScheme bbappScheme(scheme);
    bbappScheme.setSyntax(QWebEngineUrlScheme::Syntax::Path);
    bbappScheme.setFlags(QWebEngineUrlScheme::SecureScheme);
    QWebEngineUrlScheme::registerScheme(bbappScheme);

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

    profile = new QWebEngineProfile("BitBoxApp");
    externalPage = new QWebEnginePage(profile, view);
    mainPage = new WebEnginePage(profile);
    view->setPage(mainPage);

    pageLoaded = false;
    QObject::connect(view, &QWebEngineView::loadFinished, [](bool ok){ pageLoaded = ok; });

    QResource::registerResource(QCoreApplication::applicationDirPath() + "/assets.rcc");

    QString preferredLocale = "";
    QStringList uiLangs = QLocale::system().uiLanguages();
    if (!uiLangs.isEmpty()) {
        preferredLocale = uiLangs.first();
    }

    webClass = new WebClass();

    setupReachabilityNotifier();

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

    // Trigger the online status change event once at startup.
    setOnline(isReachable());

    RequestInterceptor interceptor;
    view->page()->profile()->setUrlRequestInterceptor(&interceptor);

    // For manual mimetype resolution.
    SchemeHandler schemeHandler;
    view->page()->profile()->installUrlSchemeHandler(scheme, &schemeHandler);

    QObject::connect(
        view->page(),
        &QWebEnginePage::permissionRequested,
        [&](QWebEnginePermission permission) {
            // Allow video capture for QR code scanning.
            if (permission.permissionType() == QWebEnginePermission::PermissionType::MediaVideoCapture) {
                permission.grant();
            }
        });
    QWebChannel channel;
    channel.registerObject("backend", webClass);
    view->page()->setWebChannel(&channel);
    view->settings()->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, true);
    view->settings()->setAttribute(QWebEngineSettings::JavascriptCanPaste, true);
    view->show();
    view->load(QUrl(QString("%1:/index.html").arg(scheme)));

    // Create TrayIcon
    {
        auto quitAction = new QAction("&Quit", &a);
        QObject::connect(quitAction, &QAction::triggered, &a, &QCoreApplication::quit);
        auto trayIconMenu = new QMenu(view);
        trayIconMenu->addAction(quitAction);
        QIcon trayIconIcon(":/trayicon.png");
        trayIconIcon.setIsMask(true);
        trayIcon = new QSystemTrayIcon(trayIconIcon, view);
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
        // Make sure mainPage is deleted before the profile. This is a requirement for the profile
        // to be able to flush to disk properly.
        delete mainPage;
        mainPage = nullptr;
        delete profile;
        profile = nullptr;
        webClassMutex.unlock();
        backendShutdown();
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
            Q_UNUSED(instanceId)
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

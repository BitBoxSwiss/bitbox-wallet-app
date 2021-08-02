#include <singleapplication.h>
#include <QApplication>
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
#if defined(_WIN32)
#include <QtPlatformHeaders/QWindowsWindowFunctions>
#endif

#include <iostream>
#include <set>
#include <string>

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

                handleURI(const_cast<char*>(openEvent->url().toString().toStdString().c_str()));
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
};

class RequestInterceptor : public QWebEngineUrlRequestInterceptor {
public:
    explicit RequestInterceptor() : QWebEngineUrlRequestInterceptor() { }
    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
#ifdef QT_BITBOX_ALLOW_EXTERNAL_URLS
        // Do not block anything.
        return;
#endif
        // Do not block qrc:/ local pages or js blobs
        if (info.requestUrl().scheme() == "qrc" || info.requestUrl().scheme() == "blob") {
            return;
        }

        // We treat the onramp page specially because we need to allow onramp
        // widgets to load in an iframe as well as let them open external links
        // in a browser.
        auto currentUrl = mainPage->requestedUrl().toString();
        bool onBuyPage = currentUrl.contains(QRegularExpression("^qrc:/buy/.*$"));
        if (onBuyPage) {
            if (info.firstPartyUrl().toString() == info.requestUrl().toString()) {
                // A link with target=_blank was clicked.
                systemOpen(const_cast<char*>(info.requestUrl().toString().toStdString().c_str()));
                // No need to also load it in our page.
                info.block(true);
            }
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
        QMenu *menu = page()->createStandardContextMenu();
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
// Enable auto HiDPI scaling on Windows only for now.
#if defined(_WIN32) && QT_VERSION >= QT_VERSION_CHECK(5,6,0)
    QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#endif

// QT configuration parameters which change the attack surface for memory
// corruption vulnerabilities
#if QT_VERSION >= QT_VERSION_CHECK(5,8,0)
    qputenv("QT_ENABLE_REGEXP_JIT", "0");
    qputenv("QV4_FORCE_INTERPRETER", "1");
    qputenv("DRAW_USE_LLVM", "0");
#endif
    qputenv("QSG_RHI", "1");


    BitBoxApp a(argc, argv);
    // These three are part of the SingleApplication instance ID - if changed, the user should close
    // th existing app before launching the new one.
    // See https://github.com/digitalbitbox/SingleApplication/blob/c557da5d0cb63b8002c1ba99ec18f257620009b1/singleapplication_p.cpp#L135-L137
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
    view->setMinimumSize(650, 375);

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
        preferredLocale.toStdString().c_str()
        );

    RequestInterceptor interceptor;
    view->page()->profile()->setRequestInterceptor(&interceptor);
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
    view->load(QUrl("qrc:/index.html"));

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
    QWindowsWindowFunctions::setWindowActivationBehavior(QWindowsWindowFunctions::AlwaysActivateWindow);
#endif

    // Receive and handle an URI sent by a secondary instance (see above).
    QObject::connect(
        &a,
        &SingleApplication::receivedMessage,
        [&](int instanceId, QByteArray message) {
            QString arg = QString::fromUtf8(message);
            qDebug() << "Received arg from secondary instance:" << arg;
            handleURI(const_cast<char*>(arg.toStdString().c_str()));
        });
    // Handle URI which the app was launched with in the primary instance.
    if (a.arguments().size() == 2) {
        handleURI(const_cast<char*>(a.arguments()[1].toStdString().c_str()));
    }

    return a.exec();
}

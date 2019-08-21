#include <QApplication>
#include <QWebEngineView>
#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebChannel>
#include <QWebEngineUrlRequestInterceptor>
#include <QContextMenuEvent>
#include <QMenu>
#include <QThread>
#include <QMutex>
#include <QResource>
#include <QByteArray>
#include <QSettings>
#include <QMenu>
#include <QSystemTrayIcon>

#include <iostream>
#include <set>
#include <string>

#include "libserver.h"
#include "webclass.h"

#define APPNAME "BitBox App"

static QWebEngineView* view;
static bool pageLoaded = false;
static WebClass* webClass;
static QMutex webClassMutex;
static QSystemTrayIcon* trayIcon;

class RequestInterceptor : public QWebEngineUrlRequestInterceptor {
public:
    explicit RequestInterceptor() : QWebEngineUrlRequestInterceptor() { }
    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
#ifdef QT_BITBOX_ALLOW_EXTERNAL_URLS
        // Do not block anything.
        return;
#endif
        if (info.requestUrl().scheme() != "qrc" && info.requestUrl().scheme() != "blob") {
            std::cerr << "Blocked: " << info.requestUrl().toString().toStdString() << std::endl;
            info.block(true);
        }
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
        return QSize(1257, 675);
    }

    void contextMenuEvent(QContextMenuEvent *event) override {
        std::set<QAction*> whitelist = {
            page()->action(QWebEnginePage::Cut),
            page()->action(QWebEnginePage::Copy),
            page()->action(QWebEnginePage::Paste),
            page()->action(QWebEnginePage::Undo),
            page()->action(QWebEnginePage::Redo),
            page()->action(QWebEnginePage::SelectAll),
            page()->action(QWebEnginePage::CopyLinkToClipboard),
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
    // note: doesn't work as expected. Users with hidpi enabled should set the environment flag themselves
    // turn on the DPI support**
// #if QT_VERSION >= QT_VERSION_CHECK(5,6,0)
//     QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
// #else
//     qputenv("QT_AUTO_SCREEN_SCALE_FACTOR", QByteArray("1"));
// #endif // QT_VERSION

// QT configuration parameters which change the attack surface for memory
// corruption vulnerabilities
#if QT_VERSION >= QT_VERSION_CHECK(5,8,0)
    qputenv("QT_ENABLE_REGEXP_JIT", "0");
    qputenv("QV4_FORCE_INTERPRETER", "1");
    qputenv("DRAW_USE_LLVM", "0");
#endif
#if QT_VERSION >= QT_VERSION_CHECK(5,11,0)
    qputenv("QMLSCENE_DEVICE", "softwarecontext");
    qputenv("QT_QUICK_BACKEND", "software");
#endif


    QApplication a(argc, argv);
    a.setApplicationName(APPNAME);
    a.setOrganizationDomain("shiftcrypto.ch");
    a.setOrganizationName("Shift Cryptosecurity");
    view = new WebEngineView();
    view->setGeometry(0, 0, a.devicePixelRatio() * view->width(), a.devicePixelRatio() * view->height());
    view->setMinimumSize(650, 375);

    QSettings settings;
    if (settings.contains("mainWindowGeometry")) {
        // std::cout << settings.fileName().toStdString() << std::endl;
        view->restoreGeometry(settings.value("mainWindowGeometry").toByteArray());
    } else {
        view->adjustSize();
    }

    pageLoaded = false;
    QObject::connect(view, &QWebEngineView::loadFinished, [](bool ok){ pageLoaded = ok; });

    QResource::registerResource(QCoreApplication::applicationDirPath() + "/assets.rcc");

    QThread workerThread;
    webClass = new WebClass();
    // Run client queries in a separate thread to not block the UI.
    webClass->moveToThread(&workerThread);
    workerThread.start();

    serve([](const char* msg) {
            if (!pageLoaded) return;
            webClassMutex.lock();
            if (webClass != nullptr) {
                webClass->pushNotify(QString(msg));
            }
            webClassMutex.unlock();
        },
        [](int queryID, const char* msg) {
            if (!pageLoaded) return;
            webClassMutex.lock();
            if (webClass != nullptr) {
                webClass->gotResponse(queryID, QString(msg));
            }
            webClassMutex.unlock();
        },
        [](const char* msg) {
            if (trayIcon == nullptr) return;
            QMetaObject::invokeMethod(trayIcon, "showMessage",
                                      Qt::QueuedConnection,
                                      Q_ARG(QString, APPNAME),
                                      Q_ARG(QString, msg));
        }
        );

    RequestInterceptor interceptor;
    view->page()->profile()->setRequestInterceptor(&interceptor);
    QObject::connect(
        view->page(),
        &QWebEnginePage::featurePermissionRequested,
        [&](const QUrl& securityOrigin, QWebEnginePage::Feature feature) {
            if (securityOrigin.toString() != "qrc://") {
                return;
            }
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

    return a.exec();
}

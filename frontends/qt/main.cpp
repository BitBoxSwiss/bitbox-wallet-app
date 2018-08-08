#include <QApplication>
#include <QWebEngineView>
#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebChannel>
#include <QWebEngineUrlRequestInterceptor>
#include <QThread>
#include <QMutex>
#include <QResource>
#include <QByteArray>
#include <QSettings>
#include <iostream>
#include <string>

#include "libserver.h"
#include "webclass.h"

static QWebEngineView* view;
static bool pageLoaded = false;
static WebClass* webClass;
static QMutex webClassMutex;

class RequestInterceptor : public QWebEngineUrlRequestInterceptor {
public:
    explicit RequestInterceptor(const char* _token) : QWebEngineUrlRequestInterceptor(), token(_token) { }
    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
        std::string header = std::string("Basic ") + token;
        info.setHttpHeader("Authorization", QByteArray(header.c_str()));
    };
private:
    std::string token;
};

class WebEngineView : public QWebEngineView {
public:
    void closeEvent(QCloseEvent*) override {
        QSettings settings;
        settings.setValue("mainWindowGeometry", saveGeometry());
    }

    QSize sizeHint() const override {
        // Default initial window size.
        return QSize(1160, 675);
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
    qputenv("QMLSCENE_DEVICE", "softwarecontext");
    qputenv("QT_QUICK_BACKEND", "software");
    qputenv("QT_ENABLE_REGEXP_JIT", "0");
    qputenv("QV4_FORCE_INTERPRETER", "1");
#endif

    QApplication a(argc, argv);
    a.setApplicationName(QString("BitBox Wallet"));
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

    view->setContextMenuPolicy(Qt::NoContextMenu);

    pageLoaded = false;
    QObject::connect(view, &QWebEngineView::loadFinished, [](bool ok){ pageLoaded = ok; });

    QResource::registerResource(QCoreApplication::applicationDirPath() + "/assets.rcc");

    QThread workerThread;
    webClass = new WebClass();
    // Run client queries in a separate to not block the UI.
    webClass->moveToThread(&workerThread);
    workerThread.start();

    ConnectionData serveData = serve(
                                     [](const char* msg) {
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
                                     }
                                     );

    RequestInterceptor interceptor(serveData.token);
    view->page()->profile()->setRequestInterceptor(&interceptor);
    QWebChannel channel;
    channel.registerObject("backend", webClass);
    view->page()->setWebChannel(&channel);
    view->show();
    view->load(QUrl("qrc:/index.html"));

    QObject::connect(&a, &QApplication::aboutToQuit, [&]() {
            webClassMutex.lock();
            channel.deregisterObject(webClass);
            delete webClass;
            webClass = nullptr;
            webClassMutex.unlock();
            workerThread.quit();
            workerThread.wait();
        });

    return a.exec();
}

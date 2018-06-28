#include <QApplication>
#include <QWebEngineView>
#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebChannel>
#include <QWebEngineUrlRequestInterceptor>
#include <QThread>
#include <QResource>
#include <QByteArray>

#include <iostream>
#include <string>

#include "libserver.h"
#include "webclass.h"

static QWebEngineView* view;
static bool pageLoaded = false;
static WebClass* webClass;

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

int main(int argc, char *argv[])
{
    // note: doesn't work as expected. Users with hidpi enabled should set the environment flag themselves
    // turn on the DPI support**
// #if QT_VERSION >= QT_VERSION_CHECK(5,6,0)
//     QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
// #else
//     qputenv("QT_AUTO_SCREEN_SCALE_FACTOR", QByteArray("1"));
// #endif // QT_VERSION

    QApplication a(argc, argv);
    a.setApplicationName(QString("BitBox Wallet"));
    view = new QWebEngineView;
    view->setGeometry(0, 0, a.devicePixelRatio() * view->width(), a.devicePixelRatio() * view->height());
    view->setMinimumSize(850, 675);
    view->showMaximized();
    view->setContextMenuPolicy(Qt::NoContextMenu);
    pageLoaded = false;
    QObject::connect(view, &QWebEngineView::loadFinished, [](bool ok){ pageLoaded = ok; });

    QResource::registerResource(QCoreApplication::applicationDirPath() + "/assets.rcc");

    QThread workerThread;
    webClass = new WebClass();
    // Run client queries in a separate to not block the UI.
    webClass->moveToThread(&workerThread);
    workerThread.start();
    QObject::connect(&a, &QApplication::aboutToQuit, &workerThread, &QThread::quit);

    ConnectionData serveData = serve(
                                     [](const char* msg) {
                                         if (!pageLoaded) return;
                                         webClass->pushNotify(QString(msg));
                                     },
                                     [](int queryID, const char* msg) {
                                         if (!pageLoaded) return;
                                         webClass->gotResponse(queryID, QString(msg));
                                     }
                                     );

    RequestInterceptor interceptor(serveData.token);
    view->page()->profile()->setRequestInterceptor(&interceptor);
    QWebChannel channel;
    channel.registerObject("backend", webClass);
    view->page()->setWebChannel(&channel);
    view->show();
    view->load(QUrl("qrc:/index.html"));

    return a.exec();
}

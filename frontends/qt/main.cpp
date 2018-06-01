#include <string>
#include <QApplication>
#include <QWebView>
#include <QWebPage>
#include <QWebFrame>
#include <QSslSocket>
#include <QSsl>
#include <QRegExp>
#include <QSslCertificate>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QByteArray>

#include <server.h>
#include <iostream>

static QWebView* view;
static bool pageLoaded = false;

class BridgedNetworkAccessManager : public QNetworkAccessManager {
public:
    BridgedNetworkAccessManager(const char* _token) : QNetworkAccessManager () {
        token = std::string(_token);
    }
    QNetworkReply* createRequest (Operation op, const QNetworkRequest& req, QIODevice* outgoingData){
        QNetworkRequest copiedRequest(req);
        std::string header = std::string("Basic ") + token;
        copiedRequest.setRawHeader("Authorization", QByteArray(header.c_str()));
        return QNetworkAccessManager::createRequest(op, copiedRequest, outgoingData);

    }
private:
    std::string token;
};

// class MyWebPage : public QWebPage {
// protected:
//     void javaScriptConsoleMessage(const QString & message, int lineNumber, const QString & sourceID) {
//         std::cout << "JS console: " << message.toStdString() << " (linenumber: " << lineNumber << ", sourceID: " << sourceID.toStdString() << ")" << std::endl;
//     }
// };

int main(int argc, char *argv[])
{
    // turn on the DPI support**
#if QT_VERSION >= QT_VERSION_CHECK(5,6,0)
    QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#else
    qputenv("QT_AUTO_SCREEN_SCALE_FACTOR", QByteArray("1"));
#endif // QT_VERSION

    QApplication a(argc, argv);
    a.setApplicationName(QString("BitBox Wallet"));
    view = new QWebView;
    view->setMinimumSize(850, 675);
    view->setContextMenuPolicy(Qt::NoContextMenu);
    pageLoaded = false;
    QObject::connect(view, &QWebView::loadFinished, [](bool ok){ pageLoaded = ok; });
    ConnectionData serveData = serve([](const char* msg) {
        if (!pageLoaded) return;
        QString qmsg = QString::fromStdString(std::string("window.handlePushNotification(" + std::string(msg) + std::string(")")));
        QMetaObject::invokeMethod(view->page()->mainFrame(), "evaluateJavaScript", Qt::QueuedConnection, Q_ARG(QString, qmsg));
    });
    QSslSocket::addDefaultCaCertificates(serveData.certFilename, QSsl::Pem, QRegExp::Wildcard);

    view->setGeometry(0, 0, a.devicePixelRatio() * view->width(), a.devicePixelRatio() * view->height());

    // MyWebPage page;
    // view->setPage(&page);
    BridgedNetworkAccessManager bridgedNetworkAccessManager(serveData.token);
    view->page()->setNetworkAccessManager(&bridgedNetworkAccessManager);
    view->show();
    view->load(QUrl((std::string("https://localhost:") + std::to_string(serveData.port)).c_str()));
    return a.exec();
}

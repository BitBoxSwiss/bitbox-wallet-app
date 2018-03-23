#include <string>
#include <QApplication>
#include <QWebView>
#include <QWebPage>
#include <QSslSocket>
#include <QSsl>
#include <QRegExp>
#include <QSslCertificate>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QByteArray>

#include <server.h>
#include <iostream>

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
    QApplication a(argc, argv);
    ConnectionData serveData = serve();
    QSslSocket::addDefaultCaCertificates("config/certificates/frontend/server.pem", QSsl::Pem, QRegExp::Wildcard);
    QWebView view;

    // MyWebPage page;
    // view.setPage(&page);
    BridgedNetworkAccessManager bridgedNetworkAccessManager(serveData.token);
    view.page()->setNetworkAccessManager(&bridgedNetworkAccessManager);
    view.show();
    view.load(QUrl((std::string("https://localhost:") + std::to_string(serveData.port)).c_str()));
    return a.exec();
}

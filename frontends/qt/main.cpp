#include <string>
#include <QApplication>
#include <QWebView>
// #include <QNetworkAccessManager>
// #include <QNetworkReply>

#include <server.h>

// class BridgedNetworkAccessManager : public QNetworkAccessManager {
// public:
//     BridgedNetworkAccessManager() : QNetworkAccessManager () {}
//     QNetworkReply* createRequest ( Operation op, const QNetworkRequest & req, QIODevice * outgoingData){
//         return QNetworkAccessManager::createRequest(op, req, outgoingData);

//     }

// };

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    int port = serve();
    QWebView view;
    view.show();
    view.load(QUrl((std::string("http://localhost:") + std::to_string(port)).c_str()));

    // BridgedNetworkAccessManager bridgedNetworkAccessManager;
    // view.page()->setNetworkAccessManager(&bridgedNetworkAccessManager);
    return a.exec();
}

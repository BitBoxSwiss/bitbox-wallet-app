#include <QApplication>

#include <libserver.h>

class WebClass : public QObject
{
    Q_OBJECT
public slots:
    void call(int queryID, const QString& query) {
        emit gotResponse(queryID, QString(backendCall(const_cast<char*>(query.toStdString().c_str()))));
    }
signals:
    void gotResponse(int queryID, QString response);
    void pushNotify(QString msg);
};

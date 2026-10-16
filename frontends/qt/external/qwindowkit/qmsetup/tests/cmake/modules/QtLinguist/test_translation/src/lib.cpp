#include <QCoreApplication>
#include <QString>

// Something for lupdate to find, so the .ts files come out with a message in
// them rather than empty. translate() is static, so nothing here has to run.
QString qmtest_greeting() {
    return QCoreApplication::translate("qmtest", "Hello from the translation test");
}

#-------------------------------------------------
#
# Project created by QtCreator 2017-10-23T04:39:47
#
#-------------------------------------------------

QT       += core gui
QT       += webkitwidgets

TARGET = dbb
TEMPLATE = app

# The following define makes your compiler emit warnings if you use
# any feature of Qt which has been marked as deprecated (the exact warnings
# depend on your compiler). Please consult the documentation of the
# deprecated API in order to know how to port your code away from it.
DEFINES += QT_DEPRECATED_WARNINGS

# You can also make your code fail to compile if you use deprecated APIs.
# In order to do so, uncomment the following line.
# You can also select to disable deprecated APIs only up to a certain version of Qt.
#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000    # disables all the APIs deprecated before Qt 6.0.0

QMAKE_CXXFLAGS += -std=c++11

SOURCES += \
        main.cpp

HEADERS +=

INCLUDEPATH += server/

# https://stackoverflow.com/questions/18462420/how-to-specify-mac-platform-in-qmake-qtcreator
unix:!macx {
    LIBS += server/server.a
}

unix:macx {
    # Those frameworks are needed for Go's http/net packages.
    # Waiting for https://github.com/golang/go/issues/11258 to be able to automatically capture link flags.
    LIBS += -framework CoreFoundation -framework Security
    LIBS += server/server.a
}

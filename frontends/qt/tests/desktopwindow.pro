QT += core gui widgets quickwidgets webenginewidgets webchannel testlib
CONFIG += testcase c++17 console
TEMPLATE = app
TARGET = desktopwindow-test
isEmpty(QWINDOWKIT_PREFIX): QWINDOWKIT_PREFIX = $$PWD/../build/qwindowkit/install
include($$QWINDOWKIT_PREFIX/share/QWindowKit/qmake/QWKWidgets.pri)
INCLUDEPATH += $$PWD/..
SOURCES += ../desktopwindow.cpp
HEADERS += ../desktopwindow.h
unix:!macx {
    QT += dbus gui-private waylandclient waylandclient-private
    SOURCES += desktopwindow.test.cpp ../linuxdecorationpreferences.cpp
    HEADERS += ../linuxdecorationpreferences.h ../windowchrome.h ../webclass.h
    LIBS += -ldl
}
win32 {
    QT += gui-private
    SOURCES += desktopwindow-windows.test.cpp
    LIBS += -luxtheme -luser32 -lgdi32 -lshell32
}

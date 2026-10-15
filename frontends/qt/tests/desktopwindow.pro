QT += core gui widgets quickwidgets webenginewidgets webchannel testlib dbus gui-private waylandclient waylandclient-private
CONFIG += testcase c++17 console
TEMPLATE = app
TARGET = desktopwindow-test
isEmpty(QWINDOWKIT_PREFIX): QWINDOWKIT_PREFIX = $$PWD/../build/qwindowkit/install
include($$QWINDOWKIT_PREFIX/share/QWindowKit/qmake/QWKWidgets.pri)
INCLUDEPATH += $$PWD/..
SOURCES += desktopwindow.test.cpp ../desktopwindow.cpp ../linuxdecorationpreferences.cpp
HEADERS += ../desktopwindow.h ../linuxdecorationpreferences.h ../windowchrome.h
LIBS += -ldl

// SPDX-License-Identifier: Apache-2.0
#include "linuxdecorationpreferences.h"

#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>
#include <QDBusVariant>
#include <QDir>
#include <QProcess>
#include <QProcessEnvironment>
#include <QStandardPaths>
#include <QSet>
#include <memory>

namespace {
const QString service = QStringLiteral("org.freedesktop.portal.Desktop");
const QString path = QStringLiteral("/org/freedesktop/portal/desktop");
const QString settingsInterface = QStringLiteral("org.freedesktop.portal.Settings");
const QString gnomeGroup = QStringLiteral("org.gnome.desktop.wm.preferences");

QStringList standardButtons(const QStringList &values, QSet<QString> &seen) {
    QStringList result;
    for (const auto &value : values) {
        const auto button = value.trimmed();
        if ((button == "minimize" || button == "maximize" || button == "close") && !seen.contains(button)) {
            seen.insert(button);
            result.append(button);
        }
    }
    return result;
}
QStringList kdeTokens(const QString &value) {
    QStringList result;
    for (const auto ch : value) {
        if (ch == 'I') result.append("minimize");
        if (ch == 'A') result.append("maximize");
        if (ch == 'X') result.append("close");
    }
    return result;
}
}

DecorationButtons parseGnomeButtons(const QString &value) {
    DecorationButtons result;
    QSet<QString> seen;
    const auto sides = value.split(':');
    result.left = standardButtons(sides.value(0).split(','), seen);
    result.right = standardButtons(sides.value(1).split(','), seen);
    return result;
}

DecorationButtons parseKdeButtons(const QString &left, const QString &right) {
    DecorationButtons result;
    QSet<QString> seen;
    result.left = standardButtons(kdeTokens(left), seen);
    result.right = standardButtons(kdeTokens(right), seen);
    return result;
}

LinuxDecorationPreferences::LinuxDecorationPreferences(QObject *parent) : QObject(parent) {
    const auto desktops = qEnvironmentVariable("XDG_CURRENT_DESKTOP").toUpper().split(':');
    kde_ = desktops.contains("KDE");
    buttons_.right = kde_ ? QStringList{"minimize", "maximize", "close"} : QStringList{"close"};
    debounce_.setSingleShot(true);
    debounce_.setInterval(100);
    connect(&debounce_, &QTimer::timeout, this, &LinuxDecorationPreferences::refresh);
    connect(&watcher_, &QFileSystemWatcher::directoryChanged, &debounce_, qOverload<>(&QTimer::start));
    if (kde_) {
        const auto config = QStandardPaths::writableLocation(QStandardPaths::GenericConfigLocation);
        if (QDir(config).exists()) watcher_.addPath(config);
        if (QDir(config + "/kdedefaults").exists()) watcher_.addPath(config + "/kdedefaults");
    } else {
        const auto dconf = QStandardPaths::writableLocation(QStandardPaths::GenericConfigLocation) + "/dconf";
        if (QDir(dconf).exists()) watcher_.addPath(dconf);
    }
    auto bus = QDBusConnection::sessionBus();
    bus.connect(service, path, settingsInterface, "SettingChanged", this,
                SLOT(settingChanged(QString,QString,QDBusVariant)));
    bus.connect("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                "NameOwnerChanged", this, SLOT(portalOwnerChanged(QString,QString,QString)));
    QTimer::singleShot(0, this, &LinuxDecorationPreferences::refresh);
}

void LinuxDecorationPreferences::portalOwnerChanged(const QString &name, const QString &, const QString &) {
    if (name == service) debounce_.start();
}

void LinuxDecorationPreferences::refresh() {
    const auto revision = ++revision_;
    readSetting("org.freedesktop.appearance", "color-scheme", "ReadOne",
                [this, colorRevision = ++colorRevision_](QVariant value, const QString &) {
        if (colorRevision == colorRevision_) applyColorScheme(value);
    });
    if (kde_) fallback(revision);
    else readGnome(revision);
}

void LinuxDecorationPreferences::readSetting(const QString &group, const QString &key, const QString &method,
                                             std::function<void(QVariant, QString)> done) {
    auto message = QDBusMessage::createMethodCall(service, path, settingsInterface, method);
    message << group << key;
    auto *call = new QDBusPendingCallWatcher(QDBusConnection::sessionBus().asyncCall(message, 1500), this);
    connect(call, &QDBusPendingCallWatcher::finished, this, [this, group, key, method, done, call] {
        QDBusPendingReply<QDBusVariant> reply = *call;
        call->deleteLater();
        if (reply.isError()) {
            if (method == "ReadOne" && reply.error().type() == QDBusError::UnknownMethod)
                readSetting(group, key, "Read", done);
            else done({}, method);
            return;
        }
        QVariant value = reply.value().variant();
        if (value.metaType() == QMetaType::fromType<QDBusVariant>()) value = value.value<QDBusVariant>().variant();
        done(value, method);
    });
}

void LinuxDecorationPreferences::applyColorScheme(const QVariant &value) {
    // The standardized portal preference is an unsigned integer: 0 unknown,
    // 1 dark, 2 light. No preference selects light; -1 means unavailable.
    const int scheme = value.metaType() == QMetaType::fromType<uint>() && value.toUInt() <= 2 ? int(value.toUInt()) : -1;
    if (colorSchemeReady_ && scheme == colorScheme_) return;
    colorSchemeReady_ = true;
    colorScheme_ = scheme;
    emit colorSchemeChanged();
}

void LinuxDecorationPreferences::readGnome(quint64 revision) {
    readSetting(gnomeGroup, "button-layout", "ReadOne", [this, revision](QVariant value, const QString &method) {
        if (revision != revision_) return;
        if (value.metaType() == QMetaType::fromType<QString>()) {
            auto buttons = parseGnomeButtons(value.toString());
            buttons.doubleClick = buttons_.doubleClick;
            apply(buttons);
            readSetting(gnomeGroup, "action-double-click-titlebar", method, [this, revision](QVariant action, const QString &) {
                if (revision != revision_) return;
                if (action.metaType() == QMetaType::fromType<QString>()) applyDoubleClick(action.toString());
                else fallbackDoubleClick(revision);
            });
        } else fallback(revision);
    });
}

void LinuxDecorationPreferences::applyDoubleClick(const QString &value) {
    auto buttons = buttons_;
    buttons.doubleClick = value == "none" || value == "minimize" ? value : QStringLiteral("maximize");
    apply(buttons);
}

void LinuxDecorationPreferences::fallbackDoubleClick(quint64 revision) {
    helper("gsettings", {"get", gnomeGroup, "action-double-click-titlebar"}, [this, revision](bool ok, QString value) {
        if (!ok || revision != revision_) return;
        if (value.startsWith('\'') && value.endsWith('\'')) value = value.mid(1, value.size() - 2);
        applyDoubleClick(value);
    });
}

void LinuxDecorationPreferences::settingChanged(const QString &group, const QString &key, const QDBusVariant &value) {
    if (group == "org.freedesktop.appearance" && key == "color-scheme") {
        ++colorRevision_;
        applyColorScheme(value.variant());
    }
    if (!kde_ && group == gnomeGroup && (key == "button-layout" || key == "action-double-click-titlebar"))
        debounce_.start();
}

void LinuxDecorationPreferences::helper(const QString &program, const QStringList &args,
                                       std::function<void(bool, QString)> done) {
    auto executable = QStandardPaths::findExecutable(program);
    if (executable.isEmpty()) { done(false, {}); return; }
    auto *process = new QProcess(this);
    // System helpers must load their own Qt libraries, not the AppImage's kit.
    auto environment = QProcessEnvironment::systemEnvironment();
    if (environment.contains("APPIMAGE") || environment.contains("APPDIR")) {
        for (const auto &key : {"LD_LIBRARY_PATH", "QT_PLUGIN_PATH", "QT_QPA_PLATFORM_PLUGIN_PATH",
                                "QML_IMPORT_PATH", "QML2_IMPORT_PATH"}) environment.remove(key);
        process->setProcessEnvironment(environment);
    }
    auto *timeout = new QTimer(process);
    timeout->setSingleShot(true);
    connect(timeout, &QTimer::timeout, process, &QProcess::kill);
    auto completed = std::make_shared<bool>(false);
    auto finish = [process, completed, done](bool ok) {
        if (*completed) return;
        *completed = true;
        const auto output = QString::fromUtf8(process->readAllStandardOutput()).trimmed();
        process->deleteLater();
        done(ok && output.size() <= 1024, output);
    };
    connect(process, &QProcess::errorOccurred, this, [finish](QProcess::ProcessError) { finish(false); });
    connect(process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this,
            [finish](int code, QProcess::ExitStatus status) { finish(code == 0 && status == QProcess::NormalExit); });
    timeout->start(1500);
    process->start(executable, args);
}

void LinuxDecorationPreferences::fallback(quint64 revision) {
    if (!kde_) {
        helper("gsettings", {"get", gnomeGroup, "button-layout"}, [this, revision](bool ok, QString value) {
            if (!ok || revision != revision_) return;
            if (value.startsWith('\'') && value.endsWith('\'')) value = value.mid(1, value.size() - 2);
            auto buttons = parseGnomeButtons(value);
            buttons.doubleClick = buttons_.doubleClick;
            apply(buttons);
            fallbackDoubleClick(revision);
        });
        return;
    }
    const auto program = QStandardPaths::findExecutable("kreadconfig6").isEmpty() ? "kreadconfig5" : "kreadconfig6";
    const QStringList base{"--file", "kwinrc", "--group", "org.kde.kdecoration2"};
    helper(program, base + QStringList{"--key", "ButtonsOnLeft", "--default", "M"},
           [this, revision, program, base](bool ok, QString left) {
        if (!ok || revision != revision_) return;
        helper(program, base + QStringList{"--key", "ButtonsOnRight", "--default", "IAX"},
               [this, revision, left](bool success, QString right) {
            if (success && revision == revision_) apply(parseKdeButtons(left, right));
        });
    });
}

void LinuxDecorationPreferences::apply(const DecorationButtons &buttons) {
    if (buttons.left == buttons_.left && buttons.right == buttons_.right && buttons.doubleClick == buttons_.doubleClick) return;
    buttons_ = buttons;
    emit changed();
}

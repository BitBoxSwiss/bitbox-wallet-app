// SPDX-License-Identifier: Apache-2.0
#pragma once

#include <QObject>
#include <QStringList>
#include <QFileSystemWatcher>
#include <QTimer>
#include <functional>

struct DecorationButtons {
    QStringList left;
    QStringList right;
    QString doubleClick = QStringLiteral("maximize");
};

DecorationButtons parseGnomeButtons(const QString &value);
DecorationButtons parseKdeButtons(const QString &left, const QString &right);

class LinuxDecorationPreferences final : public QObject {
    Q_OBJECT
public:
    explicit LinuxDecorationPreferences(QObject *parent = nullptr);
    DecorationButtons buttons() const { return buttons_; }
    int colorScheme() const { return colorScheme_; }
    bool colorSchemeReady() const { return colorSchemeReady_; }
signals:
    void changed();
    void colorSchemeChanged();
private slots:
    void refresh();
    void settingChanged(const QString &group, const QString &key, const class QDBusVariant &value);
    void portalOwnerChanged(const QString &name, const QString &, const QString &);
private:
    void readGnome(quint64 revision);
    void readSetting(const QString &group, const QString &key, const QString &method,
                     std::function<void(QVariant, QString)> done);
    void applyColorScheme(const QVariant &value);
    void fallbackDoubleClick(quint64 revision);
    void applyDoubleClick(const QString &value);
    void fallback(quint64 revision);
    void helper(const QString &program, const QStringList &args,
                std::function<void(bool, QString)> done);
    void apply(const DecorationButtons &buttons);
    DecorationButtons buttons_;
    bool kde_ = false;
    quint64 revision_ = 0;
    quint64 colorRevision_ = 0;
    int colorScheme_ = -1;
    bool colorSchemeReady_ = false;
    QFileSystemWatcher watcher_;
    QTimer debounce_;
};

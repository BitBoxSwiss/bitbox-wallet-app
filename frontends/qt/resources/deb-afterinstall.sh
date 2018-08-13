#!/bin/sh

printf "SUBSYSTEM==\"usb\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbb%%n\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\"\n" > /etc/udev/rules.d/51-hid-digitalbitbox.rules

printf "KERNEL==\"hidraw*\", SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbbf%%n\"\n" > /etc/udev/rules.d/52-hid-digitalbitbox.rules

udevadm control --reload
udevadm trigger

echo "/opt/bitbox/" > /etc/ld.so.conf.d/bitbox.conf
echo "/opt/bitbox/lib/" >> /etc/ld.so.conf.d/bitbox.conf
ldconfig

#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

# BitBox V1 udev rules

printf "SUBSYSTEM==\"usb\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbb%%n\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\"\n" > /etc/udev/rules.d/51-hid-digitalbitbox.rules
printf "KERNEL==\"hidraw*\", SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbbf%%n\"\n" > /etc/udev/rules.d/52-hid-digitalbitbox.rules

# BitBox02 udev rules

printf "SUBSYSTEM==\"usb\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"bitbox02_%%n\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2403\"\n" > /etc/udev/rules.d/53-hid-bitbox02.rules
printf "KERNEL==\"hidraw*\", SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2403\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"bitbox02-%%n\"\n" > /etc/udev/rules.d/54-hid-bitbox02.rules

udevadm control --reload
udevadm trigger

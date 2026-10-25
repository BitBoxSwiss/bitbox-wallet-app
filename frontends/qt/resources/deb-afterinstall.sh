#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

set -e

# BitBox V1 udev rules

printf "SUBSYSTEM==\"usb\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbb%%n\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\"\n" > /etc/udev/rules.d/51-hid-digitalbitbox.rules
printf "KERNEL==\"hidraw*\", SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2402\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"dbbf%%n\"\n" > /etc/udev/rules.d/52-hid-digitalbitbox.rules

# BitBox02 udev rules

printf "SUBSYSTEM==\"usb\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"bitbox02_%%n\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2403\"\n" > /etc/udev/rules.d/53-hid-bitbox02.rules
printf "KERNEL==\"hidraw*\", SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"03eb\", ATTRS{idProduct}==\"2403\", TAG+=\"uaccess\", TAG+=\"udev-acl\", SYMLINK+=\"bitbox02-%%n\"\n" > /etc/udev/rules.d/54-hid-bitbox02.rules

# rpm-ostree, used by Fedora Atomic desktops, builds a new OS deployment that is
# activated on reboot. It runs package scripts in a sandbox where /etc can be
# written, but the host's udev daemon is unavailable and /sys is read-only.
# The rules above are installed into the new deployment and will be applied by
# udev on the next boot. Try to activate them immediately for live installations,
# but do not fail installation if the reload or trigger is unavailable.
udevadm control --reload || true
udevadm trigger || true

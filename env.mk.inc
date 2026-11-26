# SPDX-License-Identifier: Apache-2.0

LIBNAME=libserver
MACOS_MIN_VERSION := 12.0

ENV_MK_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
ENV_MK_ROOT := $(dir $(ENV_MK_PATH))

APP_VERSION := $(strip $(shell cat "$(ENV_MK_ROOT)APP_VERSION"))
GO_VERSION_LDFLAGS := -X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=$(APP_VERSION)

# Reproducibility
# Use the installed Go toolchain instead of downloading another version.
export GOTOOLCHAIN := local
# Ignore per-user Go settings written with go env -w.
export GOENV := off
# Always use this checkout's vendored modules, even inside a larger Go workspace.
export GOWORK := off
# Normalize locale/timezone-sensitive tools and Qt hash iteration.
export LC_ALL := C
export TZ := UTC
export QT_HASH_SEED := 0

# -s omits symbols and debug information (and implies -w).
# Go's build ID can differ between machines even when the linked code is identical.
GO_RELEASE_LDFLAGS := -s $(GO_VERSION_LDFLAGS) -buildid=

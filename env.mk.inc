# SPDX-License-Identifier: Apache-2.0

LIBNAME=libserver
MACOS_MIN_VERSION := 12.0

ENV_MK_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
ENV_MK_ROOT := $(dir $(ENV_MK_PATH))

APP_VERSION := $(strip $(shell cat "$(ENV_MK_ROOT)APP_VERSION"))
GO_VERSION_LDFLAGS := -X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=$(APP_VERSION)

# -s omits symbols and debug information (and implies -w).
# Go's build ID can differ between machines even when the linked code is identical.
GO_RELEASE_LDFLAGS := -s $(GO_VERSION_LDFLAGS) -buildid=

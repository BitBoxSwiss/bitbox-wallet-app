# SPDX-License-Identifier: Apache-2.0

VERSION_MK_ROOT := $(dir $(lastword $(MAKEFILE_LIST)))

APP_VERSION := $(strip $(shell cat "$(VERSION_MK_ROOT)APP_VERSION"))
GO_VERSION_LDFLAGS := -X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=$(APP_VERSION)

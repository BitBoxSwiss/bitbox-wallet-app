VERSION_MK_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
VERSION_MK_ROOT := $(dir $(VERSION_MK_PATH))

APP_VERSION := $(strip $(shell cat "$(VERSION_MK_ROOT)APP_VERSION"))
GO_VERSION_LDFLAGS := -X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=$(APP_VERSION)

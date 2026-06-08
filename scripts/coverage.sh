#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

go test -coverprofile=coverage.cov "$@"
go tool cover -html=coverage.cov
rm coverage.cov

#!/bin/bash
# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


# Call this script in the directory of a package or provide package paths
# as positional arguments. For instance, to check coverage on all backend
# packages, use the following:
#
#     scripts/coverage.sh ./backend/...
#
# An html page will be opened, showing the coverage of the indicated
# packages.

go test -coverprofile=coverage.cov "$@"
go tool cover -html=coverage.cov
rm coverage.cov

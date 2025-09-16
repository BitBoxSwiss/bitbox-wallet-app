#!/bin/bash

# Copyright 2025 Shift Crypto AG
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

#!/bin/bash

# Check for existing changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: There are uncommitted changes in the working directory."
    echo "Please commit or stash them before running this script."
    exit 1
fi

# Get latest commit hash from the repository
LATEST_COMMIT=$(git ls-remote https://github.com/BitBoxSwiss/bitbox02-api-go HEAD | awk '{print $1}')

if [ -z "$LATEST_COMMIT" ]; then
    echo "Error: Could not fetch latest commit hash"
    exit 1
fi

# Update the dependency
go get github.com/BitBoxSwiss/bitbox02-api-go@$LATEST_COMMIT
go mod tidy
go mod vendor

# Create commit with update commands in message body
git add go.mod go.sum vendor/
git commit -m "vendor: update bitbox02-api-go" -m "Updated using:
\`\`\`
go get github.com/BitBoxSwiss/bitbox02-api-go@$LATEST_COMMIT
go mod tidy && go mod vendor
\`\`\`"

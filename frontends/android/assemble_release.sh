#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

set -e

# make sure it's not exported
unset -v key_password
unset -v store_password

# make sure variables are not automatically exported
set +o allexport

keystore=BitBoxApp/app/bitboxapp.jks
key_alias=bitboxapp
expected_fingerprint="Certificate fingerprint (SHA-256): 67:E9:05:08:F7:49:BE:9D:CF:B1:83:33:92:BA:99:EE:BF:89:37:B1:BA:DD:F3:05:63:1C:E2:D9:FB:A5:0B:D7"

if [[ ! -f "$keystore" ]]; then
  echo "Keystore file not found: $keystore"
  exit 1
fi

echo "Enter keystore password:"
IFS= read -rs store_password < /dev/tty

# check store password
if ! keytool -list -keystore "$keystore" -storepass "$store_password" -alias "$key_alias" > /dev/null 2>&1; then
  echo "Invalid keystore password"
  exit 1
fi

# check expected key exists
if ! keytool -list -keystore "$keystore" -storepass "$store_password" 2>/dev/null | grep -q "$expected_fingerprint"; then
  echo "Keystore does not contain expected key"
  exit 1
fi

echo "Enter password for key '$key_alias':"
IFS= read -rs key_password < /dev/tty
if ! keytool -certreq -keystore "$keystore" -storepass "$store_password" \
        -alias "$key_alias" -keypass "$key_password" > /dev/null 2>&1; then
  echo "Invalid key password"
  exit 1
fi

export KEYSTORE_STORE_FILE=bitboxapp.jks
export KEYSTORE_KEY_ALIAS="$key_alias"
export KEYSTORE_KEY_PASSWORD="$key_password"
export KEYSTORE_STORE_PASSWORD="$store_password"

make prepare-android
(cd BitBoxApp && ./gradlew assembleRelease bundleRelease)

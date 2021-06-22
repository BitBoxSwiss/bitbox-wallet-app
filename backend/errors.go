// Copyright 2021 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package backend

// ErrorCode are errors that are represented by an error code. This helps the frontend to translate
// error messages.
type ErrorCode string

func (e ErrorCode) Error() string {
	return string(e)
}

const (
	// ErrAccountAlreadyExists is returned if an account is being added which already exists.
	ErrAccountAlreadyExists ErrorCode = "accountAlreadyExists"
	// ErrAccountLimitReached is returned when adding an account if no more accounts can be added.
	ErrAccountLimitReached ErrorCode = "accountLimitReached"

	// errAoppUnsupportedAsset is returned when an AOPP request is for an asset we don't support AOPP
	// for.
	errAoppUnsupportedAsset ErrorCode = "aoppUnsupportedAsset"
	// errAoppVersion is returned when we cannot handle an AOPP request because we don't support the
	// request version.
	errAoppVersion ErrorCode = "aoppVersion"
	// errAoppNoAccounts is returned when there are no available accounts to choose from.
	errAoppNoAccounts ErrorCode = "aoppNoAccounts"
	// errAoppCannotSign is returned when the connected keystore does not support signing messages.
	errAoppCannotSign ErrorCode = "aoppCannotSign"
)

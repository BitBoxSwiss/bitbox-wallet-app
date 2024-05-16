// Copyright 2018 Shift Devices AG
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

package bitbox

import (
	"fmt"
	"regexp"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// PasswordValidationError indicates an error when the given password does not comply with the policy.
type PasswordValidationError string

func (p PasswordValidationError) Error() string {
	return string(p)
}

// PasswordPolicy represents the password policy.
type PasswordPolicy struct {
	// mustMatchPattern is the regular expression pattern that the password must match.
	mustMatchPattern *regexp.Regexp
}

// NewPasswordPolicy creates a new password policy with a regular expression pattern, which is used
// to match the password.
func NewPasswordPolicy(mustMatchPattern string) *PasswordPolicy {
	pattern, err := regexp.Compile(mustMatchPattern)
	if err != nil {
		panic(errp.Newf("Failed to compile pattern: %v", mustMatchPattern))
	}
	return &PasswordPolicy{
		mustMatchPattern: pattern,
	}
}

// ValidatePassword evaluates a given password against the password policy. If valid, returns true
// if invalid, returns false and the PasswordValidationError that explains what went wrong.
func (passwordMatcher *PasswordPolicy) ValidatePassword(password string) (bool, error) {
	if !passwordMatcher.mustMatchPattern.MatchString(password) {
		return false, PasswordValidationError(fmt.Sprintf("Password contains characters that are not "+
			"allowed: %v", passwordMatcher.mustMatchPattern))
	}
	return true, nil
}

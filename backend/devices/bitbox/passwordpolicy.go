// SPDX-License-Identifier: Apache-2.0

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

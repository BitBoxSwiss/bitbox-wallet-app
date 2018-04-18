package bitbox

import (
	"regexp"

	"github.com/shiftdevices/godbb/util/errp"
)

// PasswordValidationError indicates an error when the given password does not comply with the policy.
type PasswordValidationError error

// PasswordPolicy represents the password policy.
type PasswordPolicy struct {

	// minPasswordLength stores the minimum length for a valid password.
	minPasswordLength uint16

	// mustMatchPattern is the regular expression pattern that the password must match.
	mustMatchPattern *regexp.Regexp
}

// NewPasswordPolicy creates a new password policy with a minimum password length and a regular
// expression pattern, which is used to match the password.
func NewPasswordPolicy(minPasswordLength uint16, mustMatchPattern string) *PasswordPolicy {
	pattern, err := regexp.Compile(mustMatchPattern)
	if err != nil {
		panic(errp.Newf("Failed to compile pattern: %v", mustMatchPattern))
	}
	return &PasswordPolicy{
		minPasswordLength: minPasswordLength,
		mustMatchPattern:  pattern,
	}
}

// ValidatePassword evaluates a given password against the password policy. If valid, returns true
// if invalid, returns false and the PasswordValidationError that explains what went wrong.
func (passwordMatcher *PasswordPolicy) ValidatePassword(password string) (bool, PasswordValidationError) {
	if len(password) < int(passwordMatcher.minPasswordLength) {
		return false, PasswordValidationError(errp.Newf("Password is too short (is: %d, must be at "+
			"least: %d)", len(password), passwordMatcher.minPasswordLength))
	}
	if !passwordMatcher.mustMatchPattern.MatchString(password) {
		return false, PasswordValidationError(errp.Newf("Password contains characters that are not "+
			"allowed: %v", passwordMatcher.mustMatchPattern))
	}
	return true, nil
}

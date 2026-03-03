package descriptors

type SemanticPolicyType string

const (
	// Unsatisfiable policy (always fails)
	SemanticPolicyTypeUnsatisfiable SemanticPolicyType = "unsatisfiable"

	// Trivially satisfiable policy (always succeeds)
	SemanticPolicyTypeTrivial SemanticPolicyType = "trivial"

	// Requires signature matching a public key
	SemanticPolicyTypeKey SemanticPolicyType = "key"

	// Absolute locktime constraint
	SemanticPolicyTypeAfter SemanticPolicyType = "after"

	// Relative locktime constraint
	SemanticPolicyTypeOlder SemanticPolicyType = "older"

	// SHA256 hash preimage requirement
	SemanticPolicyTypeSha256 SemanticPolicyType = "sha256"

	// Double SHA256 hash preimage requirement
	SemanticPolicyTypeHash256 SemanticPolicyType = "hash256"

	// RIPEMD160 hash preimage requirement
	SemanticPolicyTypeRipemd160 SemanticPolicyType = "ripemd160"

	// HASH160 (SHA256 followed by RIPEMD160) preimage requirement
	SemanticPolicyTypeHash160 SemanticPolicyType = "hash160"

	// Threshold combination of multiple policies
	SemanticPolicyTypeThresh SemanticPolicyType = "thresh"
)

// SemanticPolicy is an abstract policy which corresponds to the semantics of a miniscript and which
// allows complex forms of analysis, e.g. filtering and normalization.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/policy/semantic/enum.Policy.html.
type SemanticPolicy struct {
	// Type of the semantic policy (always present)
	Type SemanticPolicyType `json:"type"`

	// Public key string (present when Type is "key")
	Key *string `json:"key,omitempty"`

	// Locktime value as consensus number (present when Type is "after" or "older")
	LockTime *uint32 `json:"lockTime,omitempty"`

	// Hex-encoded hash value (present for hash types: sha256, hash256, ripemd160, hash160)
	Hash *string `json:"hash,omitempty"`

	// Required threshold count (present when Type is "thresh")
	Threshold *uint `json:"threshold,omitempty"`

	// Nested policies for threshold composition (present when Type is "thresh")
	Policies []*SemanticPolicy `json:"policies,omitempty"`
}

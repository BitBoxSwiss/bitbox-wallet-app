package descriptors

// Plan encapsulates a spending path on a descriptor.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/struct.Plan.html.
type Plan struct {
	mod *wasmModule
	ptr uint64
}

// Asset describes the present/missing lookup table for constructing witness templates. Any
// undefined entries default to false/unsatisfied.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/trait.AssetProvider.html
type Assets struct {
	// Given a public key, look up an ECDSA signature with that key, return whether we found it.
	LookupEcdsaSig func(pk string) bool
	// Lookup the tap key spend sig and return its size.
	LookupTapKeySpendSig func(pk string) (uint32, bool)
	// Given a public key and a associated leaf hash, look up a schnorr signature with that key and
	// return its size.
	LookupTapLeafScriptSig func(pk string, leafHash string) (uint32, bool)
	// Maximum relative timelock allowed.
	RelativeLocktime *uint32
	// Maximum absolute timelock allowed.
	AbsoluteLocktime *uint32
}

// SatisfactionWeight is the weight, in witness units, needed for satisfying this plan (includes
// both the script sig weight and the witness weight)
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/struct.Plan.html#method.satisfaction_weight.
func (p *Plan) SatisfactionWeight() uint64 {
	return p.mod.planSatisfactionWeight(p.ptr)
}

// The size in bytes of the script sig that satisfies this plan, including the size of the var-int
// prefix.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/struct.Plan.html#method.scriptsig_size
func (p *Plan) ScriptSigSize() uint64 {
	return p.mod.planScriptSigSize(p.ptr)
}

// The size in bytes of the witness that satisfies this plan
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/struct.Plan.html#method.witness_size
func (p *Plan) WitnessSize() uint64 {
	return p.mod.planWitnessSize(p.ptr)
}

type Satisfier struct {
	// Given a public key, look up an ECDSA signature with that key.
	// The signature must be a valid DER-encoded ECDSA sig including the SighashType.
	LookupEcdsaSig func(string) ([]byte, bool)
	// Lookup the tap key spend sig. The signature must be 64 bytes.
	LookupTapKeySpendSig func() ([]byte, bool)
	// Given a public key and a associated leaf hash, look up an schnorr signature with that key.
	// The signature must be 64 bytes.
	LookupTapLeafScriptSig func(string, string) ([]byte, bool)
}

type SatisfyResult struct {
	Witness   [][]byte
	ScriptSig []byte
}

// Try creating the final script_sig and witness using a Satisfier.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/plan/struct.Plan.html#method.satisfy.
func (p *Plan) Satisfy(satisfier *Satisfier) (*SatisfyResult, error) {
	return p.mod.planSatisfy(
		p.ptr, satisfier,
	)
}

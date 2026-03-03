package descriptors

import (
	_ "embed"
	"runtime"
)

// Descriptor is a struct encapsulating the parsed instance of a descriptor.
type Descriptor struct {
	mod   *wasmModule
	ptr   uint64
	close func()
}

// NewDescriptor parses the given descriptor string and returns a new
// Descriptor instance.
func NewDescriptor(descriptor string) (*Descriptor, error) {
	mod := getWasmMod()
	descPtr, drop, err := mod.descriptorParse(descriptor)
	if err != nil {
		return nil, err
	}
	result := &Descriptor{
		mod: mod,
		ptr: uint64(descPtr),
	}
	runtime.AddCleanup(result, func(struct{}) { drop() }, struct{}{})

	return result, nil
}

// String returns the complete string representation of the descriptor,
// including the checksum.
func (d *Descriptor) String() string {
	return d.mod.descriptorString(d.ptr)
}

// MultipathLen returns the number of multipath elements in the descriptor.
func (d *Descriptor) MultipathLen() int {
	return int(d.mod.descriptorMultipathLen(d.ptr))
}

// MaxWeightToSatisfy returns the largest possible weight of the input witness needed to satisfy this
// descriptor.
// See https://docs.rs/miniscript/12.3.2/miniscript/descriptor/enum.Descriptor.html#method.max_weight_to_satisfy.
func (d *Descriptor) MaxWeightToSatisfy() (uint64, error) {
	return d.mod.descriptorMaxWeightToSatisfy(d.ptr)
}

// AddressAt derives and returns the address at the given multipath and
// derivation index.
func (d *Descriptor) AddressAt(network Network, multipathIndex uint32,
	derivationIndex uint32) (string, error) {

	return d.mod.descriptorAddressAt(
		d.ptr, network, multipathIndex, derivationIndex,
	)
}

// Lift converts this descriptor into an abstract policy.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/descriptor/enum.Descriptor.html#method.lift.
func (d *Descriptor) Lift() (*SemanticPolicy, error) {
	return d.mod.descriptorLift(d.ptr)
}

// Keys returns all keys present in the descriptor, in order as they appear in the descriptor
// string.
func (d *Descriptor) Keys() []string {
	return d.mod.descriptorKeys(d.ptr)
}

// DecsType is the descriptor type.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/descriptor/enum.DescriptorType.html.
type DescType string

const (
	// Bare descriptor (Contains the native P2pk)
	DescTypeBare DescType = "Bare"
	// Pure Sh Descriptor. Does not contain nested Wsh/Wpkh
	DescTypeSh DescType = "Sh"
	// Pkh Descriptor
	DescTypePkh DescType = "Pkh"
	// Wpkh Descriptor
	DescTypeWpkh DescType = "Wpkh"
	// Wsh
	DescTypeWsh DescType = "Wsh"
	// Sh Wrapped Wsh
	DescTypeShWsh DescType = "ShWsh"
	// Sh wrapped Wpkh
	DescTypeShWpkh DescType = "ShWpkh"
	// Sh Sorted Multi
	DescTypeShSortedMulti DescType = "ShSortedMulti"
	// Wsh Sorted Multi
	DescTypeWshSortedMulti DescType = "WshSortedMulti"
	// Sh Wsh Sorted Multi
	DescTypeShWshSortedMulti DescType = "ShWshSortedMulti"
	// Tr Descriptor
	DescTypeTr DescType = "Tr"
)

// DescType returns the descriptor type.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/descriptor/enum.Descriptor.html#method.desc_type
func (d *Descriptor) DescType() DescType {
	return DescType(d.mod.descriptorDescType(d.ptr))
}

// PlanAt returns a plan at the given multipath and derivation index if the provided assets are
// sufficient to produce a non-malleable satisfaction.
//
// See https://docs.rs/miniscript/12.3.2/miniscript/descriptor/enum.Descriptor.html#method.plan
func (d *Descriptor) PlanAt(multipathIndex uint32,
	derivationIndex uint32, assets Assets) (*Plan, error) {

	planPtr, drop, err := d.mod.descriptorPlanAt(
		d.ptr, multipathIndex, derivationIndex, assets,
	)
	if err != nil {
		return nil, err
	}
	plan := &Plan{mod: d.mod, ptr: planPtr}
	runtime.AddCleanup(plan, func(struct{}) { drop() }, struct{}{})
	return plan, nil
}

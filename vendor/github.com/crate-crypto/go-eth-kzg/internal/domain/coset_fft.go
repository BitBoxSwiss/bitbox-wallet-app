package domain

import (
	"github.com/consensys/gnark-crypto/ecc/bls12-381/fr"
)

// FFTCoset represents a coset for Fast Fourier Transform operations.
// It contains the generator of the coset and its inverse.
type FFTCoset struct {
	// CosetGen is the generator element of the coset.
	// It's used to shift the domain for coset FFT operations.
	CosetGen fr.Element

	// InvCosetGen is the inverse of the coset generator.
	// It's used in inverse coset FFT operations to shift back to the original domain.
	InvCosetGen fr.Element
}

// CosetDomain represents a domain for performing FFT operations over a coset.
// It combines a standard FFT domain with coset information for efficient coset FFT computations.
type CosetDomain struct {
	// domain is the underlying FFT domain.
	domain *Domain

	// coset contains the coset generator and its inverse for this domain.
	coset FFTCoset
}

// NewCosetDomain creates a new CosetDomain with the given Domain and FFTCoset.
func NewCosetDomain(domain *Domain, fft_coset FFTCoset) *CosetDomain {
	return &CosetDomain{
		domain: domain,
		coset:  fft_coset,
	}
}

// CosetFFtFr performs a forward coset FFT on the input values.
//
// It first scales the input values by powers of the coset generator,
// then performs a standard FFT on the scaled values.
func (d *CosetDomain) CosetFFtFr(values []fr.Element) {
	n := len(values)
	cosetScale := fr.One()
	for i := 0; i < n; i++ {
		values[i].Mul(&values[i], &cosetScale)
		cosetScale.Mul(&cosetScale, &d.coset.CosetGen)
	}
	fftFrInPlace(values, d.domain.Generator)
}

// CosetIFFtFr performs an inverse coset FFT on the input values.
//
// It first performs a standard inverse FFT, then scales the results
// by powers of the inverse coset generator to shift back to the original domain.
func (d *CosetDomain) CosetIFFtFr(values []fr.Element) {
	n := len(values)

	// In-place inverse FFT (DIF with inverse generator) and 1/n scaling
	fftFrInPlace(values, d.domain.GeneratorInv)
	for i := 0; i < n; i++ {
		values[i].Mul(&values[i], &d.domain.CardinalityInv)
	}

	// Scale by inverse coset generator powers
	cosetScale := fr.One()
	for i := 0; i < n; i++ {
		values[i].Mul(&values[i], &cosetScale)
		cosetScale.Mul(&cosetScale, &d.coset.InvCosetGen)
	}
}

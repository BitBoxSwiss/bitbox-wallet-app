package kzgmulti

import (
	bls12381 "github.com/consensys/gnark-crypto/ecc/bls12-381"
	"github.com/consensys/gnark-crypto/ecc/bls12-381/fr"
	"github.com/crate-crypto/go-eth-kzg/internal/domain"
	"github.com/crate-crypto/go-eth-kzg/internal/kzg"
	"github.com/crate-crypto/go-eth-kzg/internal/multiexp"
	"github.com/crate-crypto/go-eth-kzg/internal/poly"
	"github.com/crate-crypto/go-eth-kzg/internal/utils"
)

// Verifies Multiple KZGProofs
//
// Note: `cosetEvals` is mutated in-place, ie it should be treated as a mutable reference
func VerifyMultiPointKZGProofBatch(deduplicatedCommitments []bls12381.G1Affine, commitmentIndices, cosetIndices []uint64, proofs []bls12381.G1Affine, cosetEvals [][]fr.Element, openKey *OpeningKey) error {
	// Sample random numbers for sampling.
	//
	// We only need to sample one random number and
	// compute powers of that random number. This works
	// since powers will produce a vandermonde matrix
	// which is linearly independent.
	var r fr.Element
	_, err := r.SetRandom()
	if err != nil {
		return err
	}
	rPowers := utils.ComputePowers(r, uint(len(commitmentIndices)))

	numCosets := len(cosetIndices)
	numUniqueCommitments := len(deduplicatedCommitments)
	commRandomSumProofs, err := multiexp.MultiExpG1(rPowers, proofs, 0)
	if err != nil {
		return err
	}

	weights := make([]fr.Element, numUniqueCommitments)
	for k := 0; k < numCosets; k++ {
		commitmentIndex := commitmentIndices[k]
		weights[commitmentIndex].Add(&weights[commitmentIndex], &rPowers[k])
	}
	commRandomSumComms, err := multiexp.MultiExpG1(weights, deduplicatedCommitments, 0)
	if err != nil {
		return err
	}

	cosetSize := openKey.CosetSize

	// Compute random linear sum of interpolation polynomials
	interpolationPoly := []fr.Element{}
	for k, cosetEval := range cosetEvals {
		domain.BitReverse(cosetEval)

		// Coset IFFT
		cosetIndex := cosetIndices[k]
		cosetDomain := openKey.cosetDomains[cosetIndex]
		cosetMonomial := cosetDomain.CosetIFFtFr(cosetEval)

		// Scale the interpolation polynomial
		for i := 0; i < len(cosetMonomial); i++ {
			cosetMonomial[i].Mul(&cosetMonomial[i], &rPowers[k])
		}

		interpolationPoly = poly.PolyAdd(interpolationPoly, cosetMonomial)
	}

	commRandomSumInterPoly, err := openKey.CommitG1(interpolationPoly)
	if err != nil {
		return err
	}

	weightedRPowers := make([]fr.Element, numCosets)
	for k := 0; k < len(rPowers); k++ {
		cosetIndex := cosetIndices[k]
		rPower := rPowers[k]
		cosetShiftPowN := openKey.CosetShiftsPowCosetSize[cosetIndex]
		weightedRPowers[k].Mul(&cosetShiftPowN, &rPower)
	}
	randomWeightedSumProofs, err := multiexp.MultiExpG1(weightedRPowers, proofs, 0)
	if err != nil {
		return err
	}

	rl := bls12381.G1Affine{}
	rl.Sub(commRandomSumComms, commRandomSumInterPoly)
	rl.Add(&rl, randomWeightedSumProofs)

	negG2Gen := bls12381.G2Affine{}
	negG2Gen.Neg(openKey.genG2())

	sPowCosetSize := openKey.G2[cosetSize]

	check, err := bls12381.PairingCheck(
		[]bls12381.G1Affine{*commRandomSumProofs, rl},
		[]bls12381.G2Affine{sPowCosetSize, negG2Gen},
	)
	if err != nil {
		return err
	}
	if !check {
		return kzg.ErrVerifyOpeningProof
	}
	return nil
}

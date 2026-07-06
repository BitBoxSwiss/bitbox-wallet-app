package goethkzg

// The methods in this file are not needed for eip7594 or eip4844.
// A new research direction for cell-level messaging is being discussed which requires it.
// For reference, see: https://ethresear.ch/t/gossipsubs-partial-messages-extension-and-cell-level-dissemination/23017

// RecoverCells will compute the extended blob that is associated with the given `cells` if we have more than 50% of the `cells`
func (ctx *Context) RecoverCells(cellIDs []uint64, cells []*Cell, numGoroutines int) ([CellsPerExtBlob]*Cell, error) {
	polyCoeff, err := ctx.recoverPolynomialCoeffs(cellIDs, cells)
	if err != nil {
		return [CellsPerExtBlob]*Cell{}, err
	}

	return ctx.computeCellsFromPolyCoeff(polyCoeff, numGoroutines)
}

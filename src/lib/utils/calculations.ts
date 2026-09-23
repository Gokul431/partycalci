/**
 * Confirmed business rules — the ONLY automatic calculations in the app.
 *   Total = Load - Empty
 *   Kg    = (Number of Bags × KG_PER_BAG) - Total
 * Price, Amount and Freight Charge are manual inputs (no formula confirmed).
 *
 * firestore.rules re-checks these same formulas server-side; keep them in sync.
 */
export const KG_PER_BAG = 62;

/** Negative Kg is rejected until the business confirms it is valid. */
export const ALLOW_NEGATIVE_KG = false;

export function calculateTotal(load: number, empty: number): number {
	return load - empty;
}

export function calculateKg(bagCount: number, total: number): number {
	return bagCount * KG_PER_BAG - total;
}

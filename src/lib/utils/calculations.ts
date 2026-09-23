/**
 * Confirmed business rules — the ONLY automatic calculations in the app.
 *   Total = Load - Empty
 *   Bags  = floor(Total / KG_PER_BAG)
 *   Kg    = Total - (Bags × KG_PER_BAG)
 *
 * The total weight is expressed as whole bags plus the loose remainder, so a Total of
 * 95 reads as "1 bag 33 kg". Bags and Kg are both derived; neither is typed in.
 * Price, Amount and Freight Charge are manual inputs (no formula confirmed).
 *
 * firestore.rules re-checks these same formulas server-side; keep them in sync.
 */
export const KG_PER_BAG = 62;

export function calculateTotal(load: number, empty: number): number {
	return load - empty;
}

/** Whole bags the total weight fills. */
export function calculateBags(total: number): number {
	return Math.floor(total / KG_PER_BAG);
}

/** Weight left over after the whole bags — always less than KG_PER_BAG. */
export function calculateKg(total: number): number {
	return total - calculateBags(total) * KG_PER_BAG;
}

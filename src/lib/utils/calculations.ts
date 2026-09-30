/**
 * When auto-calculation is switched off on an entry, the user types Total and Bags
 * instead, and Kg is still derived as looseKg(total, bags) = Total − Bags × KG_PER_BAG.
 *
 * Confirmed business rules — the ONLY automatic calculations in the app.
 *   Total = Load - Empty
 *   Bags  = floor(Total / KG_PER_BAG)
 *   Kg    = Total - (Bags × KG_PER_BAG)
 *
 * The total weight is expressed as whole bags plus the loose remainder, so a Total of
 * 95 reads as "1 bag 33 kg". Bags and Kg are both derived; neither is typed in.
 *
 * Money follows from the price per bag, and depends on the party:
 *   Rate per kg  = floor(Price per bag / KG_PER_BAG)
 *   Item Amount  = Bags × Price per bag            (wholesale)
 *                = that + Kg × Rate per kg         (farmer)
 *   Total Amount = Item Amount - Freight Charge
 * Price per bag and Freight Charge are the only money values typed in.
 *
 * firestore.rules re-checks the weight formulas server-side; keep them in sync.
 */
import type { PartyType } from '$lib/types';

export const KG_PER_BAG = 62;

export function calculateTotal(load: number, empty: number): number {
	return load - empty;
}

/** Whole bags the total weight fills. */
export function calculateBags(total: number): number {
	return Math.floor(total / KG_PER_BAG);
}

/** Weight left over after `bagCount` full bags. */
export function looseKg(total: number, bagCount: number): number {
	return total - bagCount * KG_PER_BAG;
}

/** Weight left over after the whole bags — always less than KG_PER_BAG. */
export function calculateKg(total: number): number {
	return looseKg(total, calculateBags(total));
}

/** The bag price broken down to the kilo, rounded down to the whole rupee. */
export function ratePerKg(pricePerBag: number): number {
	return Math.floor(pricePerBag / KG_PER_BAG);
}

/** Value of the goods. Wholesale pays for full bags only; a farmer is paid for the loose kg too. */
export function calculateItemAmount(
	partyType: PartyType,
	bagCount: number,
	kg: number,
	pricePerBag: number
): number {
	const bags = bagCount * pricePerBag;
	return partyType === 'farmer' ? bags + kg * ratePerKg(pricePerBag) : bags;
}

/** What the party is actually owed: the goods less the freight the mill covered. */
export function calculateTotalAmount(itemAmount: number, freightCharge: number): number {
	return itemAmount - freightCharge;
}

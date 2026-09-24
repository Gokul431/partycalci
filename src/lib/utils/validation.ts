import { KG_PER_BAG, calculateBags, calculateKg, calculateTotal, looseKg } from './calculations';
import { parseISODate } from './dates';
import type { PartyInput, TransactionData, TransactionFormValues } from '$lib/types';

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export type Result<T, K extends string> =
	| { ok: true; data: T }
	| { ok: false; errors: FieldErrors<K> };

const PHONE_CHARS = /^[0-9+\-\s]+$/;
const isStatus = (s: string) => s === 'active' || s === 'inactive';
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Empty is fine (optional); otherwise 7–15 digits with optional +, spaces or dashes. */
export function validatePhone(phone: string): string | undefined {
	const p = phone.trim();
	if (!p) return undefined;
	const digits = p.replace(/\D/g, '');
	if (!PHONE_CHARS.test(p) || digits.length < 7 || digits.length > 15 || p.length > 20) {
		return 'Enter a valid phone number (7–15 digits).';
	}
}

export type PartyField = keyof PartyInput;

export function validateParty(input: PartyInput): Result<PartyInput, PartyField> {
	const data: PartyInput = {
		partyName: input.partyName.trim().replace(/\s+/g, ' '),
		place: input.place.trim(),
		phoneNumber: input.phoneNumber.trim().replace(/\s+/g, ' '),
		status: input.status
	};
	const errors: FieldErrors<PartyField> = {};
	if (!data.partyName) errors.partyName = 'Party name is required.';
	else if (data.partyName.length > 120) errors.partyName = 'Party name is too long (max 120).';
	if (data.place.length > 120) errors.place = 'Place is too long (max 120).';
	const phoneError = validatePhone(data.phoneNumber);
	if (phoneError) errors.phoneNumber = phoneError;
	if (!isStatus(data.status)) errors.status = 'Status is required.';
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

export type TransactionField = keyof TransactionFormValues | 'total' | 'kg';

export const EMPTY_GT_LOAD = 'Empty weight cannot be greater than Load weight.';

/** Validates the weight inputs and derives Total, Bags and Kg when possible. */
type WeightInput = Pick<TransactionFormValues, 'load' | 'empty'> &
	Partial<Pick<TransactionFormValues, 'autoCalculate' | 'total' | 'bagCount'>>;
type WeightField = 'load' | 'empty' | 'total' | 'bagCount';

export const BAGS_EXCEED_TOTAL = `Bags × ${KG_PER_BAG} is more than the Total, so Loose Kg would be negative.`;

/**
 * Validates the weight inputs and returns Total, Bags and Loose Kg when possible.
 * Auto (default): everything derives from Load − Empty.
 * Manual (autoCalculate === false): Total and Bags are typed, Load/Empty are optional,
 * and Loose Kg is still derived as Total − Bags × KG_PER_BAG.
 */
export function computeWeights(v: WeightInput): {
	total: number | null;
	bagCount: number | null;
	kg: number | null;
	errors: FieldErrors<WeightField>;
} {
	const errors: FieldErrors<WeightField> = {};
	const manual = v.autoCalculate === false;

	if (manual) {
		if (v.load != null && (!isNum(v.load) || v.load < 0)) errors.load = 'Load must be 0 or more.';
		if (v.empty != null && (!isNum(v.empty) || v.empty < 0)) errors.empty = 'Empty must be 0 or more.';
		if (isNum(v.load) && isNum(v.empty) && v.empty > v.load) errors.empty = EMPTY_GT_LOAD;

		const total = v.total ?? null;
		const bags = v.bagCount ?? null;
		if (!isNum(total)) errors.total = 'Total is required.';
		else if (total < 0) errors.total = 'Total must be 0 or more.';
		if (!isNum(bags)) errors.bagCount = 'Number of bags is required.';
		else if (bags < 0 || !Number.isInteger(bags)) errors.bagCount = 'Number of bags must be a whole number, 0 or more.';

		if (!isNum(total) || !isNum(bags)) return { total: null, bagCount: null, kg: null, errors };
		const kg = looseKg(total, bags);
		if (kg < 0 && !errors.bagCount) errors.bagCount = BAGS_EXCEED_TOTAL;
		return { total, bagCount: bags, kg, errors };
	}

	if (!isNum(v.load)) errors.load = 'Load is required.';
	else if (v.load < 0) errors.load = 'Load must be 0 or more.';
	if (!isNum(v.empty)) errors.empty = 'Empty is required.';
	else if (v.empty < 0) errors.empty = 'Empty must be 0 or more.';

	if (!isNum(v.load) || !isNum(v.empty)) return { total: null, bagCount: null, kg: null, errors };

	if (v.empty > v.load) errors.empty = EMPTY_GT_LOAD;
	const total = calculateTotal(v.load, v.empty);
	return { total, bagCount: calculateBags(total), kg: calculateKg(total), errors };
}

function optionalAmount(
	value: number | null,
	field: 'freightCharge' | 'price' | 'amount',
	label: string,
	errors: FieldErrors<TransactionField>
): number {
	if (value == null) return 0;
	if (!isNum(value)) errors[field] = `${label} must be a number.`;
	else if (value < 0) errors[field] = `${label} cannot be negative.`;
	return isNum(value) ? value : 0;
}

/**
 * Full validation + recalculation. Always used right before writing to Firestore,
 * so stored Total/Kg never come from browser form state.
 */
export function validateTransaction(v: TransactionFormValues): Result<TransactionData, TransactionField> {
	const errors: FieldErrors<TransactionField> = {};

	const date = parseISODate(v.transactionDate);
	if (!v.transactionDate) errors.transactionDate = 'Date is required.';
	else if (!date) errors.transactionDate = 'Enter a valid date.';

	if (v.purchaseType !== 'purchase' && v.purchaseType !== 'return')
		errors.purchaseType = 'Type of purchase is required.';

	const wayNumber = v.wayNumber.trim();
	if (!wayNumber) errors.wayNumber = 'Way number is required.';
	else if (wayNumber.length > 50) errors.wayNumber = 'Way number is too long (max 50).';

	if (!v.partyId) errors.partyId = 'Select a party from the party list.';

	const itemName = v.itemName.trim();
	if (!itemName) errors.itemName = 'Item name is required.';
	else if (itemName.length > 120) errors.itemName = 'Item name is too long (max 120).';

	const w = computeWeights(v);
	Object.assign(errors, w.errors);

	const freightCharge = optionalAmount(v.freightCharge, 'freightCharge', 'Freight charge', errors);
	const price = optionalAmount(v.price, 'price', 'Price', errors);
	const amount = optionalAmount(v.amount, 'amount', 'Amount', errors);

	const narration = v.narration.trim();
	if (narration.length > 1000) errors.narration = 'Narration is too long (max 1000).';
	if (!isStatus(v.status)) errors.status = 'Status is required.';

	if (Object.keys(errors).length || !date || w.total == null || w.bagCount == null || w.kg == null) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		data: {
			transactionDate: date,
			purchaseType: v.purchaseType as TransactionData['purchaseType'],
			wayNumber,
			partyId: v.partyId,
			itemName,
			load: isNum(v.load) ? v.load : null,
			empty: isNum(v.empty) ? v.empty : null,
			autoCalculate: v.autoCalculate !== false,
			total: w.total,
			bagCount: w.bagCount,
			kg: w.kg,
			freightCharge,
			narration,
			price,
			amount,
			status: v.status
		}
	};
}

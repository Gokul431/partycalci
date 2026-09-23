import { describe, expect, it } from 'vitest';
import { KG_PER_BAG, calculateBags, calculateKg, calculateTotal } from './calculations';
import { EMPTY_GT_LOAD, computeWeights, validateParty, validateTransaction } from './validation';
import type { TransactionFormValues } from '$lib/types';

// Voucher 74808 from the mill's own listing: Total 6,460 prints as 104 bags and 12 kg.
const base: TransactionFormValues = {
	transactionDate: '2026-09-23',
	purchaseType: 'purchase',
	wayNumber: '74808',
	partyId: 'p1',
	itemName: 'Paddy',
	load: 10820,
	empty: 4360,
	freightCharge: null,
	narration: '',
	price: null,
	amount: null,
	status: 'active'
};

describe('business calculations', () => {
	it('uses 62 kg per bag', () => expect(KG_PER_BAG).toBe(62));
	it('Total = Load - Empty', () => expect(calculateTotal(10820, 4360)).toBe(6460));
	it('Bags = floor(Total / 62)', () => expect(calculateBags(6460)).toBe(104));
	it('Kg = Total - (Bags × 62)', () => expect(calculateKg(6460)).toBe(12));

	it('reads 95 kg as 1 bag 33 kg', () => {
		expect(calculateBags(95)).toBe(1);
		expect(calculateKg(95)).toBe(33);
	});

	it('leaves no remainder on an exact multiple', () => {
		expect(calculateBags(124)).toBe(2);
		expect(calculateKg(124)).toBe(0);
	});

	it('keeps Kg below a full bag for any total', () => {
		for (let total = 0; total < 500; total++) {
			const kg = calculateKg(total);
			expect(kg).toBeGreaterThanOrEqual(0);
			expect(kg).toBeLessThan(KG_PER_BAG);
			expect(calculateBags(total) * KG_PER_BAG + kg).toBe(total);
		}
	});
});

describe('computeWeights', () => {
	it('derives a real voucher', () => {
		expect(computeWeights(base)).toMatchObject({ total: 6460, bagCount: 104, kg: 12, errors: {} });
	});

	it('reproduces every voucher on the mill listing', () => {
		// [load, empty, printed Bag, printed Kg]
		const listing: [number, number, number, number][] = [
			[10820, 4360, 104, 12], [22480, 7320, 244, 32], [24550, 7420, 276, 18],
			[12480, 4330, 131, 28], [29710, 24810, 79, 2], [23250, 7410, 255, 30],
			[30610, 9630, 338, 24], [13240, 4350, 143, 24], [33680, 9430, 391, 8],
			[32200, 9410, 367, 36], [12700, 4320, 135, 10], [24910, 7710, 277, 26],
			[19480, 8930, 170, 10], [16950, 4450, 201, 38]
		];
		for (const [load, empty, bagCount, kg] of listing) {
			expect(computeWeights({ load, empty })).toMatchObject({ bagCount, kg, errors: {} });
		}
	});

	it('rejects Empty > Load', () => {
		expect(computeWeights({ load: 10820, empty: 12000 }).errors.empty).toBe(EMPTY_GT_LOAD);
	});

	it('requires both weights', () => {
		expect(computeWeights({ load: null, empty: null })).toMatchObject({
			total: null,
			bagCount: null,
			kg: null
		});
	});
});

describe('validateTransaction', () => {
	it('stores the derived weights', () => {
		const r = validateTransaction(base);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.data.total).toBe(6460);
			expect(r.data.bagCount).toBe(104);
			expect(r.data.kg).toBe(12);
			expect(r.data.freightCharge).toBe(0);
			expect(r.data.transactionDate.getDate()).toBe(23);
		}
	});
	it('requires the mandatory fields', () => {
		const r = validateTransaction({ ...base, wayNumber: ' ', partyId: '', itemName: '', load: null, transactionDate: '' });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['itemName', 'load', 'partyId', 'transactionDate', 'wayNumber']);
	});
	it('rejects negative money fields', () => {
		expect(validateTransaction({ ...base, amount: -1 }).ok).toBe(false);
	});
});

describe('validateParty', () => {
	it('requires a name and trims input', () => {
		expect(validateParty({ partyName: ' ', place: '', phoneNumber: '', status: 'active' }).ok).toBe(false);
		const r = validateParty({ partyName: ' Karthick ', place: ' KLU ', phoneNumber: '9626540553', status: 'active' });
		expect(r).toEqual({ ok: true, data: { partyName: 'Karthick', place: 'KLU', phoneNumber: '9626540553', status: 'active' } });
	});
	it('validates phone numbers', () => {
		expect(validateParty({ partyName: 'A', place: '', phoneNumber: '12ab', status: 'active' }).ok).toBe(false);
		expect(validateParty({ partyName: 'A', place: '', phoneNumber: '+91 96265 40553', status: 'active' }).ok).toBe(true);
	});
});

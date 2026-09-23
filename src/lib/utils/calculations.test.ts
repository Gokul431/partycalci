import { describe, expect, it } from 'vitest';
import { KG_PER_BAG, calculateKg, calculateTotal } from './calculations';
import { EMPTY_GT_LOAD, NEGATIVE_KG, computeWeights, validateParty, validateTransaction } from './validation';
import type { TransactionFormValues } from '$lib/types';

const base: TransactionFormValues = {
	transactionDate: '2026-09-23',
	purchaseType: 'purchase',
	wayNumber: '37473-R',
	partyId: 'p1',
	itemName: 'Paddy',
	load: 7500,
	empty: 2500,
	bagCount: 100,
	freightCharge: null,
	narration: '',
	price: null,
	amount: null,
	status: 'active'
};

describe('business calculations', () => {
	it('uses 62 kg per bag', () => expect(KG_PER_BAG).toBe(62));
	it('Total = Load - Empty', () => expect(calculateTotal(7500, 2500)).toBe(5000));
	it('Kg = (Bags × 62) - Total', () => expect(calculateKg(100, 5000)).toBe(1200));
});

describe('computeWeights', () => {
	it('computes the client example', () => {
		expect(computeWeights(base)).toMatchObject({ total: 5000, kg: 1200, errors: {} });
	});
	it('rejects Empty > Load', () => {
		expect(computeWeights({ ...base, empty: 8000 }).errors.empty).toBe(EMPTY_GT_LOAD);
	});
	it('flags negative Kg', () => {
		expect(computeWeights({ ...base, bagCount: 50 }).errors.kg).toBe(NEGATIVE_KG);
	});
	it('requires whole bag counts', () => {
		expect(computeWeights({ ...base, bagCount: 10.5 }).errors.bagCount).toBeDefined();
	});
});

describe('validateTransaction', () => {
	it('returns recalculated data', () => {
		const r = validateTransaction(base);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.data.total).toBe(5000);
			expect(r.data.kg).toBe(1200);
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
		const r = validateTransaction({ ...base, amount: -1 });
		expect(r.ok).toBe(false);
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

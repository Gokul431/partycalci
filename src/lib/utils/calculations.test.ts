import { describe, expect, it } from 'vitest';
import {
	KG_PER_BAG,
	calculateBags,
	calculateItemAmount,
	calculateKg,
	calculateTotal,
	calculateTotalAmount,
	ratePerKg
} from './calculations';
import { EMPTY_GT_LOAD, computeWeights, validateParty, validateTransaction } from './validation';
import type { PartyInput, TransactionFormValues } from '$lib/types';

// Voucher 74808 from the mill's own listing: Total 6,460 prints as 104 bags and 12 kg.
const base: TransactionFormValues = {
	transactionDate: '2026-09-23',
	purchaseType: 'purchase',
	wayNumber: '74808',
	partyId: 'p1',
	itemName: 'Paddy',
	load: 10820,
	empty: 4360,
	autoCalculate: true,
	kg: null,
	total: null,
	bagCount: null,
	freightCharge: null,
	narration: '',
	price: null,
	status: 'active'
};

const party: PartyInput = {
	partyName: 'Karthick',
	place: 'KLU',
	phoneNumber: '9626540553',
	partyType: 'wholesale',
	accountName: '',
	accountNo: '',
	ifscCode: '',
	bankName: '',
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
		const r = validateTransaction(base, 'wholesale');
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
		const r = validateTransaction(
			{ ...base, wayNumber: ' ', partyId: '', itemName: '', load: null, transactionDate: '' },
			'wholesale'
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['itemName', 'load', 'partyId', 'transactionDate', 'wayNumber']);
	});
	it('rejects negative money fields', () => {
		expect(validateTransaction({ ...base, price: -1 }, 'wholesale').ok).toBe(false);
	});
});

describe('billing', () => {
	// The client's worked example: 952 kg = 15 bags + 22 loose, at ₹1,500 a bag.
	const PRICE = 1500;
	const BAGS = 15;
	const LOOSE = 22;
	const FREIGHT = 500;

	it('breaks the bag price down to the kilo, rounded down', () => {
		// 1500 / 62 = 24.19
		expect(ratePerKg(PRICE)).toBe(24);
	});

	it('bills a farmer for the bags and the loose kg', () => {
		expect(calculateItemAmount('farmer', BAGS, LOOSE, PRICE)).toBe(23028);
	});

	it('bills wholesale for the full bags only', () => {
		expect(calculateItemAmount('wholesale', BAGS, LOOSE, PRICE)).toBe(22500);
	});

	it('subtracts the freight from the item amount', () => {
		expect(calculateTotalAmount(23028, FREIGHT)).toBe(22528);
		expect(calculateTotalAmount(22500, FREIGHT)).toBe(22000);
	});

	it('leaves the total equal to the item amount when there is no freight', () => {
		expect(calculateTotalAmount(23028, 0)).toBe(23028);
	});

	it('is the loose-kg line that separates the two party types', () => {
		const farmer = calculateItemAmount('farmer', BAGS, LOOSE, PRICE);
		const wholesale = calculateItemAmount('wholesale', BAGS, LOOSE, PRICE);
		expect(farmer - wholesale).toBe(LOOSE * ratePerKg(PRICE));
		expect(farmer - wholesale).toBe(528);
	});

	it('stores the amount the party type calls for', () => {
		const entry = { ...base, load: 3452, empty: 2500, price: PRICE, freightCharge: FREIGHT };
		const asFarmer = validateTransaction(entry, 'farmer');
		const asWholesale = validateTransaction(entry, 'wholesale');
		expect(asFarmer.ok && asFarmer.data).toMatchObject({ bagCount: 15, kg: 22, amount: 23028 });
		expect(asWholesale.ok && asWholesale.data).toMatchObject({ bagCount: 15, kg: 22, amount: 22500 });
	});
});

describe('validateParty', () => {
	it('requires a name and trims input', () => {
		expect(validateParty({ ...party, partyName: ' ' }).ok).toBe(false);
		const r = validateParty({ ...party, partyName: ' Karthick ', place: ' KLU ' });
		expect(r).toEqual({ ok: true, data: { ...party, partyName: 'Karthick', place: 'KLU' } });
	});
	it('validates phone numbers', () => {
		expect(validateParty({ ...party, phoneNumber: '12ab' }).ok).toBe(false);
		expect(validateParty({ ...party, phoneNumber: '+91 96265 40553' }).ok).toBe(true);
	});
	it('requires a party type', () => {
		expect(validateParty({ ...party, partyType: 'trader' as never }).ok).toBe(false);
	});
	it('accepts and trims bank details', () => {
		const r = validateParty({
			...party,
			accountName: ' Prasanna Venkatesh ',
			accountNo: ' 123456789012 ',
			ifscCode: ' sbin0001234 ',
			bankName: ' State Bank of India '
		});
		expect(r).toEqual({
			ok: true,
			data: {
				...party,
				accountName: 'Prasanna Venkatesh',
				accountNo: '123456789012',
				ifscCode: 'SBIN0001234',
				bankName: 'State Bank of India'
			}
		});
	});
});

describe('manual weights (auto-calculate off)', () => {
	const manual = { load: null, empty: null, autoCalculate: false, total: 6000, bagCount: 96, kg: 48 };

	it('takes every weight exactly as typed', () => {
		expect(computeWeights(manual)).toMatchObject({ total: 6000, bagCount: 96, kg: 48, errors: {} });
	});
	it('makes Load and Empty optional', () => {
		const r = validateTransaction({ ...base, ...manual }, 'wholesale');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data).toMatchObject({ load: null, empty: null, autoCalculate: false, kg: 48 });
	});
	it('does not require Total to match Load − Empty', () => {
		const r = validateTransaction({ ...base, ...manual, load: 9000, empty: 1000 }, 'wholesale');
		expect(r.ok && r.data.total).toBe(6000);
	});
	it('accepts weights that do not agree with each other', () => {
		// 60 bags could never hold 500 kg at 62 kg a bag, but manual entry does not judge.
		const r = computeWeights({ ...manual, total: 500, bagCount: 60, kg: 0 });
		expect(r).toMatchObject({ total: 500, bagCount: 60, kg: 0, errors: {} });
	});
	it('requires Total, Bags and Loose Kg', () => {
		const { errors } = computeWeights({ ...manual, total: null, bagCount: null, kg: null });
		expect(Object.keys(errors).sort()).toEqual(['bagCount', 'kg', 'total']);
	});
	it('still rejects a negative Loose Kg', () => {
		expect(computeWeights({ ...manual, kg: -5 }).errors.kg).toBeDefined();
	});
});

describe('way number and purchase type stay in step', () => {
	it('lets a typed -R override a Purchase dropdown', () => {
		const r = validateTransaction({ ...base, wayNumber: '37473-R', purchaseType: 'purchase' }, 'wholesale');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.data.purchaseType).toBe('return');
			expect(r.data.wayNumber).toBe('37473-R');
		}
	});

	it('lets a typed -P override a Return dropdown', () => {
		const r = validateTransaction({ ...base, wayNumber: '37473-P', purchaseType: 'return' }, 'wholesale');
		expect(r.ok && r.data.purchaseType).toBe('purchase');
		expect(r.ok && r.data.wayNumber).toBe('37473-P');
	});

	it('keeps a letter typed after a space rather than printing it twice', () => {
		const r = validateTransaction({ ...base, wayNumber: '37473 P', purchaseType: 'return' }, 'wholesale');
		expect(r.ok && r.data.wayNumber).toBe('37473-P');
	});

	it('falls back to the dropdown when no letter is typed', () => {
		const asReturn = validateTransaction({ ...base, wayNumber: '37473', purchaseType: 'return' }, 'wholesale');
		expect(asReturn.ok && asReturn.data.wayNumber).toBe('37473-R');
		const asPurchase = validateTransaction({ ...base, wayNumber: '37473', purchaseType: 'purchase' }, 'wholesale');
		expect(asPurchase.ok && asPurchase.data.wayNumber).toBe('37473-P');
	});

	it('stores a suffix that always matches the stored type', () => {
		for (const wayNumber of ['37473-R', '37473-P', '37473R', '37473 P', '37473', 'TRIP']) {
			for (const dropdown of ['purchase', 'return'] as const) {
				const r = validateTransaction({ ...base, wayNumber, purchaseType: dropdown }, 'wholesale');
				expect(r.ok).toBe(true);
				if (!r.ok) continue;
				const expected = r.data.purchaseType === 'return' ? 'R' : 'P';
				expect(r.data.wayNumber.endsWith(`-${expected}`)).toBe(true);
			}
		}
	});
});

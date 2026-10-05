import { describe, expect, it } from 'vitest';
import { validateTransaction } from './validation';
import type { TransactionFormValues } from '$lib/types';

describe('validateTransaction', () => {
	const baseForm: TransactionFormValues = {
		transactionDate: '2026-10-05',
		purchaseType: 'purchase',
		wayNumber: '3747',
		partyId: 'party-123',
		itemName: 'Paddy',
		load: 1000,
		empty: 200,
		autoCalculate: true,
		total: null,
		bagCount: null,
		kg: null,
		freightCharge: 50,
		narration: 'Test note',
		price: 1500,
		status: 'active'
	};

	it('infers return and formats 3747-R when user typed 3747-R even if purchaseType was purchase', () => {
		const result = validateTransaction(
			{ ...baseForm, wayNumber: '3747-R', purchaseType: 'purchase' },
			'wholesale'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.wayNumber).toBe('3747-R');
			expect(result.data.purchaseType).toBe('return');
		}
	});

	it('infers purchase and formats 3747-P when user typed 3747-P even if purchaseType was return', () => {
		const result = validateTransaction(
			{ ...baseForm, wayNumber: '3747-P', purchaseType: 'return' },
			'wholesale'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.wayNumber).toBe('3747-P');
			expect(result.data.purchaseType).toBe('purchase');
		}
	});

	it('uses purchaseType dropdown if wayNumber has no suffix', () => {
		const resReturn = validateTransaction(
			{ ...baseForm, wayNumber: '3747', purchaseType: 'return' },
			'wholesale'
		);
		expect(resReturn.ok).toBe(true);
		if (resReturn.ok) {
			expect(resReturn.data.wayNumber).toBe('3747-R');
			expect(resReturn.data.purchaseType).toBe('return');
		}

		const resPurchase = validateTransaction(
			{ ...baseForm, wayNumber: '3747', purchaseType: 'purchase' },
			'wholesale'
		);
		expect(resPurchase.ok).toBe(true);
		if (resPurchase.ok) {
			expect(resPurchase.data.wayNumber).toBe('3747-P');
			expect(resPurchase.data.purchaseType).toBe('purchase');
		}
	});

	it('handles loose suffixes like 3747R or 3747 - R', () => {
		const result = validateTransaction(
			{ ...baseForm, wayNumber: '3747 - R', purchaseType: 'purchase' },
			'wholesale'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.wayNumber).toBe('3747-R');
			expect(result.data.purchaseType).toBe('return');
		}
	});
});

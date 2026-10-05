import { describe, expect, it } from 'vitest';
import {
	LOOSE_KG_NONE,
	entryStatusLabel,
	formatWayNumber,
	looseKgDisplay,
	purchaseTypeFromWayNumber,
	wayNumberBase
} from './format';

describe('formatWayNumber', () => {
	it('adds the suffix from the type', () => {
		expect(formatWayNumber('23232', 'purchase')).toBe('23232-P');
		expect(formatWayNumber('40001', 'return')).toBe('40001-R');
	});
	it('replaces a typed suffix that disagrees with the type', () => {
		expect(formatWayNumber('37473-R', 'purchase')).toBe('37473-P');
		expect(formatWayNumber('37476-p', 'return')).toBe('37476-R');
		expect(formatWayNumber('37473 - R', 'purchase')).toBe('37473-P');
		expect(formatWayNumber('37473R', 'return')).toBe('37473-R');
	});
	it('leaves letters that are part of the number alone', () => {
		expect(wayNumberBase('TRIP')).toBe('TRIP');
		expect(formatWayNumber('AB12', 'purchase')).toBe('AB12-P');
	});
});

describe('purchaseTypeFromWayNumber', () => {
	it('reads a hyphenated suffix', () => {
		expect(purchaseTypeFromWayNumber('37473-P')).toBe('purchase');
		expect(purchaseTypeFromWayNumber('37473-R')).toBe('return');
	});
	it('ignores case and spacing around the hyphen', () => {
		expect(purchaseTypeFromWayNumber('37473 - r')).toBe('return');
		expect(purchaseTypeFromWayNumber('37473-  p')).toBe('purchase');
	});
	it('reads a letter straight after a digit', () => {
		expect(purchaseTypeFromWayNumber('37473R')).toBe('return');
	});
	it('reads a letter after a plain space', () => {
		// This case used to be missed, leaving the typed letter inside the base so the
		// number printed as "37473 P-R" when the dropdown disagreed.
		expect(purchaseTypeFromWayNumber('37473 P')).toBe('purchase');
		expect(purchaseTypeFromWayNumber('37473 R')).toBe('return');
	});
	it('returns null when there is no suffix', () => {
		expect(purchaseTypeFromWayNumber('37473')).toBeNull();
		expect(purchaseTypeFromWayNumber('TRIP')).toBeNull();
		expect(purchaseTypeFromWayNumber('')).toBeNull();
	});
	it('agrees with the base the same string yields', () => {
		// Whatever the detector treats as a suffix, wayNumberBase must strip — otherwise
		// the letter is kept in the base and a second suffix is appended beside it.
		for (const input of ['37473-P', '37473-R', '37473 - r', '37473R', '37473 P', 'TRIP', '37473']) {
			const typed = purchaseTypeFromWayNumber(input);
			const base = wayNumberBase(input);
			if (typed) expect(base).not.toMatch(/[rp]$/i);
			expect(formatWayNumber(input, typed ?? 'purchase')).toBe(
				`${base}-${typed === 'return' ? 'R' : 'P'}`
			);
		}
	});
});

describe('entryStatusLabel', () => {
	it('reads an inactive entry as a completed bill', () => {
		expect(entryStatusLabel('inactive')).toBe('Completed');
	});
	it('reads an active entry as a pending bill', () => {
		expect(entryStatusLabel('active')).toBe('Pending');
	});
	it('never leaves the status blank', () => {
		// The old listing printed nothing for a live entry, so the column read empty on
		// every normal voucher. Both states must now print a word.
		for (const status of ['active', 'inactive'] as const) {
			expect(entryStatusLabel(status)).not.toBe('');
		}
	});
});

describe('looseKgDisplay', () => {
	it('shows a farmer the real figure, in the format of the surrounding column', () => {
		expect(looseKgDisplay('farmer', 48)).toBe('48 kg');
		expect(looseKgDisplay('farmer', 48, String)).toBe('48');
	});

	it('shows a farmer a genuine zero remainder as a figure, not a dash', () => {
		// A Total that divides exactly into bags: measured, and billed at nothing.
		expect(looseKgDisplay('farmer', 0)).toBe('0 kg');
	});

	it('dashes a wholesale party, who is not paid for the remainder', () => {
		expect(looseKgDisplay('wholesale', 48)).toBe(LOOSE_KG_NONE);
		expect(looseKgDisplay('wholesale', 0, String)).toBe(LOOSE_KG_NONE);
	});

	it('keeps the figure when no party record is in hand', () => {
		// The parties store loads separately from the rows. Dashing here would blink a
		// farmer's Kg away on every page load, and claim something we cannot know.
		expect(looseKgDisplay(undefined, 48)).toBe('48 kg');
	});
});

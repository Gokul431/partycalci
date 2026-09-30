import { describe, expect, it } from 'vitest';
import { defaultDateRange, matchPreset } from './ranges';

describe('defaultDateRange', () => {
	it('covers the month up to today', () => {
		expect(defaultDateRange(new Date(2026, 8, 30))).toEqual({
			from: '2026-08-30',
			to: '2026-09-30'
		});
	});

	it('clamps to the last day when the previous month is shorter', () => {
		// 31 March minus a month is 28 February, not 3 March.
		expect(defaultDateRange(new Date(2026, 2, 31)).from).toBe('2026-02-28');
	});

	it('crosses the year boundary', () => {
		expect(defaultDateRange(new Date(2026, 0, 15))).toEqual({
			from: '2025-12-15',
			to: '2026-01-15'
		});
	});
});

describe('matchPreset', () => {
	it('recognises a range that matches a quick period', () => {
		const today = new Date(2026, 8, 30);
		expect(matchPreset({ from: '2026-09-01', to: '2026-09-30' }, today)).toBe('This month');
	});

	it('returns null for a hand-picked range', () => {
		expect(matchPreset({ from: '2026-09-03', to: '2026-09-11' }, new Date(2026, 8, 30))).toBeNull();
	});
});

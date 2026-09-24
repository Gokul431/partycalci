import { describe, expect, it } from 'vitest';
import { formatWayNumber, wayNumberBase } from './format';

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

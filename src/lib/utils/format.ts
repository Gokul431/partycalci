import type { PurchaseType } from '$lib/types';

const numberFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const currencyFmt = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatNumber(n: number | null | undefined): string {
	return n == null || !Number.isFinite(n) ? '—' : numberFmt.format(n);
}

export function formatKg(n: number | null | undefined): string {
	return n == null || !Number.isFinite(n) ? '—' : `${numberFmt.format(n)} kg`;
}

export function formatCurrency(n: number | null | undefined): string {
	return n == null || !Number.isFinite(n) ? '—' : currencyFmt.format(n);
}

export function purchaseTypeLabel(t: string): string {
	return t === 'return' ? 'Return' : 'Purchase';
}

/**
 * A trailing R/P typed by the user: after a hyphen, after a space, or straight after a
 * digit. This is the single definition of the rule — the form and validation both read a
 * typed letter through `purchaseTypeFromWayNumber`, so a letter can never be detected in
 * one place and missed in another.
 */
const WAY_SUFFIX = /(?:\s*-\s*|\s+|(?<=\d))[rp]$/i;

/** Way number without any R/P suffix the user typed. */
export function wayNumberBase(wayNumber: string): string {
	return wayNumber.trim().replace(WAY_SUFFIX, '');
}

/** The type a typed way number implies, or null when it carries no R/P suffix. */
export function purchaseTypeFromWayNumber(wayNumber: string): PurchaseType | null {
	const match = WAY_SUFFIX.exec(wayNumber.trim());
	if (!match) return null;
	return match[0].trim().toLowerCase().endsWith('r') ? 'return' : 'purchase';
}

/**
 * Way number for display, suffixed from the entry's type: Purchase → -P, Return → -R.
 * Any R/P the user typed is replaced so the suffix always matches the type.
 */
export function formatWayNumber(wayNumber: string, purchaseType: string): string {
	const base = wayNumberBase(wayNumber);
	return base ? `${base}-${purchaseType === 'return' ? 'R' : 'P'}` : wayNumber;
}

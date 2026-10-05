import type { PartyType, PurchaseType, Status } from '$lib/types';
import { billsLooseKg } from './calculations';

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

/**
 * An entry's status describes its bill, not the record: `active` means the bill is still
 * pending, `inactive` means it has been completed. Parties share the `Status` type but
 * mean something different by it — selectable for new entries or not — so they keep their
 * own Active / Inactive wording. Defined once here so the two never drift apart.
 */
export function entryStatusLabel(status: Status): string {
	return status === 'inactive' ? 'Completed' : 'Pending';
}

/** Shown wherever a party's loose remainder does not apply — on screen and in both PDFs. */
export const LOOSE_KG_NONE = '-';

/**
 * The loose Kg as it should be shown. Only a farmer is paid for the remainder, so for a
 * wholesale party it reads as a dash rather than as a weight of zero — which would look
 * like a figure that had been measured.
 *
 * `partyType` is undefined only when no party record is in hand: the parties store has not
 * loaded yet, or the record is gone. A party that was saved without a type still arrives as
 * 'wholesale' (see toParty), so an undefined type is never a wholesale party — it is an
 * unknown one, and no basis for claiming the remainder was not billed. The stored figure
 * stands in that case, so a farmer's Kg never blinks to a dash while the store loads.
 *
 * Pass `format` to match the surrounding column; the screens want "48 kg", the PDFs the
 * bare figure.
 */
export function looseKgDisplay(
	partyType: PartyType | undefined,
	kg: number,
	format: (kg: number) => string = formatKg
): string {
	return partyType && !billsLooseKg(partyType) ? LOOSE_KG_NONE : format(kg);
}

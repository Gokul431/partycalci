const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
	return toISODate(new Date());
}

/** Parses YYYY-MM-DD as local midnight. Returns null for invalid input. */
export function parseISODate(value: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return toISODate(d) === value ? d : null;
}

export function addDays(d: Date, days: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Clamps to the last day of the target month, so 31 Mar minus one month is 28 Feb, not 3 Mar. */
export function addMonths(d: Date, months: number): Date {
	const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
	const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

export function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Weeks run Monday to Sunday. */
export function startOfWeek(d: Date): Date {
	return addDays(d, -((d.getDay() + 6) % 7));
}

/** DD-MM-YYYY, the format used by the business. */
export function formatDate(d: Date | null | undefined): string {
	if (!d) return '—';
	return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function formatDateTime(d: Date | null | undefined): string {
	if (!d) return '—';
	return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

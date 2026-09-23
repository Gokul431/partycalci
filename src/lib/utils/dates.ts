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

/** DD-MM-YYYY, the format used by the business. */
export function formatDate(d: Date | null | undefined): string {
	if (!d) return '—';
	return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function formatDateTime(d: Date | null | undefined): string {
	if (!d) return '—';
	return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

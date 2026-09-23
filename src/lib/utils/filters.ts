import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type Status, type TransactionFilters } from '$lib/types';
import { parseISODate } from './dates';

/** Filters live in the URL so they survive navigation (View → Back) and can be shared. */
export function filtersFromUrl(url: URL): TransactionFilters {
	const p = url.searchParams;
	const date = (k: string) => (parseISODate(p.get(k) ?? '') ? (p.get(k) as string) : '');
	const status = p.get('status');
	return {
		dateFrom: date('from'),
		dateTo: date('to'),
		search: (p.get('q') ?? '').slice(0, 100),
		status: status === 'active' || status === 'inactive' ? (status as Status) : ''
	};
}

export function pageSizeFromUrl(url: URL): number {
	const n = Number(url.searchParams.get('size'));
	return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function filtersToSearch(f: TransactionFilters, pageSize?: number): string {
	const p = new URLSearchParams();
	if (f.dateFrom) p.set('from', f.dateFrom);
	if (f.dateTo) p.set('to', f.dateTo);
	if (f.search.trim()) p.set('q', f.search.trim());
	if (f.status) p.set('status', f.status);
	if (pageSize && pageSize !== DEFAULT_PAGE_SIZE) p.set('size', String(pageSize));
	const s = p.toString();
	return s ? `?${s}` : '';
}

export function hasActiveFilters(f: TransactionFilters): boolean {
	return !!(f.dateFrom || f.dateTo || f.search.trim() || f.status);
}

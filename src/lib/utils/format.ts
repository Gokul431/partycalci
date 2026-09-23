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

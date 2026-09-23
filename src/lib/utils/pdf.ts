import type { Party, Transaction, TransactionFilters } from '$lib/types';
import { parseISODate } from './dates';

/** Printed on the report header — change these to rebrand the voucher listing. */
export const MILL_NAME = 'Elumalayan Modern Rice Mill';
const REPORT_TITLE = 'List of Mat. Rcvd. from Party Vouchers';
const VOUCHER_SERIES = 'Main';

const PAGE_MARGIN = 28;
const HEADER_HEIGHT = 58;

const decimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Qty and money: Indian grouping with two decimals, as the voucher listing prints them. */
const money = (n: number) => decimal.format(n);
/** Load, Empty, Bag and Kg print as bare integers with no grouping. */
const count = (n: number) => String(Math.round(n));
/** Header range is loose d-m-yyyy; the rows themselves stay zero-padded. */
const looseDate = (d: Date) => `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
const paddedDate = (d: Date) =>
	`${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const FONT_SIZE = 8;

/**
 * Widths sum to the printable width of A4 portrait at a 28pt margin, and each one clears
 * the widest header or value it has to hold at FONT_SIZE — measured, not estimated, so
 * nothing wraps onto a second line.
 */
const COLUMNS = [
	{ header: 'Date', width: 47, align: 'left' },
	{ header: 'Way No:', width: 42, align: 'left' },
	{ header: 'Particulars', width: 62, align: 'left' },
	{ header: 'Mobile', width: 50, align: 'left' },
	{ header: 'Item Details', width: 51, align: 'left' },
	{ header: 'Load', width: 28, align: 'right' },
	{ header: 'Empty', width: 31, align: 'right' },
	// Qty carries the Grand Total, which is far wider than any single row's value.
	{ header: 'Qty.', width: 55, align: 'right' },
	{ header: 'Bag', width: 24, align: 'right' },
	{ header: 'Kg', width: 30, align: 'right' },
	{ header: 'Freight', width: 47, align: 'right' },
	// Price always prints blank, so it only has to hold its own header.
	{ header: 'Price', width: 30, align: 'right' },
	{ header: 'Status', width: 42, align: 'left' }
] as const;

/** Index of the Qty column, which the Grand Total sits under. */
const QTY_INDEX = 7;

function rangeLabel(rows: Transaction[], filters: TransactionFilters): string {
	const dates = rows.map((r) => r.transactionDate.getTime());
	const from = parseISODate(filters.dateFrom) ?? (dates.length ? new Date(Math.min(...dates)) : null);
	const to = parseISODate(filters.dateTo) ?? (dates.length ? new Date(Math.max(...dates)) : null);
	if (!from || !to) return '';
	return `From ${looseDate(from)} to ${looseDate(to)}`;
}

function bodyRow(t: Transaction, party: Party | undefined): string[] {
	return [
		paddedDate(t.transactionDate),
		t.wayNumber,
		[party?.partyName, party?.place].filter(Boolean).join(' '),
		party?.phoneNumber ?? '',
		t.itemName,
		count(t.load),
		count(t.empty),
		money(t.total),
		count(t.bagCount),
		count(t.kg),
		money(t.freightCharge),
		// Price is left blank on this listing, as it is on the printed voucher report.
		'',
		t.status === 'inactive' ? 'Cancelled' : ''
	];
}

export function voucherFileName(filters: TransactionFilters): string {
	const from = filters.dateFrom ? `-${filters.dateFrom}` : '';
	const to = filters.dateTo ? `-to-${filters.dateTo}` : '';
	return `mat-rcvd-from-party${from}${to}.pdf`;
}

/**
 * Builds the voucher listing.
 * Rows arrive newest-first from Firestore; the printed listing reads oldest-first.
 */
export async function buildVoucherListing(
	rows: Transaction[],
	partyById: Map<string, Party>,
	filters: TransactionFilters
) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);

	const ordered = [...rows].reverse();
	const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth();
	const range = rangeLabel(ordered, filters);
	const grandTotal = ordered.reduce((sum, t) => sum + t.total, 0);

	autoTable(doc, {
		head: [COLUMNS.map((c) => c.header)],
		body: ordered.map((t) => bodyRow(t, partyById.get(t.partyId))),
		foot: [
			[
				{ content: 'Grand Total', colSpan: QTY_INDEX, styles: { halign: 'right' } },
				{ content: money(grandTotal), styles: { halign: 'right' } },
				'',
				'',
				'',
				'',
				''
			]
		],
		theme: 'grid',
		startY: PAGE_MARGIN + HEADER_HEIGHT,
		margin: { top: PAGE_MARGIN + HEADER_HEIGHT, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
		styles: { font: 'helvetica', fontSize: FONT_SIZE, cellPadding: 3, lineColor: 0, lineWidth: 0.5, textColor: 0 },
		headStyles: { fillColor: false, fontStyle: 'bold', textColor: 0 },
		footStyles: { fillColor: false, fontStyle: 'bold', textColor: 0 },
		columnStyles: Object.fromEntries(
			COLUMNS.map((c, i) => [i, { cellWidth: c.width, halign: c.align }])
		),
		didDrawPage() {
			doc.setLineWidth(0.5);
			doc.rect(PAGE_MARGIN, PAGE_MARGIN, pageWidth - PAGE_MARGIN * 2, HEADER_HEIGHT);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(16);
			doc.text(MILL_NAME, pageWidth / 2, PAGE_MARGIN + 20, { align: 'center' });
			doc.setFontSize(9);
			doc.text(REPORT_TITLE, pageWidth / 2, PAGE_MARGIN + 33, { align: 'center' });
			// Back to normal before the next page's table is drawn.
			doc.setFont('helvetica', 'normal');
			doc.text(`Voucher Series : ${VOUCHER_SERIES}`, PAGE_MARGIN + 6, PAGE_MARGIN + 50);
			if (range) doc.text(range, pageWidth - PAGE_MARGIN - 6, PAGE_MARGIN + 50, { align: 'right' });
		}
	});

	return doc;
}

/** Builds the listing and hands it to the browser as a download. */
export async function downloadVoucherListing(
	rows: Transaction[],
	partyById: Map<string, Party>,
	filters: TransactionFilters
): Promise<void> {
	const doc = await buildVoucherListing(rows, partyById, filters);
	doc.save(voucherFileName(filters));
}

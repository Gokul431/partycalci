import type { Party, Transaction, TransactionFilters } from '$lib/types';
import { calculateTotalAmount } from './calculations';
import { parseISODate } from './dates';
import { formatWayNumber } from './format';
import { canShape, loadShapingFont, needsShaping, shapeText, type ShapedText } from './pdfShaping';

/** Printed on the report header — change these to rebrand the voucher listing. */
export const MILL_NAME = 'Elumalayan Modern Rice Mill';
const REPORT_TITLE = 'List of Mat. Rcvd. from Party Vouchers';
const VOUCHER_SERIES = 'Main';

const PAGE_MARGIN = 28;
const HEADER_HEIGHT = 58;

const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Qty and money: whole rupees with Indian grouping — 5,008 rather than 5,008.00. */
const money = (n: number) => grouped.format(n);
/** Load, Empty, Bag and Kg print as bare integers with no grouping. */
const count = (n: number) => String(Math.round(n));
/** Header range is loose d-m-yyyy; the rows themselves stay zero-padded. */
const looseDate = (d: Date) => `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
const paddedDate = (d: Date) =>
	`${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const FONT_SIZE = 8;
const CELL_PADDING = 3;

/**
 * Widths sum to 539 (within A4 portrait printable at 28pt margins). Each column
 * accommodates its widest header or body value at FONT_SIZE — verified against
 * Helvetica metrics — so nothing wraps.
 */
const COLUMNS = [
	{ header: 'Date', width: 47, align: 'left' },
	{ header: 'Way No:', width: 40, align: 'left' },
	// Party names wrap; this column gives up width to the cramped right-side columns.
	{ header: 'Particulars', width: 61, align: 'left' },
	{ header: 'Item', width: 41, align: 'left' },
	{ header: 'Total', width: 31, align: 'right' },
	{ header: 'Qty.', width: 27, align: 'right' },
	{ header: 'Bag', width: 33, align: 'right' },
	{ header: 'Kg', width: 33, align: 'right' },
	{ header: 'Freight', width: 37, align: 'right' },
	// Price per bag (body[9] = money(t.amount)).
	{ header: 'Price', width: 47, align: 'right' },
	// Net amount after freight (body[10] = money(calculateTotalAmount(...))).
	{ header: 'Amount', width: 47, align: 'right' },
	// 'Cancelled' fits on one line here.
	{ header: 'Total', width: 48, align: 'right' },
	// Grand total value in the footer uses this column's width.
	{ header: 'Status', width: 47, align: 'left' }
] as const;

/** Index of the Particulars column, the only one whose text is shaped into an image. */
const PARTICULARS_INDEX = 2;
/** Index of the Total Amount column, which the grand total sits under. */
const TOTAL_AMOUNT_INDEX = 12;

/**
 * Pre-renders every body cell holding Tamil (or other complex-script) text, keyed
 * "row:column". Empty outside a browser, where cells fall back to plain text.
 */
async function shapeCells(body: string[][]): Promise<Map<string, ShapedText>> {
	const shaped = new Map<string, ShapedText>();
	if (!canShape() || !body.some((row) => row.some(needsShaping))) return shaped;
	try {
		await loadShapingFont();
	} catch (e) {
		// The browser still shapes with any installed Tamil font; only the typeface differs.
		console.warn('Tamil PDF font failed to load; using a system font.', e);
	}
	// A party's name repeats on every one of its rows: render (and embed) it once.
	const byText = new Map<string, ShapedText>();
	body.forEach((row, r) =>
		row.forEach((text, c) => {
			if (!needsShaping(text)) return;
			const key = `${c}\u0000${text}`;
			let s = byText.get(key);
			if (!s) byText.set(key, (s = shapeText(text, FONT_SIZE, COLUMNS[c].width - CELL_PADDING * 2)));
			shaped.set(`${r}:${c}`, s);
		})
	);
	return shaped;
}

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
		formatWayNumber(t.wayNumber, t.purchaseType),
		[party?.partyName, party?.place].filter(Boolean).join(' '),
		t.itemName,
		money(t.total),
		count(t.bagCount),
		count(t.kg),
		money(t.freightCharge),
		// Price per bag; blank rather than a bare 0 when no rate was recorded.
		t.price ? money(t.price) : '',
		money(t.amount),
		money(calculateTotalAmount(t.amount, t.freightCharge)),
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
	const body = ordered.map((t) => bodyRow(t, partyById.get(t.partyId)));
	const shaped = await shapeCells(body);
	const shapedCell = (section: string, row: number, col: number) =>
		section === 'body' ? shaped.get(`${row}:${col}`) : undefined;

	const grandTotal = ordered.reduce(
		(sum, t) => sum + calculateTotalAmount(t.amount, t.freightCharge),
		0
	);

	autoTable(doc, {
		head: [COLUMNS.map((c) => c.header)],
		body,
		foot: [
			[
				{ content: 'Grand Total', colSpan: TOTAL_AMOUNT_INDEX, styles: { halign: 'right' } },
				{ content: money(grandTotal), styles: { halign: 'right' } },
				''
			]
		],
		theme: 'grid',
		// A shaped (image) cell cannot be split, so rows move to the next page whole.
		rowPageBreak: 'avoid',
		startY: PAGE_MARGIN + HEADER_HEIGHT,
		margin: { top: PAGE_MARGIN + HEADER_HEIGHT, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
		styles: {
			font: 'helvetica',
			fontSize: FONT_SIZE,
			cellPadding: CELL_PADDING,
			lineColor: 0,
			lineWidth: 0.5,
			textColor: 0,
			// Centre short cells against a row made tall by a wrapped party name.
			valign: 'middle'
		},
		headStyles: { fillColor: false, fontStyle: 'bold', textColor: 0, valign: 'middle' },
		footStyles: { fillColor: false, fontStyle: 'bold', textColor: 0, valign: 'middle' },
		columnStyles: Object.fromEntries(
			COLUMNS.map((c, i) => [
				i,
				{
					cellWidth: c.width,
					halign: c.align,
					fontStyle: i === 0 ? 'bold' : undefined,
					// A shaped name is drawn as an image anchored to the cell's top padding.
					...(i === PARTICULARS_INDEX ? { valign: 'top' as const } : {})
				}
			])
		),
		// Shaped cells: blank text lines reserve the height, then the rendered image is drawn in.
		didParseCell(data) {
			const s = shapedCell(data.section, data.row.index, data.column.index);
			if (s) data.cell.text = Array(Math.ceil(s.height / (FONT_SIZE * doc.getLineHeightFactor()))).fill('');

			// Ensure amount columns (9: Amount, 10: Total Amount) stay on one line
			if (data.column.index === 9 || data.column.index === 10) {
				if (Array.isArray(data.cell.text) && data.cell.text.length > 1) {
					data.cell.text = [data.cell.text.join('')];
				}
			}
		},
		didDrawCell(data) {
			const s = shapedCell(data.section, data.row.index, data.column.index);
			if (!s) return;
			const x = data.cell.x + data.cell.padding('left');
			const y = data.cell.y + data.cell.padding('top');
			doc.addImage(s.image, 'PNG', x, y, s.width, s.height, s.alias, 'FAST');
		},
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

/** PDF receipt for a single Receive From Party record, matching the reference template image.png. */
export async function buildSingleReceipt(transaction: Transaction, party: Party | undefined): Promise<any> {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);

	if (!party && transaction.partyId) {
		try {
			const { getParty } = await import('$lib/firebase/firestore');
			party = (await getParty(transaction.partyId)) ?? undefined;
		} catch {
			// ignore
		}
	}

	const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt

	/* ---------- Centered Header ---------- */
	let y = 60;
	doc.setTextColor(0);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(14);
	doc.text('Elumalayayan Modern Rice Mill', pageWidth / 2, y, { align: 'center' });

	y += 16;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9.5);
	doc.text('321/1 - Palathali Road, Kalagupulikadu, Alvilam Post', pageWidth / 2, y, { align: 'center' });

	y += 13;
	doc.text('Pattukkottai - 614602', pageWidth / 2, y, { align: 'center' });

	y += 20;
	doc.text('Mat. Rcvd from party', pageWidth / 2, y, { align: 'center' });

	y += 18;

	/* ---------- Optional Tamil script shaping for party name ---------- */
	let shapedName: ShapedText | null = null;
	if (party?.partyName && needsShaping(party.partyName) && canShape()) {
		try {
			await loadShapingFont();
			shapedName = shapeText(party.partyName, 9, 330 - 12);
		} catch (e) {
			console.warn('Tamil PDF font failed to load for receipt', e);
		}
	}

	/* ---------- Common Table Styles ---------- */
	const tableConfig = {
		theme: 'grid' as const,
		styles: {
			font: 'helvetica' as const,
			fontSize: 9,
			textColor: 0,
			lineColor: 0,
			lineWidth: 0.5,
			fillColor: false as const,
			cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
			valign: 'middle' as const
		},
		headStyles: { fillColor: false as const },
		alternateRowStyles: { fillColor: false as const },
		columnStyles: {
			0: { cellWidth: 175, halign: 'left' as const, fontStyle: 'bold' as const },
			1: { halign: 'left' as const }
		},
		margin: { left: 45, right: 45 }
	};

	/* ---------- Table 1: Date, Way No, Name, Place, Phone ---------- */
	const d = transaction.transactionDate instanceof Date ? transaction.transactionDate : new Date(transaction.transactionDate);
	const pad = (n: number) => String(n).padStart(2, '0');
	const dateFormatted = !isNaN(d.getTime())
		? `${pad(d.getDate())} / ${pad(d.getMonth() + 1)}/ ${d.getFullYear()}`
		: '';

	const table1Body = [
		['Date', dateFormatted],
		['Way No', transaction.wayNumber || ''],
		['Name', party?.partyName ?? ''],
		['Place', party?.place ?? ''],
		['Phone', party?.phoneNumber ?? '']
	];

	autoTable(doc, {
		...tableConfig,
		startY: y,
		body: table1Body,
		didParseCell(data) {
			if (shapedName && data.row.index === 2 && data.column.index === 1) {
				data.cell.text = [''];
			}

			// Ensure Date column (index 0, row 0) stays on one line
			if (data.row.index === 0 && data.column.index === 0) {
				if (Array.isArray(data.cell.text) && data.cell.text.length > 1) {
					data.cell.text = [data.cell.text.join('')];
				}
			}
		},
		didDrawCell(data) {
			if (shapedName && data.row.index === 2 && data.column.index === 1) {
				const cellX = data.cell.x + data.cell.padding('left');
				const cellY = data.cell.y + data.cell.padding('top');
				doc.addImage(shapedName.image, 'PNG', cellX, cellY, shapedName.width, shapedName.height, shapedName.alias, 'FAST');
			}
		}
	});

	// @ts-expect-error autotable records lastAutoTable on doc
	y = doc.lastAutoTable.finalY + 16;

	/* ---------- Table 2: Load, Empty, Total, Bag, Kgs, Price, Item Amount, Freight Charge (-), Total Amount ---------- */
	const loadStr = transaction.load != null ? String(transaction.load) : '';
	const emptyStr = transaction.empty != null ? String(transaction.empty) : '';
	const totalStr = transaction.total != null ? String(transaction.total) : '';
	const bagStr = transaction.bagCount != null ? String(transaction.bagCount) : '';
	const kgStr = transaction.kg != null ? String(transaction.kg) : '';
	const priceStr = transaction.price != null && transaction.price !== 0 ? String(transaction.price) : '';
	const amountStr = transaction.amount != null && transaction.amount !== 0 ? String(transaction.amount) : '';
	const freightStr = transaction.freightCharge != null ? String(transaction.freightCharge) : '';
	const totalAmount = calculateTotalAmount(transaction.amount, transaction.freightCharge);
	const totalAmountStr = totalAmount != null && totalAmount !== 0 ? String(totalAmount) : '';

	const table2Body = [
		['Load', loadStr],
		['Empty', emptyStr],
		['Total', totalStr],
		['Bag', bagStr],
		['Kgs', kgStr],
		['Price', priceStr],
		['Item Amount', amountStr],
		['Freight Charge ( - )', freightStr],
		['Total Amount', totalAmountStr]
	];

	autoTable(doc, {
		...tableConfig,
		startY: y,
		body: table2Body,
		didParseCell(data) {
			// Ensure amount columns stay on one line: Total (idx 2), Item Amount (idx 6), Total Amount (idx 8)
			if (data.column.index === 2 || data.column.index === 6 || data.column.index === 8) {
				if (Array.isArray(data.cell.text) && data.cell.text.length > 1) {
					data.cell.text = [data.cell.text.join('')];
				}
			}
		}
	});

	// @ts-expect-error autotable records lastAutoTable on doc
	y = doc.lastAutoTable.finalY + 16;

	/* ---------- Table 3: Account Name, Account NO:, IFSC code, Bank Name ---------- */
	const table3Body = [
		['Account Name', party?.accountName || party?.partyName || ''],
		['Account NO:', party?.accountNo || ''],
		['IFSC code', party?.ifscCode || ''],
		['Bank Name', party?.bankName || '']
	];

	autoTable(doc, {
		...tableConfig,
		startY: y,
		body: table3Body
	});

	// @ts-expect-error autotable records lastAutoTable on doc
	y = doc.lastAutoTable.finalY + 30;

	/* ---------- Bottom: Verified By ---------- */
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9.5);
	doc.text('Verified By', 45, y);

	return doc;
}

/** Download a single-receipt PDF for the given transaction and party. */
export async function downloadSingleReceipt(
	transaction: Transaction,
	party: Party | undefined
): Promise<void> {
	const doc = await buildSingleReceipt(transaction, party);
	const wayNo = transaction.wayNumber ? transaction.wayNumber.trim() : 'receipt';
	doc.save(`Mat_Received_${wayNo}.pdf`);
}

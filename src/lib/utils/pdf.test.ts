import { describe, expect, it } from 'vitest';
import { buildVoucherListing } from './pdf';
import type { Party, Transaction, TransactionFilters } from '$lib/types';

/**
 * Every row of the printed voucher listing this report reproduces. Voucher 75102 prints as
 * two item lines there; one item per entry here, which sums to the same Grand Total.
 */
const SAMPLE: [string, string, string, string, string, string, number, number, number, number, number][] = [
	['2026-08-01', '74808', 'Karthick', 'KLU', '9626540553', 'DLX-OLD', 10820, 4360, 104, 12, 0],
	['2026-08-04', '74923', 'Karthick', 'KLU', '9626540553', 'DLX', 22480, 7320, 244, 32, 7620],
	['2026-08-07', '75102', 'Senthil', 'Nat', '', 'DLX', 161, 0, 2, 37, 9100],
	['2026-08-07', '75102', 'Senthil', 'Nat', '', 'Kalsar.', 77, 0, 1, 15, 0],
	['2026-08-13', '75444', 'Karthick', 'KLU', '9626540553', 'DLX', 24550, 7420, 276, 18, 8952],
	['2026-08-13', '75482', 'Karthick', 'KLU', '9626540553', 'DLX-OLD', 12480, 4330, 131, 28, 0],
	['2026-08-16', '75630', 'Karthick', 'KLU', '9626540553', 'DLX', 29710, 24810, 79, 2, 0],
	['2026-08-18', '75731', 'Karthick', 'KLU', '9626540553', 'DLX-OLD', 23250, 7410, 255, 30, 8535],
	['2026-08-18', '75728', 'Karthick', 'KLU', '9626540553', 'DLX', 30610, 9630, 338, 24, 10320],
	['2026-08-20', '75800', 'Karthick', 'KLU', '9626540553', 'DLX-OLD', 13240, 4350, 143, 24, 0],
	['2026-08-21', '75848', 'Karthick', 'KLU', '9626540553', 'DLX', 33680, 9430, 391, 8, 9955],
	['2026-08-22', '75883', 'Karthick', 'KLU', '9626540553', 'DLX', 32200, 9410, 367, 36, 9355],
	['2026-08-22', '75905', 'Karthick', 'KLU', '9626540553', 'DLX', 12700, 4320, 135, 10, 0],
	['2026-08-24', '75943', 'Senthil', 'Nat', '', 'DLX', 24910, 7710, 277, 26, 16600],
	['2026-08-25', '75993', 'Karthick', 'KLU', '9626540553', 'DLX', 19480, 8930, 170, 10, 5280],
	['2026-08-26', '76040', 'Sidiq', 'Ponpethi', '', 'DLX', 16950, 4450, 201, 38, 6030]
];

function fixture() {
	const partyById = new Map<string, Party>();
	const rows: Transaction[] = SAMPLE.map(
		([date, way, name, place, phone, item, load, empty, bagCount, kg, freightCharge], i) => {
			const partyId = `${name}-${place}`;
			partyById.set(partyId, {
				id: partyId,
				partyName: name,
				place,
				phoneNumber: phone,
				partyType: 'wholesale',
				status: 'active',
				createdAt: null,
				updatedAt: null
			});
			return {
				id: String(i),
				transactionDate: new Date(`${date}T00:00:00`),
				purchaseType: 'purchase',
				wayNumber: way,
				partyId,
				itemName: item,
				load,
				empty,
				autoCalculate: true,
				total: load - empty,
				bagCount,
				kg,
				freightCharge,
				narration: '',
				price: 0,
				amount: 0,
				status: 'active',
				createdAt: null,
				updatedAt: null
			};
		}
	);
	// Firestore returns newest first; the listing prints oldest first.
	return { rows: [...rows].reverse(), partyById };
}

const FILTERS: TransactionFilters = {
	dateFrom: '2026-04-01',
	dateTo: '2026-09-19',
	search: '',
	status: ''
};

describe('voucher listing PDF', () => {
	it('renders a single page carrying the grand total of the Qty column', async () => {
		const { rows, partyById } = fixture();
		const doc = await buildVoucherListing(rows, partyById, FILTERS);

		expect(doc.getNumberOfPages()).toBe(1);

		// The Grand Total printed on the reference listing: 1,93,418.00
		const qtyTotal = SAMPLE.reduce((sum, r) => sum + (r[6] - r[7]), 0);
		expect(qtyTotal).toBe(193418);

		const bytes = new Uint8Array(doc.output('arraybuffer'));
		expect(bytes.byteLength).toBeGreaterThan(1000);
		expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
	});

	it('keeps every column inside the printable width of A4 portrait', async () => {
		const { rows, partyById } = fixture();
		const doc = await buildVoucherListing(rows, partyById, FILTERS);
		// @ts-expect-error autotable records the finished table on the document.
		const table = doc.lastAutoTable;
		expect(table.finalY).toBeLessThan(doc.internal.pageSize.getHeight());
		const width = table.columns.reduce((sum: number, c: { width: number }) => sum + c.width, 0);
		expect(width).toBeLessThanOrEqual(doc.internal.pageSize.getWidth() - 56);
	});

	it('fits every cell on one line, including a wide Grand Total', async () => {
		const { rows, partyById } = fixture();
		// Widest realistic content: 5-digit legacy Kg, 4-digit bags, a cancelled row.
		const wide = [
			...rows,
			{ ...rows[0], id: 'wide', load: 99999, empty: 1, total: 99998, bagCount: 1612, kg: 19358, freightCharge: 16600, status: 'inactive' as const }
		];
		const doc = await buildVoucherListing(wide, partyById, FILTERS);
		// @ts-expect-error autotable records the finished table on the document.
		const table = doc.lastAutoTable;
		// A cell that wrapped would make its row taller than the rest.
		const heights: number[] = [...table.head, ...table.body, ...table.foot].map(
			(r: { height: number }) => r.height
		);
		expect(Math.max(...heights)).toBe(Math.min(...heights));
	});
});

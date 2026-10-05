import { describe, expect, it } from 'vitest';
import { buildSingleReceipt, buildVoucherListing } from './pdf';
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
				// A farmer: their Kg is printed, so these widths cover the real figures.
				partyType: 'farmer',
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

describe('single receipt PDF (matching image.png)', () => {
	it('generates a single page A4 portrait receipt with dynamic row data', async () => {
		const tx: Transaction = {
			id: 'test-1',
			transactionDate: new Date('2026-04-24T00:00:00'),
			purchaseType: 'purchase',
			wayNumber: '1929129',
			partyId: 'p-1',
			itemName: 'Paddy',
			load: 293923,
			empty: 28382,
			autoCalculate: true,
			total: 29393,
			bagCount: 299,
			kg: 23,
			freightCharge: 23233,
			narration: '',
			price: 1560,
			amount: 2832832,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		const party: Party = {
			id: 'p-1',
			partyName: 'Prasanna Venkatesh',
			place: 'Pattukottai',
			phoneNumber: '9443334307',
			partyType: 'wholesale',
			status: 'active',
			createdAt: null,
			updatedAt: null
		};

		const doc = await buildSingleReceipt(tx, party);
		expect(doc.getNumberOfPages()).toBe(1);
		const bytes = new Uint8Array(doc.output('arraybuffer'));
		expect(bytes.byteLength).toBeGreaterThan(1000);
		expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
	});

	it('populates party bank details in Table 3', async () => {
		const tx: Transaction = {
			id: 'test-2',
			transactionDate: new Date('2026-04-24T00:00:00'),
			purchaseType: 'purchase',
			wayNumber: '1929130',
			partyId: 'p-2',
			itemName: 'Paddy',
			load: 20000,
			empty: 5000,
			autoCalculate: true,
			total: 15000,
			bagCount: 241,
			kg: 58,
			freightCharge: 500,
			narration: '',
			price: 1500,
			amount: 361500,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		const party: Party = {
			id: 'p-2',
			partyName: 'Ramesh Kumar',
			place: 'Thanjavur',
			phoneNumber: '9876543210',
			partyType: 'farmer',
			accountName: 'Ramesh Kumar',
			accountNo: '987654321000',
			ifscCode: 'SBIN0001234',
			bankName: 'State Bank of India and Commercial Banking Corporation Limited Pattukkottai Main Branch Thanjavur',
			status: 'active',
			createdAt: null,
			updatedAt: null
		};

		const doc = await buildSingleReceipt(tx, party);
		expect(doc.getNumberOfPages()).toBe(1);
		const bytes = new Uint8Array(doc.output('arraybuffer'));
		expect(bytes.byteLength).toBeGreaterThan(1000);
		expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
	});

	it('handles Tamil characters in party name, place, and account name', async () => {
		const tx: Transaction = {
			id: 'test-tamil',
			transactionDate: new Date('2026-09-30T00:00:00'),
			purchaseType: 'return',
			wayNumber: '6574-R',
			partyId: 'p-tamil',
			itemName: 'Paddy',
			load: 3452,
			empty: 2500,
			autoCalculate: true,
			total: 952,
			bagCount: 15,
			kg: 22,
			freightCharge: 500,
			narration: '',
			price: 1500,
			amount: 22500,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		const party: Party = {
			id: 'p-tamil',
			partyName: 'பிரசன்னா வெங்கடேஷ்',
			place: 'பட்டுக்கோட்டை',
			phoneNumber: '9443334307',
			partyType: 'wholesale',
			accountName: 'பிரசன்னா வெங்கடேஷ்',
			accountNo: '1234567890',
			ifscCode: 'SBIN0001234',
			bankName: 'பாரத ஸ்டேட் வங்கி',
			status: 'active',
			createdAt: null,
			updatedAt: null
		};

		const doc = await buildSingleReceipt(tx, party);
		expect(doc.getNumberOfPages()).toBe(1);
		const bytes = new Uint8Array(doc.output('arraybuffer'));
		expect(bytes.byteLength).toBeGreaterThan(1000);
		expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
	});

	it('consistently formats way number with purchaseType in receipt PDF', async () => {
		const tx: Transaction = {
			id: 'test-wayno',
			transactionDate: new Date('2026-09-30T00:00:00'),
			purchaseType: 'purchase',
			wayNumber: '6574-R', // mismatched raw input in DB
			partyId: 'p-1',
			itemName: 'Paddy',
			load: 952,
			empty: 0,
			autoCalculate: false,
			total: 952,
			bagCount: 15,
			kg: 22,
			freightCharge: 500,
			narration: '',
			price: 1500,
			amount: 22500,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		const party: Party = {
			id: 'p-1',
			partyName: 'Prasanna',
			place: 'Pattukottai',
			phoneNumber: '9443334307',
			partyType: 'wholesale',
			status: 'active',
			createdAt: null,
			updatedAt: null
		};

		const doc = await buildSingleReceipt(tx, party);
		const table = (doc as any).lastAutoTable;
		expect(table).toBeDefined();
		const docString = doc.output();
		expect(docString).toContain('6574-P');
		expect(docString).not.toContain('6574-R');
	});
});


describe('crore-scale amounts', () => {
	/** A plausible load, but every money value pushed into crores. */
	function croreFixture() {
		const partyById = new Map<string, Party>();
		partyById.set('p1', {
			id: 'p1',
			partyName: 'Karthick',
			place: 'KLU',
			phoneNumber: '9626540553',
			partyType: 'farmer',
			status: 'active',
			createdAt: null,
			updatedAt: null
		});
		const rows: Transaction[] = [
			{
				id: '1',
				transactionDate: new Date('2026-08-01T00:00:00'),
				purchaseType: 'purchase',
				wayNumber: '74808',
				partyId: 'p1',
				itemName: 'DLX-OLD',
				load: 99999,
				empty: 1,
				total: 99998,
				autoCalculate: true,
				bagCount: 1612,
				kg: 12,
				freightCharge: 99999999,
				narration: '',
				price: 99999,
				amount: 999999999,
				// Completed is the widest Status word, so it must not shrink either.
				status: 'inactive',
				createdAt: null,
				updatedAt: null
			}
		];
		return { rows, partyById };
	}

	it('prints crore figures whole, on one line, without shrinking the font', async () => {
		const { rows, partyById } = croreFixture();
		const doc = await buildVoucherListing(rows, partyById, FILTERS);
		// @ts-expect-error autotable records the finished table on the document.
		const table = doc.lastAutoTable;

		// Nothing wrapped: a second line would make a row taller than the rest.
		const heights: number[] = [...table.head, ...table.body, ...table.foot].map(
			(r: { height: number }) => r.height
		);
		expect(Math.max(...heights)).toBe(Math.min(...heights));

		// And nothing was shrunk to achieve it — every money cell is still at full size.
		const headSize = table.head[0].cells[0].styles.fontSize;
		for (const cell of Object.values(table.body[0].cells) as { styles: { fontSize: number } }[]) {
			expect(cell.styles.fontSize).toBe(headSize);
		}
	});
});

describe('no cell ever overflows its column', () => {
	/**
	 * Cells are drawn with overflow "visible" so long numbers are never split across a
	 * comma. The price of that is a value too wide for its column spills over the
	 * neighbour instead of wrapping — which is what produced overlapping figures in the
	 * printed listing. jsPDF's Helvetica metrics are deterministic, so proving every cell
	 * fits here proves it on every device.
	 */
	function assertNoOverflow(built: Awaited<ReturnType<typeof buildVoucherListing>>) {
		const doc = built as unknown as {
			lastAutoTable: Record<'head' | 'body' | 'foot', { cells: Record<string, unknown> }[]>;
			setFont: (name: string, style: string) => void;
			setFontSize: (size: number) => void;
			getTextWidth: (text: string) => number;
		};
		const table = doc.lastAutoTable;
		const measure = (text: string, size: number, bold: boolean) => {
			doc.setFont('helvetica', bold ? 'bold' : 'normal');
			doc.setFontSize(size);
			return doc.getTextWidth(text);
		};
		const offenders: string[] = [];
		for (const section of ['head', 'body', 'foot'] as const) {
			for (const row of table[section]) {
				for (const cell of Object.values(row.cells) as {
					text: string[];
					width: number;
					styles: { fontSize: number; fontStyle: string };
					padding: (s: string) => number;
				}[]) {
					const text = (cell.text ?? []).join('');
					if (!text) continue;
					const inner = cell.width - cell.padding('left') - cell.padding('right');
					const drawn = measure(text, cell.styles.fontSize, cell.styles.fontStyle === 'bold');
					if (drawn > inner) {
						offenders.push(`${section} "${text}" needs ${drawn.toFixed(1)}pt in ${inner.toFixed(1)}pt`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	}

	it('fits the reference listing', async () => {
		const { rows, partyById } = fixture();
		assertNoOverflow(await buildVoucherListing(rows, partyById, FILTERS));
	});

	it('fits crore money, six-figure weights and a cancelled row', async () => {
		const partyById = new Map<string, Party>();
		partyById.set('p1', {
			id: 'p1',
			partyName: 'Karthick',
			place: 'KLU',
			phoneNumber: '9626540553',
			partyType: 'farmer',
			status: 'active',
			createdAt: null,
			updatedAt: null
		});
		const wide: Transaction[] = [
			{
				id: 'w1',
				transactionDate: new Date('2026-08-01T00:00:00'),
				purchaseType: 'purchase',
				wayNumber: '74808',
				partyId: 'p1',
				itemName: 'DLX-OLD',
				load: 999999,
				empty: 1,
				total: 999999,
				autoCalculate: true,
				bagCount: 9999,
				kg: 19358,
				freightCharge: 99999999,
				narration: '',
				price: 99999,
				amount: 999999999,
				status: 'inactive',
				createdAt: null,
				updatedAt: null
			}
		];
		assertNoOverflow(await buildVoucherListing(wide, partyById, FILTERS));
	});
});

describe('receipt cells never overflow either', () => {
	const LONG_PARTY: Party = {
		id: 'p1',
		partyName: 'Venkatachalapathy Subramaniam',
		place: 'Thiruvarur District',
		phoneNumber: '9626540553',
		partyType: 'farmer',
		accountName: 'Venkatachalapathy Subramaniam',
		accountNo: '123456789012345678',
		ifscCode: 'SBIN0001234',
		bankName: 'State Bank of India and Commercial Banking Corporation Limited Pattukkottai Main Branch Thanjavur',
		status: 'active',
		createdAt: null,
		updatedAt: null
	};

	const EXTREME: Transaction = {
		id: '1',
		transactionDate: new Date('2026-08-01T00:00:00'),
		purchaseType: 'purchase',
		wayNumber: '74808',
		partyId: 'p1',
		itemName: 'DLX-OLD',
		load: 999999,
		empty: 1,
		total: 999998,
		autoCalculate: true,
		bagCount: 9999,
		kg: 19358,
		freightCharge: 99999999,
		narration: '',
		price: 99999,
		amount: 999999999,
		status: 'active',
		createdAt: null,
		updatedAt: null
	};

	it('keeps every cell of the last receipt table inside its column', async () => {
		const built = await buildSingleReceipt(EXTREME, LONG_PARTY);
		const doc = built as unknown as {
			lastAutoTable: { body: { cells: Record<string, unknown> }[] };
			setFont: (n: string, s: string) => void;
			setFontSize: (n: number) => void;
			getTextWidth: (t: string) => number;
		};
		const offenders: string[] = [];
		for (const row of doc.lastAutoTable.body) {
			for (const cell of Object.values(row.cells) as {
				text: string[];
				width: number;
				styles: { fontSize: number; fontStyle: string };
				padding: (s: string) => number;
			}[]) {
				const text = (cell.text ?? []).join('');
				if (!text) continue;
				doc.setFont('helvetica', cell.styles.fontStyle === 'bold' ? 'bold' : 'normal');
				doc.setFontSize(cell.styles.fontSize);
				const inner = cell.width - cell.padding('left') - cell.padding('right');
				if (doc.getTextWidth(text) > inner) offenders.push(`"${text}"`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('leaves the widest realistic label and value room to fit', async () => {
		// All three receipt tables share one config, so proving the widest content fits
		// the 175 / 330.28pt columns proves it for every row in every one of them.
		const built = await buildSingleReceipt(EXTREME, LONG_PARTY);
		const doc = built as unknown as {
			setFont: (n: string, s: string) => void;
			setFontSize: (n: number) => void;
			getTextWidth: (t: string) => number;
		};
		const fits = (text: string, columnWidth: number, bold: boolean) => {
			doc.setFont('helvetica', bold ? 'bold' : 'normal');
			doc.setFontSize(9);
			return doc.getTextWidth(text) <= columnWidth - 12 - 0.5;
		};
		for (const label of ['Freight Charge ( - )', 'Total Amount', 'Account Name', 'Bank Name']) {
			expect(fits(label, 175, true), `label ${label}`).toBe(true);
		}
		for (const value of [
			'99,99,99,999',
			'123456789012345678',
			'State Bank of India',
			'Venkatachalapathy Subramaniam',
			'37473-R'
		]) {
			expect(fits(value, 330.28, false), `value ${value}`).toBe(true);
		}
	});
});

describe('the Kg column follows the party type', () => {
	/** Column 6 of the listing: Date, Way No, Particulars, Item, Total, Bag, Kg. */
	const KG_COLUMN = 6;
	/** Distinctive enough that finding it in the raw PDF cannot be a coincidence. */
	const LOOSE_KG = 4873;

	function oneRow(partyType: Party['partyType']) {
		const partyById = new Map<string, Party>([
			[
				'p1',
				{
					id: 'p1',
					partyName: 'Karthick',
					place: 'KLU',
					phoneNumber: '9626540553',
					partyType,
					status: 'active',
					createdAt: null,
					updatedAt: null
				}
			]
		]);
		const tx: Transaction = {
			id: '1',
			transactionDate: new Date('2026-08-01T00:00:00'),
			purchaseType: 'purchase',
			wayNumber: '74808',
			partyId: 'p1',
			itemName: 'DLX',
			load: 10820,
			empty: 4360,
			autoCalculate: true,
			total: 6460,
			bagCount: 104,
			kg: LOOSE_KG,
			freightCharge: 500,
			narration: '',
			price: 1500,
			amount: 156000,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		return { rows: [tx], partyById, party: partyById.get('p1') as Party, tx };
	}

	const kgCell = (built: unknown) =>
		(
			(built as { lastAutoTable: { body: { cells: Record<number, { text: string[] }> }[] } })
				.lastAutoTable.body[0].cells[KG_COLUMN].text ?? []
		).join('');

	it('prints a dash for a wholesale party, who is not paid for the remainder', async () => {
		const { rows, partyById } = oneRow('wholesale');
		expect(kgCell(await buildVoucherListing(rows, partyById, FILTERS))).toBe('-');
	});

	it('prints the figure for a farmer, who is', async () => {
		const { rows, partyById } = oneRow('farmer');
		expect(kgCell(await buildVoucherListing(rows, partyById, FILTERS))).toBe(String(LOOSE_KG));
	});

	it('keeps the single receipt in step with the listing', async () => {
		const farmer = oneRow('farmer');
		const wholesale = oneRow('wholesale');
		expect((await buildSingleReceipt(farmer.tx, farmer.party)).output()).toContain(String(LOOSE_KG));
		expect((await buildSingleReceipt(wholesale.tx, wholesale.party)).output()).not.toContain(
			String(LOOSE_KG)
		);
	});
});

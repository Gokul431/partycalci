import type { Party, Transaction, TransactionFilters } from "$lib/types";

import { calculateTotalAmount } from "./calculations";

import { parseISODate } from "./dates";

import { formatWayNumber } from "./format";

import {
  canShape,
  loadShapingFont,
  measureTextWidth,
  needsShaping,
  shapeText,
  type ShapedText,
} from "./pdfShaping";

/** Printed on the report header — change these to rebrand the voucher listing. */

export const MILL_NAME = "Elumalayan Modern Rice Mill";

const REPORT_TITLE = "List of Mat. Rcvd. from Party Vouchers";

const VOUCHER_SERIES = "Main";

const PAGE_MARGIN = 28;

const HEADER_HEIGHT = 58;

const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Qty and money: whole rupees with Indian grouping — 5,008 rather than 5,008.00. */

const money = (n: number) => grouped.format(n);

/** Load, Empty, Bag and Kg print as bare integers with no grouping. */

const count = (n: number) => String(Math.round(n));

/** Header range is loose d-m-yyyy; the rows themselves stay zero-padded. */

const looseDate = (d: Date) =>
  `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

const paddedDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

const FONT_SIZE = 8;

const CELL_PADDING = 3;

/**

 * Widths sum to 530, fitting comfortably within A4 portrait's 539.28pt printable

 * width (595.28pt page minus 2×28pt margins). The 9pt buffer prevents any

 * browser-engine or jsPDF floating-point rounding from triggering autoTable's

 * column-scaling fallback. Each column clears its widest header or body value at

 * FONT_SIZE — verified against Helvetica metrics.

 */

const COLUMNS = [
  { header: "Date", width: 48, align: "left" },
  { header: "Way No:", width: 42, align: "left" },
  { header: "Particulars", width: 74, align: "left" },
  { header: "Item", width: 44, align: "left" },
  { header: "Total", width: 36, align: "right" },
  { header: "Bag", width: 28, align: "right" },
  { header: "Kg", width: 30, align: "right" },
  // Money columns are sized so Indian-grouped crore figures print whole at FONT_SIZE:
  // 9,99,99,999 measures 48pt, 99,99,99,999 measures 53pt, and the grand total under
  // Total can run a digit longer again.
  { header: "Freight", width: 50, align: "right" },
  { header: "Price", width: 31, align: "right" },
  { header: "Amount", width: 53, align: "right" },
  { header: "Total", width: 59, align: "right" },
  { header: "Status", width: 44, align: "left" },
] as const;

/** Index of the Particulars column, the only one whose text is shaped into an image. */

const PARTICULARS_INDEX = 2;

/** Index of the Total Amount column, which the grand total sits under (index 11). */

const TOTAL_AMOUNT_INDEX = 10;

/** Total table width, held well within A4 printable to avoid browser-engine rounding issues. */

const TABLE_WIDTH = COLUMNS.reduce((s: number, c) => s + c.width, 0);

/**

 * Pre-renders every body cell holding Tamil (or other complex-script) text, keyed

 * "row:column". Empty outside a browser, where cells fall back to plain text.

 */

/** Shaped party names print bold, to match the weight of the Latin names in the same column. */
const SHAPED_BOLD = true;

/** Body size of the single-receipt tables; shaped cells must match it or they look off. */
const RECEIPT_FONT_SIZE = 9;

/** Label / value column widths of the receipt tables, inside the 45pt page margins. */
const RECEIPT_COL_WIDTHS = [175, 330.28];

/**
 * Keeps a receipt value on one line without letting it run past its cell. Re-joining the
 * wrapped lines alone would stop a number splitting at a comma but leave an over-long
 * value overlapping whatever sits beside it, so the font is then shrunk until it fits.
 */
function fitReceiptCell(
  doc: unknown,
  data: {
    cell: {
      text: string[];
      styles: { fontSize: number; fontStyle: string };
      padding: (side: "left" | "right") => number;
    };
    column: { index: number };
  },
): void {
  if (Array.isArray(data.cell.text) && data.cell.text.length > 1) {
    data.cell.text = [data.cell.text.join("")];
  }
  const text = data.cell.text?.[0] ? String(data.cell.text[0]) : "";
  if (!text) return;
  const width = RECEIPT_COL_WIDTHS[data.column.index] ?? RECEIPT_COL_WIDTHS[1];
  const inner =
    width - data.cell.padding("left") - data.cell.padding("right") - 0.5;
  data.cell.styles.fontSize = fitSingleLineFontSize(
    doc,
    text,
    inner,
    data.cell.styles.fontStyle === "bold" ? "bold" : "normal",
    RECEIPT_FONT_SIZE,
  );
}

const MIN_CELL_FONT_SIZE = 4.5;
const FONT_SIZE_STEP = 0.25;

/** Returns the largest font size that keeps a normal PDF cell on one line. */
function fitSingleLineFontSize(
  doc: any,
  text: string,
  availableWidth: number,
  fontStyle: "normal" | "bold" = "normal",
  startSize = FONT_SIZE,
): number {
  if (!text) return startSize;
  let size = startSize;
  doc.setFont("helvetica", fontStyle);
  while (size > MIN_CELL_FONT_SIZE) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= availableWidth) return size;
    size -= FONT_SIZE_STEP;
  }
  return MIN_CELL_FONT_SIZE;
}

/** Pre-renders complex-script cells as single-line images. */
async function shapeCells(body: string[][]): Promise<Map<string, ShapedText>> {
  const shaped = new Map<string, ShapedText>();
  if (!canShape() || !body.some((row) => row.some(needsShaping))) return shaped;
  try {
    await loadShapingFont();
  } catch (e) {
    console.warn("Tamil PDF font failed to load; using a system font.", e);
  }
  const byText = new Map<string, ShapedText>();
  body.forEach((row, r) =>
    row.forEach((text, c) => {
      if (!needsShaping(text)) return;
      const key = `${c}\u0000${text}`;
      let s = byText.get(key);
      if (!s) {
        const availableWidth = COLUMNS[c].width - CELL_PADDING * 2;
        // Prefer wrapping over shrinking. Shrinking until a whole name fits on one line
        // drove long Tamil names down to the 4.5pt floor, half the size of the Latin text
        // beside them — and shapeText wrapped them anyway. Only shrink when a single word
        // is too wide, since that is the one case wrapping cannot solve.
        const longestWord = text
          .trim()
          .split(/\s+/)
          .reduce((a, b) => (b.length > a.length ? b : a), "");
        let fontSize = FONT_SIZE;
        while (
          fontSize > MIN_CELL_FONT_SIZE &&
          measureTextWidth(longestWord, fontSize, SHAPED_BOLD) > availableWidth
        ) {
          fontSize -= FONT_SIZE_STEP;
        }
        s = shapeText(text, fontSize, availableWidth, SHAPED_BOLD);
        byText.set(key, s);
      }
      shaped.set(`${r}:${c}`, s);
    }),
  );
  return shaped;
}

function rangeLabel(rows: Transaction[], filters: TransactionFilters): string {
  const dates = rows.map((r) => r.transactionDate.getTime());

  const from =
    parseISODate(filters.dateFrom) ??
    (dates.length ? new Date(Math.min(...dates)) : null);

  const to =
    parseISODate(filters.dateTo) ??
    (dates.length ? new Date(Math.max(...dates)) : null);

  if (!from || !to) return "";

  return `From ${looseDate(from)} to ${looseDate(to)}`;
}

function bodyRow(t: Transaction, party: Party | undefined): string[] {
  return [
    paddedDate(t.transactionDate),
    formatWayNumber(t.wayNumber, t.purchaseType),
    [party?.partyName, party?.place].filter(Boolean).join(" "),
    t.itemName,
    money(t.total),
    count(t.bagCount),
    count(t.kg),
    money(t.freightCharge),

    t.price ? money(t.price) : "",
    money(t.amount),
    money(calculateTotalAmount(t.amount, t.freightCharge)),
    t.status === "inactive" ? "Cancelled" : "",
  ];
}

export function voucherFileName(filters: TransactionFilters): string {
  const from = filters.dateFrom ? `-${filters.dateFrom}` : "";

  const to = filters.dateTo ? `-to-${filters.dateTo}` : "";

  return `mat-rcvd-from-party${from}${to}.pdf`;
}

/**

 * Builds the voucher listing.

 * Rows arrive newest-first from Firestore; the printed listing reads oldest-first.

 */

export async function buildVoucherListing(
  rows: Transaction[],

  partyById: Map<string, Party>,

  filters: TransactionFilters,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),

    import("jspdf-autotable"),
  ]);

  const ordered = [...rows].reverse();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();

  const range = rangeLabel(ordered, filters);

  const body = ordered.map((t) => bodyRow(t, partyById.get(t.partyId)));

  const shaped = await shapeCells(body);

  const shapedCell = (section: string, row: number, col: number) =>
    section === "body" ? shaped.get(`${row}:${col}`) : undefined;

  const grandTotal = ordered.reduce(
    (sum, t) => sum + calculateTotalAmount(t.amount, t.freightCharge),

    0,
  );

  autoTable(doc, {
    head: [COLUMNS.map((c) => c.header)],

    body,

    foot: [
      [
        {
          content: "Grand Total",
          colSpan: TOTAL_AMOUNT_INDEX,
          styles: { halign: "right" },
        },

        { content: money(grandTotal), styles: { halign: "right" } },

        "",
      ],
    ],

    theme: "grid", // A shaped (image) cell cannot be split, so rows move to the next page whole.

    rowPageBreak: "avoid",

    startY: PAGE_MARGIN + HEADER_HEIGHT,

    margin: {
      top: PAGE_MARGIN + HEADER_HEIGHT,
      right: PAGE_MARGIN,
      bottom: PAGE_MARGIN,
      left: PAGE_MARGIN,
    },

    tableWidth: TABLE_WIDTH,

    styles: {
      font: "helvetica",

      fontSize: FONT_SIZE,

      cellPadding: CELL_PADDING,

      lineColor: 0,

      lineWidth: 0.5,

      textColor: 0, // Centre short cells against a row made tall by a wrapped party name.

      valign: "middle",
    },

    headStyles: {
      fillColor: false,
      fontStyle: "bold",
      textColor: 0,
      valign: "middle",
    },

    footStyles: {
      fillColor: false,
      fontStyle: "bold",
      textColor: 0,
      valign: "middle",
    },

    columnStyles: Object.fromEntries(
      COLUMNS.map((c, i) => [
        i,

        {
          cellWidth: c.width,

          halign: c.align,

          fontStyle: i === 0 ? "bold" : undefined, // A shaped name is drawn as an image anchored to the cell's top padding.

          ...(i === PARTICULARS_INDEX ? { valign: "top" as const } : {}),
        },
      ]),
    ),

    didParseCell(data) {
      const s = shapedCell(data.section, data.row.index, data.column.index);

      if (s) {
        data.cell.text = [""];
        data.cell.styles.minCellHeight = s.height + CELL_PADDING * 2;
        return;
      }

      if (Array.isArray(data.cell.text) && data.cell.text.length > 1) {
        data.cell.text = [data.cell.text.join("")];
      }

      // Enforce single-line text across all devices and prevent word/comma splitting
      data.cell.styles.overflow = "visible";

      const text = data.cell.text?.[0] ? String(data.cell.text[0]) : "";
      if (!text) return;

      const column = COLUMNS[data.column.index];
      if (!column) return;

      const isBold =
        data.cell.styles.fontStyle === "bold" ||
        (data.section === "body" && data.column.index === 0);
      // Measure against the width the cell actually occupies. The footer's "Grand Total"
      // label spans most of the table, so sizing it against column 0 alone shrank it far
      // more than needed.
      const span = data.cell.colSpan ?? 1;
      let spannedWidth = 0;
      for (let i = 0; i < span; i++) {
        spannedWidth += COLUMNS[data.column.index + i]?.width ?? 0;
      }
      const availableWidth = spannedWidth - CELL_PADDING * 2 - 0.5;
      data.cell.styles.fontSize = fitSingleLineFontSize(
        doc,
        text,
        availableWidth,
        isBold ? "bold" : "normal",
      );
    },

    didDrawCell(data) {
      const s = shapedCell(data.section, data.row.index, data.column.index);

      if (!s) return;

      const x = data.cell.x + data.cell.padding("left");

      const y = data.cell.y + data.cell.padding("top");

      doc.addImage(s.image, "PNG", x, y, s.width, s.height, s.alias, "FAST");
    },

    didDrawPage() {
      doc.setLineWidth(0.5);

      doc.rect(PAGE_MARGIN, PAGE_MARGIN, TABLE_WIDTH, HEADER_HEIGHT);

      doc.setFont("helvetica", "bold");

      doc.setFontSize(16);

      doc.text(MILL_NAME, pageWidth / 2, PAGE_MARGIN + 20, { align: "center" });

      doc.setFontSize(9);

      doc.text(REPORT_TITLE, pageWidth / 2, PAGE_MARGIN + 33, {
        align: "center",
      }); // Back to normal before the next page's table is drawn.

      doc.setFont("helvetica", "normal");

      doc.text(
        `Voucher Series : ${VOUCHER_SERIES}`,
        PAGE_MARGIN + 6,
        PAGE_MARGIN + 50,
      );

      if (range) {
        doc.text(range, PAGE_MARGIN + TABLE_WIDTH - 6, PAGE_MARGIN + 50, {
          align: "right",
        });
      }
    },
  });

  return doc;
}

/** Builds the listing and hands it to the browser as a download. */

export async function downloadVoucherListing(
  rows: Transaction[],

  partyById: Map<string, Party>,

  filters: TransactionFilters,
): Promise<void> {
  const doc = await buildVoucherListing(rows, partyById, filters);

  doc.save(voucherFileName(filters));
}

/** Pre-renders complex-script cells as single-line images for single receipt tables. */
async function shapeReceiptCells(
  body: string[][],
  colWidths: number[] = [175, 330.28],
): Promise<Map<string, ShapedText>> {
  const shaped = new Map<string, ShapedText>();
  if (!canShape() || !body.some((row) => row.some(needsShaping))) return shaped;

  try {
    await loadShapingFont();
  } catch (e) {
    console.warn("Tamil PDF font failed to load for receipt", e);
  }

  const byText = new Map<string, ShapedText>();
  body.forEach((row, r) => {
    row.forEach((text, c) => {
      if (!text || !needsShaping(text)) return;
      const key = `${c}\u0000${text}`;
      let s = byText.get(key);
      if (!s) {
        const availableWidth = (colWidths[c] ?? 330.28) - 12;
        // Same weight compensation as the listing: Noto Sans Tamil has lighter stems than
        // Helvetica, so without this a shaped name reads washed out beside Latin text.
        s = shapeText(text, RECEIPT_FONT_SIZE, availableWidth, SHAPED_BOLD);
        byText.set(key, s);
      }
      shaped.set(`${r}:${c}`, s);
    });
  });

  return shaped;
}

/** PDF receipt for a single Receive From Party record, matching the reference template image.png. */

export async function buildSingleReceipt(
  transaction: Transaction,
  party: Party | undefined,
): Promise<any> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),

    import("jspdf-autotable"),
  ]);

  if (!party && transaction.partyId) {
    try {
      const { getParty } = await import("$lib/firebase/firestore");

      party = (await getParty(transaction.partyId)) ?? undefined;
    } catch {
      // ignore
    }
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  /* ---------- Centered Header ---------- */

  let y = 60;

  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");

  doc.setFontSize(14);

  doc.text("Elumalayayan Modern Rice Mill", pageWidth / 2, y, {
    align: "center",
  });

  y += 16;

  doc.setFont("helvetica", "normal");

  doc.setFontSize(9.5);

  doc.text(
    "321/1 - Palathali Road, Kalagupulikadu, Alvilam Post",
    pageWidth / 2,
    y,
    { align: "center" },
  );

  y += 13;

  doc.text("Pattukkottai - 614602", pageWidth / 2, y, { align: "center" });

  y += 20;

  doc.text("Mat. Rcvd from party", pageWidth / 2, y, { align: "center" });

  y += 18;

  /* ---------- Common Table Styles ---------- */

  const tableConfig = {
    theme: "grid" as const,

    styles: {
      font: "helvetica" as const,

      fontSize: RECEIPT_FONT_SIZE,

      textColor: 0,

      lineColor: 0,

      lineWidth: 0.5,

      fillColor: false as const,

      cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },

      valign: "middle" as const,
    },

    headStyles: { fillColor: false as const },

    alternateRowStyles: { fillColor: false as const },

    columnStyles: {
      0: {
        cellWidth: 175,
        halign: "left" as const,
        fontStyle: "bold" as const,
      },

      1: { halign: "left" as const },
    },

    margin: { left: 45, right: 45 },
  };

  /* ---------- Table Bodies ---------- */

  const d =
    transaction.transactionDate instanceof Date
      ? transaction.transactionDate
      : new Date(transaction.transactionDate);

  const pad = (n: number) => String(n).padStart(2, "0");

  const dateFormatted = !isNaN(d.getTime())
    ? `${pad(d.getDate())} / ${pad(d.getMonth() + 1)}/ ${d.getFullYear()}`
    : "";

  const table1Body = [
    ["Date", dateFormatted],

    ["Way No", formatWayNumber(transaction.wayNumber, transaction.purchaseType)],

    ["Name", party?.partyName ?? ""],

    ["Place", party?.place ?? ""],

    ["Phone", party?.phoneNumber ?? ""],
  ];

  const loadStr = transaction.load != null ? String(transaction.load) : "";

  const emptyStr = transaction.empty != null ? String(transaction.empty) : "";

  const totalStr = transaction.total != null ? String(transaction.total) : "";

  const bagStr =
    transaction.bagCount != null ? String(transaction.bagCount) : "";

  const kgStr = transaction.kg != null ? String(transaction.kg) : "";

  const priceStr =
    transaction.price != null && transaction.price !== 0
      ? String(transaction.price)
      : "";

  const amountStr =
    transaction.amount != null && transaction.amount !== 0
      ? String(transaction.amount)
      : "";

  const freightStr =
    transaction.freightCharge != null ? String(transaction.freightCharge) : "";

  const totalAmount = calculateTotalAmount(
    transaction.amount,
    transaction.freightCharge,
  );

  const totalAmountStr =
    totalAmount != null && totalAmount !== 0 ? String(totalAmount) : "";

  const table2Body = [
    ["Load", loadStr],

    ["Empty", emptyStr],

    ["Total", totalStr],

    ["Bag", bagStr],

    ["Kgs", kgStr],

    ["Price", priceStr],

    ["Item Amount", amountStr],

    ["Freight Charge ( - )", freightStr],

    ["Total Amount", totalAmountStr],
  ];

  const table3Body = [
    ["Account Name", party?.accountName || party?.partyName || ""],

    ["Account NO:", party?.accountNo || ""],

    ["IFSC code", party?.ifscCode || ""],

    ["Bank Name", party?.bankName || ""],
  ];

  /* ---------- Complex Script Shaping for Receipt Tables ---------- */

  const [table1Shaped, table2Shaped, table3Shaped] = await Promise.all([
    shapeReceiptCells(table1Body),
    shapeReceiptCells(table2Body),
    shapeReceiptCells(table3Body),
  ]);

  /* ---------- Table 1: Date, Way No, Name, Place, Phone ---------- */

  autoTable(doc, {
    ...tableConfig,

    startY: y,

    body: table1Body,

    didParseCell(data) {
      const s = table1Shaped.get(`${data.row.index}:${data.column.index}`);
      if (s) {
        data.cell.text = [""];
        const neededHeight =
          s.height + data.cell.padding("top") + data.cell.padding("bottom");
        if (neededHeight > 19.35) {
          data.cell.styles.minCellHeight = neededHeight;
        }
      }

      fitReceiptCell(doc, data);
    },

    didDrawCell(data) {
      const s = table1Shaped.get(`${data.row.index}:${data.column.index}`);
      if (!s) return;

      const cellX = data.cell.x + data.cell.padding("left");
      const cellY = data.cell.y + data.cell.padding("top");

      doc.addImage(
        s.image,
        "PNG",
        cellX,
        cellY,
        s.width,
        s.height,
        s.alias,
        "FAST",
      );
    },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  /* ---------- Table 2: Load, Empty, Total, Bag, Kgs, Price, Item Amount, Freight Charge (-), Total Amount ---------- */

  autoTable(doc, {
    ...tableConfig,

    startY: y,

    body: table2Body,

    didParseCell(data) {
      const s = table2Shaped.get(`${data.row.index}:${data.column.index}`);
      if (s) {
        data.cell.text = [""];
        const neededHeight =
          s.height + data.cell.padding("top") + data.cell.padding("bottom");
        if (neededHeight > 19.35) {
          data.cell.styles.minCellHeight = neededHeight;
        }
      }

      // Every row, not a hardcoded list of indices: adding or reordering a row must not
      // silently drop a value back to wrapping mid-number.
      fitReceiptCell(doc, data);
    },

    didDrawCell(data) {
      const s = table2Shaped.get(`${data.row.index}:${data.column.index}`);
      if (!s) return;

      const cellX = data.cell.x + data.cell.padding("left");
      const cellY = data.cell.y + data.cell.padding("top");

      doc.addImage(
        s.image,
        "PNG",
        cellX,
        cellY,
        s.width,
        s.height,
        s.alias,
        "FAST",
      );
    },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  /* ---------- Table 3: Account Name, Account NO:, IFSC code, Bank Name ---------- */

  autoTable(doc, {
    ...tableConfig,

    startY: y,

    body: table3Body,

    didParseCell(data) {
      const s = table3Shaped.get(`${data.row.index}:${data.column.index}`);
      if (s) {
        data.cell.text = [""];
        const neededHeight =
          s.height + data.cell.padding("top") + data.cell.padding("bottom");
        if (neededHeight > 19.35) {
          data.cell.styles.minCellHeight = neededHeight;
        }
      }

      // Account numbers and IFSC codes must not wrap either.
      fitReceiptCell(doc, data);
    },

    didDrawCell(data) {
      const s = table3Shaped.get(`${data.row.index}:${data.column.index}`);
      if (!s) return;

      const cellX = data.cell.x + data.cell.padding("left");
      const cellY = data.cell.y + data.cell.padding("top");

      doc.addImage(
        s.image,
        "PNG",
        cellX,
        cellY,
        s.width,
        s.height,
        s.alias,
        "FAST",
      );
    },
  }); 

  y =
    (doc as any).lastAutoTable.finalY +
    30; /* ---------- Bottom: Verified By ---------- */

  doc.setFont("helvetica", "normal");

  doc.setFontSize(9.5);

  doc.text("Verified By", 45, y);

  return doc;
}

/** Download a single-receipt PDF for the given transaction and party. */

export async function downloadSingleReceipt(
  transaction: Transaction,

  party: Party | undefined,
): Promise<void> {
  const doc = await buildSingleReceipt(transaction, party);

  const wayNo = formatWayNumber(
    transaction.wayNumber,
    transaction.purchaseType,
  ).trim() || "receipt";

  doc.save(`Mat_Received_${wayNo}.pdf`);
}

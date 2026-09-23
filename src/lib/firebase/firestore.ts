import {
	addDoc,
	and,
	collection,
	doc,
	getAggregateFromServer,
	getCountFromServer,
	getDoc,
	getDocs,
	getFirestore,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	startAfter,
	sum,
	count,
	Timestamp,
	updateDoc,
	where,
	type DocumentData,
	type Query,
	type QueryConstraint,
	type QueryDocumentSnapshot,
	type QueryFilterConstraint,
	type SnapshotOptions
} from 'firebase/firestore';
import { app } from './config';
import type {
	Party,
	PartyInput,
	Status,
	Transaction,
	TransactionData,
	TransactionFilters,
	TransactionFormValues
} from '$lib/types';
import { validateParty, validateTransaction } from '$lib/utils/validation';
import { addDays, parseISODate, toISODate } from '$lib/utils/dates';
import { AppError } from '$lib/utils/errors';

export const db = getFirestore(app);

const SNAP_OPTS: SnapshotOptions = { serverTimestamps: 'estimate' };
/** Firestore limit for `in` filters. */
export const MAX_PARTY_MATCHES = 30;

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------- Parties

const partiesCol = collection(db, 'parties');

function toParty(snap: QueryDocumentSnapshot<DocumentData>): Party {
	const d = snap.data(SNAP_OPTS);
	return {
		id: snap.id,
		partyName: str(d.partyName),
		place: str(d.place),
		phoneNumber: str(d.phoneNumber),
		status: d.status === 'inactive' ? 'inactive' : 'active',
		createdAt: toDate(d.createdAt),
		updatedAt: toDate(d.updatedAt)
	};
}

/** Live list of all parties (master data), sorted by name. */
export function subscribeParties(onData: (parties: Party[]) => void, onError: (e: unknown) => void) {
	return onSnapshot(
		query(partiesCol, orderBy('partyName')),
		(snap) => onData(snap.docs.map(toParty)),
		onError
	);
}

export async function getParty(id: string): Promise<Party | null> {
	const snap = await getDoc(doc(partiesCol, id));
	return snap.exists() ? toParty(snap as QueryDocumentSnapshot<DocumentData>) : null;
}

function assertParty(input: PartyInput): PartyInput {
	const r = validateParty(input);
	if (!r.ok) throw new AppError(Object.values(r.errors)[0] ?? 'Invalid party details.');
	return r.data;
}

export async function createParty(input: PartyInput): Promise<string> {
	const data = assertParty(input);
	const ref = await addDoc(partiesCol, {
		...data,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp()
	});
	return ref.id;
}

export async function updateParty(id: string, input: PartyInput): Promise<void> {
	const data = assertParty(input);
	await updateDoc(doc(partiesCol, id), { ...data, updatedAt: serverTimestamp() });
}

export async function setPartyStatus(id: string, status: Status): Promise<void> {
	await updateDoc(doc(partiesCol, id), { status, updatedAt: serverTimestamp() });
}

/** Case-insensitive match on party name or phone number (digits compared loosely). */
export function matchPartyIds(parties: Party[], search: string): string[] {
	const q = search.trim().toLowerCase();
	// A phone-like query ("96265 40553", "+91-9626…") is compared on digits only.
	const phoneQuery = /^[0-9+\-\s]+$/.test(q) ? q.replace(/\D/g, '') : '';
	return parties
		.filter(
			(p) =>
				p.partyName.toLowerCase().includes(q) ||
				p.phoneNumber.toLowerCase().includes(q) ||
				(phoneQuery.length > 0 && p.phoneNumber.replace(/\D/g, '').includes(phoneQuery))
		)
		.map((p) => p.id);
}

// ----------------------------------------------------------- Transactions

const txCol = collection(db, 'received_from_party');

function toTransaction(snap: QueryDocumentSnapshot<DocumentData>): Transaction {
	const d = snap.data(SNAP_OPTS);
	return {
		id: snap.id,
		transactionDate: toDate(d.transactionDate) ?? new Date(0),
		purchaseType: d.purchaseType === 'return' ? 'return' : 'purchase',
		wayNumber: str(d.wayNumber),
		partyId: str(d.partyId),
		itemName: str(d.itemName),
		load: num(d.load),
		empty: num(d.empty),
		total: num(d.total),
		bagCount: num(d.bagCount),
		kg: num(d.kg),
		freightCharge: num(d.freightCharge),
		narration: str(d.narration),
		price: num(d.price),
		amount: num(d.amount),
		status: d.status === 'inactive' ? 'inactive' : 'active',
		createdAt: toDate(d.createdAt),
		updatedAt: toDate(d.updatedAt)
	};
}

/** Validates and recalculates Total/Kg from raw inputs before every write. */
function toWritable(values: TransactionFormValues) {
	const r = validateTransaction(values);
	if (!r.ok) throw new AppError(Object.values(r.errors)[0] ?? 'Invalid entry details.');
	const data: TransactionData = r.data;
	return { ...data, transactionDate: Timestamp.fromDate(data.transactionDate) };
}

async function assertPartySelectable(partyId: string, allowInactive: boolean) {
	const party = await getParty(partyId);
	if (!party) throw new AppError('The selected party no longer exists. Please choose another party.');
	if (party.status !== 'active' && !allowInactive)
		throw new AppError('The selected party is inactive. Please choose an active party.');
}

export async function createTransaction(values: TransactionFormValues): Promise<string> {
	const data = toWritable(values);
	await assertPartySelectable(data.partyId, false);
	const ref = await addDoc(txCol, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
	return ref.id;
}

export async function updateTransaction(
	id: string,
	values: TransactionFormValues,
	previousPartyId: string
): Promise<void> {
	const data = toWritable(values);
	// Keeping an existing (now inactive) party is allowed; switching to one is not.
	await assertPartySelectable(data.partyId, data.partyId === previousPartyId);
	await updateDoc(doc(txCol, id), { ...data, updatedAt: serverTimestamp() });
}

export async function setTransactionStatus(id: string, status: Status): Promise<void> {
	await updateDoc(doc(txCol, id), { status, updatedAt: serverTimestamp() });
}

export async function getTransaction(id: string): Promise<Transaction | null> {
	const snap = await getDoc(doc(txCol, id));
	return snap.exists() ? toTransaction(snap as QueryDocumentSnapshot<DocumentData>) : null;
}

/**
 * Filters resolved against the party master. `partyIds` is null when no party
 * search is applied, [] when the search matched nothing.
 */
export interface ResolvedFilters {
	dateFrom: string;
	dateTo: string;
	status: Status | '';
	partyIds: string[] | null;
}

export function resolveFilters(filters: TransactionFilters, parties: Party[]): ResolvedFilters {
	const search = filters.search.trim();
	return {
		dateFrom: filters.dateFrom,
		dateTo: filters.dateTo,
		status: filters.status,
		partyIds: search ? matchPartyIds(parties, search) : null
	};
}

function filterConstraints(f: ResolvedFilters, partyIds: string[] | null): QueryFilterConstraint[] {
	const c: QueryFilterConstraint[] = [];
	const from = f.dateFrom ? parseISODate(f.dateFrom) : null;
	const to = f.dateTo ? parseISODate(f.dateTo) : null;
	if (from) c.push(where('transactionDate', '>=', Timestamp.fromDate(from)));
	if (to) c.push(where('transactionDate', '<', Timestamp.fromDate(addDays(to, 1))));
	if (f.status) c.push(where('status', '==', f.status));
	if (partyIds) {
		c.push(partyIds.length === 1 ? where('partyId', '==', partyIds[0]) : where('partyId', 'in', partyIds));
	}
	return c;
}

function buildFilteredQuery(f: ResolvedFilters, partyIds: string[] | null): Query {
	const filters = filterConstraints(f, partyIds);
	return filters.length ? query(txCol, and(...filters)) : query(txCol);
}

function buildQuery(f: ResolvedFilters, partyIds: string[] | null, extra: QueryConstraint[] = []): Query {
	return query(buildFilteredQuery(f, partyIds), orderBy('transactionDate', 'desc'), ...extra);
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

export interface TransactionPage {
	rows: Transaction[];
	/** Cursor to pass as `after` to fetch the next page, or null when there is none. */
	nextCursor: QueryDocumentSnapshot<DocumentData> | null;
}

/** One page of transactions using query cursors (fetches pageSize + 1 to detect a next page). */
export async function listTransactions(
	f: ResolvedFilters,
	pageSize: number,
	after: QueryDocumentSnapshot<DocumentData> | null
): Promise<TransactionPage> {
	if (f.partyIds && f.partyIds.length === 0) return { rows: [], nextCursor: null };
	if (f.partyIds && f.partyIds.length > MAX_PARTY_MATCHES) {
		throw new AppError(
			`Your party search matches more than ${MAX_PARTY_MATCHES} parties. Please type more of the name or phone number.`
		);
	}
	const extra: QueryConstraint[] = [limit(pageSize + 1)];
	if (after) extra.unshift(startAfter(after));
	const snap = await getDocs(buildQuery(f, f.partyIds, extra));
	const docs = snap.docs.slice(0, pageSize);
	return {
		rows: docs.map(toTransaction),
		nextCursor: snap.docs.length > pageSize ? docs[docs.length - 1] : null
	};
}

/** Rows read per request when exporting; well under Firestore's per-query limits. */
const EXPORT_PAGE_SIZE = 500;

/** Every row matching the filters, newest first, for export. Capped so a broad filter cannot run away. */
export async function fetchAllTransactions(f: ResolvedFilters, cap = 5000): Promise<Transaction[]> {
	if (f.partyIds && f.partyIds.length === 0) return [];
	if (f.partyIds && f.partyIds.length > MAX_PARTY_MATCHES) {
		throw new AppError(
			`Your party search matches more than ${MAX_PARTY_MATCHES} parties. Please type more of the name or phone number.`
		);
	}
	const rows: Transaction[] = [];
	let after: QueryDocumentSnapshot<DocumentData> | null = null;
	while (rows.length < cap) {
		const extra: QueryConstraint[] = [limit(EXPORT_PAGE_SIZE)];
		if (after) extra.unshift(startAfter(after));
		const snap = await getDocs(buildQuery(f, f.partyIds, extra));
		rows.push(...snap.docs.map(toTransaction));
		if (snap.docs.length < EXPORT_PAGE_SIZE) break;
		after = snap.docs[snap.docs.length - 1];
	}
	return rows.slice(0, cap);
}

/** Party-id chunks for aggregation; [null] means "no party filter". */
function partyChunks(f: ResolvedFilters): (string[] | null)[] {
	if (!f.partyIds) return [null];
	return chunk(f.partyIds, MAX_PARTY_MATCHES);
}

export async function countTransactions(f: ResolvedFilters): Promise<number> {
	const counts = await Promise.all(
		partyChunks(f).map((ids) =>
			getCountFromServer(buildFilteredQuery(f, ids)).then((s) => s.data().count)
		)
	);
	return counts.reduce((a, b) => a + b, 0);
}

export interface ReportTotals {
	entries: number;
	load: number;
	empty: number;
	total: number;
	bagCount: number;
	kg: number;
	freightCharge: number;
	amount: number;
}

const EMPTY_TOTALS: ReportTotals = {
	entries: 0, load: 0, empty: 0, total: 0, bagCount: 0, kg: 0, freightCharge: 0, amount: 0
};

/** Server-side aggregation (Firestore allows 5 aggregations per request, so this uses two). */
export async function getReportTotals(f: ResolvedFilters): Promise<ReportTotals> {
	const results = await Promise.all(
		partyChunks(f).map(async (ids) => {
			if (ids && ids.length === 0) return EMPTY_TOTALS;
			// Unordered: sum() would otherwise need an index spanning the sort field and every summed field.
			const q = buildFilteredQuery(f, ids);
			const [a, b] = await Promise.all([
				getAggregateFromServer(q, {
					entries: count(),
					load: sum('load'),
					empty: sum('empty'),
					total: sum('total')
				}),
				getAggregateFromServer(q, {
					bagCount: sum('bagCount'),
					kg: sum('kg'),
					freightCharge: sum('freightCharge'),
					amount: sum('amount')
				})
			]);
			return { ...a.data(), ...b.data() } as ReportTotals;
		})
	);
	return results.reduce(
		(acc, r) => {
			for (const k of Object.keys(acc) as (keyof ReportTotals)[]) acc[k] += r[k] ?? 0;
			return acc;
		},
		{ ...EMPTY_TOTALS }
	);
}

// --------------------------------------------------------------- Dashboard

export async function getDashboardStats() {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const [totalParties, activeParties, totalEntries, todayEntries] = await Promise.all([
		getCountFromServer(partiesCol),
		getCountFromServer(query(partiesCol, where('status', '==', 'active'))),
		getCountFromServer(txCol),
		getCountFromServer(
			query(
				txCol,
				where('transactionDate', '>=', Timestamp.fromDate(start)),
				where('transactionDate', '<', Timestamp.fromDate(addDays(start, 1)))
			)
		)
	]);
	return {
		totalParties: totalParties.data().count,
		activeParties: activeParties.data().count,
		totalEntries: totalEntries.data().count,
		todayEntries: todayEntries.data().count
	};
}

export interface DayActivity {
	date: Date;
	entries: number;
	total: number;
	amount: number;
}

export interface PartyActivity {
	partyId: string;
	entries: number;
	total: number;
}

export interface WeeklyActivity {
	days: DayActivity[];
	topParties: PartyActivity[];
	entries: number;
	total: number;
	amount: number;
}

/** A week busier than this loses its oldest days from the charts, rather than reading unbounded. */
const WEEK_SCAN_LIMIT = 1000;

/** One windowed read, grouped in memory — cheaper than a sum() aggregation per day. */
export async function getWeeklyActivity(dayCount = 7): Promise<WeeklyActivity> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const start = addDays(today, -(dayCount - 1));
	const snap = await getDocs(
		query(
			txCol,
			where('transactionDate', '>=', Timestamp.fromDate(start)),
			orderBy('transactionDate', 'desc'),
			limit(WEEK_SCAN_LIMIT)
		)
	);

	const days: DayActivity[] = Array.from({ length: dayCount }, (_, i) => ({
		date: addDays(start, i),
		entries: 0,
		total: 0,
		amount: 0
	}));
	const slotOf = new Map(days.map((d, i) => [toISODate(d.date), i]));
	const byParty = new Map<string, PartyActivity>();
	const week = { entries: 0, total: 0, amount: 0 };

	for (const docSnap of snap.docs) {
		const t = toTransaction(docSnap);
		const slot = slotOf.get(toISODate(t.transactionDate));
		if (slot === undefined) continue;

		days[slot].entries += 1;
		days[slot].total += t.total;
		days[slot].amount += t.amount;
		week.entries += 1;
		week.total += t.total;
		week.amount += t.amount;

		const party = byParty.get(t.partyId) ?? { partyId: t.partyId, entries: 0, total: 0 };
		party.entries += 1;
		party.total += t.total;
		byParty.set(t.partyId, party);
	}

	const topParties = [...byParty.values()].sort((a, b) => b.entries - a.entries).slice(0, 5);
	return { days, topParties, ...week };
}

export async function getRecentTransactions(max = 10, partyId?: string): Promise<Transaction[]> {
	const constraints: QueryConstraint[] = [];
	if (partyId) constraints.push(where('partyId', '==', partyId));
	constraints.push(orderBy('transactionDate', 'desc'), limit(max));
	const snap = await getDocs(query(txCol, ...constraints));
	return snap.docs.map(toTransaction);
}

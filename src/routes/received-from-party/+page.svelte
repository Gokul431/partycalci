<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ReportDialog from '$lib/components/ReportDialog.svelte';
	import {
		countTransactions,
		fetchAllTransactions,
		listTransactions,
		resolveFilters,
		setTransactionStatus
	} from '$lib/firebase/firestore';
	import { downloadVoucherListing } from '$lib/utils/pdf';
	import type { DateRange } from '$lib/utils/ranges';
	import { parties } from '$lib/stores/parties.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate } from '$lib/utils/dates';
	import { formatCurrency, formatNumber, purchaseTypeLabel } from '$lib/utils/format';
	import {
		FILTER_DEBOUNCE_MS,
		filtersFromUrl,
		filtersKey,
		filtersToSearch,
		hasActiveFilters,
		pageSizeFromUrl
	} from '$lib/utils/filters';
	import { EMPTY_FILTERS, type Transaction, type TransactionFilters } from '$lib/types';

	const filters = $derived(filtersFromUrl(page.url));
	const pageSize = $derived(pageSizeFromUrl(page.url));
	const filtered = $derived(hasActiveFilters(filters));

	// Editable copy of the filters, applied to the URL as the user types.
	let draft = $state<TransactionFilters>({ ...EMPTY_FILTERS });
	// The URL state the draft already agrees with. Our own navigation echoes back through
	// `filters`, and without this the echo would overwrite characters typed since.
	let synced = '';

	// Follow the URL only when it moved somewhere we did not put it (first load, back/forward).
	$effect(() => {
		const key = filtersKey(filters);
		if (key === synced) return;
		synced = key;
		draft = { ...filters };
	});

	// Live search: apply the draft once typing pauses.
	$effect(() => {
		const key = filtersKey(draft);
		if (key === synced) return;
		const timer = setTimeout(() => {
			synced = key;
			applyFilters(draft);
		}, FILTER_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	let rows = $state<Transaction[]>([]);
	let total = $state<number | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let pageIndex = $state(0);
	let hasNext = $state(false);
	// cursors[i] = document to start after for page i (Firestore query cursors).
	let cursors: (QueryDocumentSnapshot<DocumentData> | null)[] = [null];
	let requestId = 0;

	async function fetchPage(index: number) {
		const id = ++requestId;
		loading = true;
		error = null;
		try {
			const resolved = resolveFilters(filters, parties.list);
			const res = await listTransactions(resolved, pageSize, cursors[index] ?? null);
			if (id !== requestId) return;
			rows = res.rows;
			pageIndex = index;
			hasNext = !!res.nextCursor;
			cursors[index + 1] = res.nextCursor;
		} catch (e) {
			if (id !== requestId) return;
			error = friendlyError(e, 'Could not load entries.');
			rows = [];
		} finally {
			if (id === requestId) loading = false;
		}
	}

	async function fetchCount() {
		total = null;
		try {
			total = await countTransactions(resolveFilters(filters, parties.list));
		} catch {
			total = null; // The list itself reports errors; the count is optional.
		}
	}

	function reload() {
		cursors = [null];
		fetchPage(0);
		fetchCount();
	}

	// Reload whenever the URL filters change, once the party master is available
	// (party name/phone search is resolved against it).
	$effect(() => {
		void page.url.search;
		if (parties.loading) return;
		untrack(reload);
	});

	function applyFilters(f: TransactionFilters, size = pageSize) {
		// replaceState so live typing does not fill the back button with every keystroke.
		goto(`/received-from-party${filtersToSearch(f, size)}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	// PDF export — the dialog picks the dates; the list's other filters carry over.
	let pdfOpen = $state(false);
	let pdfBusy = $state(false);

	const pdfNote = $derived(
		[
			filters.search.trim() ? `party matching "${filters.search.trim()}"` : '',
			filters.status ? `status ${filters.status}` : ''
		]
			.filter(Boolean)
			.join(' and ')
	);

	async function downloadPdf(range: DateRange) {
		pdfBusy = true;
		try {
			const forPdf = { ...filters, dateFrom: range.from, dateTo: range.to };
			const rows = await fetchAllTransactions(resolveFilters(forPdf, parties.list));
			if (rows.length === 0) {
				toast.error('No entries match this period, so there is nothing to print.');
				return;
			}
			await downloadVoucherListing(rows, parties.byId, forPdf);
			pdfOpen = false;
		} catch (e) {
			toast.error(friendlyError(e, 'Could not build the PDF.'));
		} finally {
			pdfBusy = false;
		}
	}

	// Cancel / restore (soft status change, never a hard delete)
	let confirmOpen = $state(false);
	let target = $state<Transaction | null>(null);
	let busy = $state(false);

	async function toggleStatus() {
		if (!target) return;
		const next = target.status === 'active' ? 'inactive' : 'active';
		busy = true;
		try {
			await setTransactionStatus(target.id, next);
			toast.success(next === 'inactive' ? 'Entry cancelled (marked inactive).' : 'Entry restored (marked active).');
			confirmOpen = false;
			fetchPage(pageIndex);
			fetchCount();
		} catch (e) {
			toast.error(friendlyError(e, 'Could not update the entry status.'));
		} finally {
			busy = false;
		}
	}
</script>

<PageHeader title="Received From Party" subtitle="Material received from parties">
	{#snippet actions()}
		<button type="button" class="btn-secondary" onclick={() => (pdfOpen = true)}>
			<Icon name="download" />Download PDF
		</button>
		<a href="/received-from-party/new" class="btn-primary"><Icon name="plus" />New Entry</a>
	{/snippet}
</PageHeader>

<ReportDialog
	bind:open={pdfOpen}
	initial={{ from: filters.dateFrom, to: filters.dateTo }}
	appliedFilters={pdfNote}
	busy={pdfBusy}
	ondownload={downloadPdf}
/>

<FilterBar
	bind:filters={draft}
	disabled={loading && rows.length === 0 && !error}
	onsearch={() => applyFilters(draft)}
	onreset={() => applyFilters(EMPTY_FILTERS)}
/>

<DataTable {loading} {error} onretry={reload} isEmpty={rows.length === 0} skeletonColumns={10}>
	{#snippet head()}
		<tr>
			<th class="th">Date</th><th class="th">Type</th><th class="th">Way No</th><th class="th">Party</th>
			<th class="th">Item</th><th class="th num">Load</th><th class="th num">Empty</th><th class="th num">Total</th>
			<th class="th num">Bags</th><th class="th num">Kg</th><th class="th num">Freight</th><th class="th">Narration</th>
			<th class="th num">Price</th><th class="th num">Amount</th><th class="th">Status</th>
			<th class="th sticky right-0 bg-slate-50 text-right">Actions</th>
		</tr>
	{/snippet}
	{#snippet body()}
		{#each rows as t (t.id)}
			{@const party = parties.byId.get(t.partyId)}
			{@const cancelling = t.status === 'active'}
			<tr class="group hover:bg-slate-50 {t.status === 'inactive' ? 'text-slate-400' : ''}">
				<td class="td">
					<a class="font-medium text-emerald-700 hover:underline" href="/received-from-party/{t.id}">{formatDate(t.transactionDate)}</a>
				</td>
				<td class="td">{purchaseTypeLabel(t.purchaseType)}</td>
				<td class="td"><a class="font-medium text-slate-900 hover:underline" href="/received-from-party/{t.id}">{t.wayNumber}</a></td>
				<td class="td">
					<div class="font-medium text-slate-900">{party?.partyName ?? 'Unknown party'}</div>
					{#if party?.phoneNumber}<div class="text-xs text-slate-500 tabular-nums">{party.phoneNumber}</div>{/if}
				</td>
				<td class="td">{t.itemName}</td>
				<td class="td num">{formatNumber(t.load)}</td>
				<td class="td num">{formatNumber(t.empty)}</td>
				<td class="td num font-medium">{formatNumber(t.total)}</td>
				<td class="td num">{formatNumber(t.bagCount)}</td>
				<td class="td num font-medium">{formatNumber(t.kg)}</td>
				<td class="td num">{formatCurrency(t.freightCharge)}</td>
				<td class="td max-w-48 truncate" title={t.narration}>{t.narration || '—'}</td>
				<td class="td num">{formatCurrency(t.price)}</td>
				<td class="td num">{formatCurrency(t.amount)}</td>
				<td class="td"><StatusBadge status={t.status} /></td>
				<td class="td sticky right-0 bg-white group-hover:bg-slate-50">
					<div class="flex items-center justify-end gap-1">
						<a href="/received-from-party/{t.id}" class="icon-action" title="View" aria-label="View entry {t.wayNumber}">
							<Icon name="eye" class="h-4 w-4" />
						</a>
						<a href="/received-from-party/{t.id}/edit" class="icon-action" title="Edit" aria-label="Edit entry {t.wayNumber}">
							<Icon name="edit" class="h-4 w-4" />
						</a>
							<button
								type="button"
								class="icon-action {cancelling ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-emerald-50 hover:text-emerald-700'}"
								title={cancelling ? 'Cancel' : 'Restore'}
								aria-label="{cancelling ? 'Cancel' : 'Restore'} entry {t.wayNumber}"
								onclick={() => {
									target = t;
									confirmOpen = true;
								}}
							>
							<Icon name={cancelling ? 'x' : 'refresh'} class="h-4 w-4" />
						</button>
					</div>
				</td>
			</tr>
		{/each}
	{/snippet}
	{#snippet empty()}
		{#if filtered}
			<EmptyState title="No records match your filters." icon="filter">
				<button type="button" class="btn-secondary" onclick={() => applyFilters(EMPTY_FILTERS)}>Reset Filters</button>
			</EmptyState>
		{:else}
			<EmptyState title="No received-from-party entries found." icon="truck">
				<a href="/received-from-party/new" class="btn-primary"><Icon name="plus" />New Entry</a>
			</EmptyState>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Pagination
			page={pageIndex + 1}
			{pageSize}
			rowCount={rows.length}
			{total}
			{hasNext}
			disabled={loading}
			onprev={() => fetchPage(pageIndex - 1)}
			onnext={() => fetchPage(pageIndex + 1)}
			onpagesize={(s) => applyFilters(filters, s)}
		/>
	{/snippet}
</DataTable>

<ConfirmDialog
	bind:open={confirmOpen}
	title={target?.status === 'active' ? 'Cancel this entry?' : 'Restore this entry?'}
	message={target?.status === 'active'
		? `Way number ${target?.wayNumber} will be marked Inactive. The record is kept and can be restored later.`
		: `Way number ${target?.wayNumber} will be marked Active again.`}
	confirmLabel={target?.status === 'active' ? 'Cancel Entry' : 'Restore Entry'}
	tone={target?.status === 'active' ? 'danger' : 'primary'}
	{busy}
	onconfirm={toggleStatus}
/>

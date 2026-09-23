<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { parties } from '$lib/stores/parties.svelte';
	import { matchPartyIds, setPartyStatus } from '$lib/firebase/firestore';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { pageSizeFromUrl } from '$lib/utils/filters';
	import type { Party, Status } from '$lib/types';

	// Search/status live in the URL so the list is restored after View/Edit.
	let search = $state(page.url.searchParams.get('q') ?? '');
	let status = $state<Status | ''>(
		(['active', 'inactive'] as const).find((s) => s === page.url.searchParams.get('status')) ?? ''
	);
	let pageSize = $state(pageSizeFromUrl(page.url));
	let pageNo = $state(1);

	const filtered = $derived.by(() => {
		let list = parties.list;
		if (status) list = list.filter((p) => p.status === status);
		if (search.trim()) {
			const ids = new Set(matchPartyIds(list, search));
			list = list.filter((p) => ids.has(p.id));
		}
		return list;
	});
	const rows = $derived(filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize));
	const hasFilters = $derived(!!search.trim() || !!status);

	// Reset to page 1 and sync the URL whenever the filters change.
	$effect(() => {
		const p = new URLSearchParams();
		if (search.trim()) p.set('q', search.trim());
		if (status) p.set('status', status);
		if (pageSize !== 20) p.set('size', String(pageSize));
		pageNo = 1;
		const qs = p.toString();
		if (qs !== page.url.searchParams.toString())
			goto(`/parties${qs ? `?${qs}` : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	let confirmOpen = $state(false);
	let target = $state<Party | null>(null);
	let busy = $state(false);

	function askToggle(p: Party) {
		target = p;
		confirmOpen = true;
	}

	async function toggle() {
		if (!target) return;
		const next: Status = target.status === 'active' ? 'inactive' : 'active';
		busy = true;
		try {
			await setPartyStatus(target.id, next);
			toast.success(`${target.partyName} ${next === 'active' ? 'activated' : 'deactivated'}.`);
			confirmOpen = false;
		} catch (e) {
			toast.error(friendlyError(e, 'Could not update the party status.'));
		} finally {
			busy = false;
		}
	}

	function reset() {
		search = '';
		status = '';
	}
</script>

<PageHeader title="Parties" subtitle="Party master — parties are never deleted, only deactivated">
	{#snippet actions()}
		<a href="/parties/new" class="btn-primary"><Icon name="plus" />Add Party</a>
	{/snippet}
</PageHeader>

<div class="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
	<div class="flex-1">
		<label class="label" for="party-search">Search</label>
		<div class="relative">
			<Icon name="search" class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
			<input id="party-search" type="search" class="input pl-8" placeholder="Search party name or phone number..." bind:value={search} />
		</div>
	</div>
	<div class="sm:w-44">
		<label class="label" for="party-status">Status</label>
		<select id="party-status" class="select" bind:value={status}>
			<option value="">All</option>
			<option value="active">Active</option>
			<option value="inactive">Inactive</option>
		</select>
	</div>
	{#if hasFilters}<button type="button" class="btn-secondary" onclick={reset}>Reset</button>{/if}
</div>

<DataTable loading={parties.loading} error={parties.error} onretry={() => parties.start()} isEmpty={rows.length === 0} skeletonColumns={5}>
	{#snippet head()}
		<tr>
			<th class="th">Party Name</th><th class="th">Place</th><th class="th">Phone Number</th>
			<th class="th">Status</th><th class="th text-right">Actions</th>
		</tr>
	{/snippet}
	{#snippet body()}
		{#each rows as p (p.id)}
			{@const deactivating = p.status === 'active'}
			<tr class="hover:bg-slate-50">
				<td class="td"><a href="/parties/{p.id}" class="font-medium text-emerald-700 hover:underline">{p.partyName}</a></td>
				<td class="td">{p.place || '—'}</td>
				<td class="td tabular-nums">{p.phoneNumber || '—'}</td>
				<td class="td"><StatusBadge status={p.status} /></td>
				<td class="td">
					<div class="flex items-center justify-end gap-1">
						<a href="/parties/{p.id}" class="icon-action" title="View" aria-label="View {p.partyName}">
							<Icon name="eye" class="h-4 w-4" />
						</a>
						<a href="/parties/{p.id}/edit" class="icon-action" title="Edit" aria-label="Edit {p.partyName}">
							<Icon name="edit" class="h-4 w-4" />
						</a>
							<button
								type="button"
								class="icon-action {deactivating ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-emerald-50 hover:text-emerald-700'}"
								title={deactivating ? 'Deactivate' : 'Activate'}
								aria-label="{deactivating ? 'Deactivate' : 'Activate'} {p.partyName}"
								onclick={() => askToggle(p)}
							>
							<Icon name="power" class="h-4 w-4" />
						</button>
					</div>
				</td>
			</tr>
		{/each}
	{/snippet}
	{#snippet empty()}
		{#if hasFilters}
			<EmptyState title="No records match your filters." icon="filter">
				<button type="button" class="btn-secondary" onclick={reset}>Reset Filters</button>
			</EmptyState>
		{:else}
			<EmptyState title="No parties found." description="Add your first party to get started." icon="users">
				<a href="/parties/new" class="btn-primary"><Icon name="plus" />Add Party</a>
			</EmptyState>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Pagination
			page={pageNo}
			{pageSize}
			rowCount={rows.length}
			total={filtered.length}
			hasNext={pageNo * pageSize < filtered.length}
			onprev={() => pageNo--}
			onnext={() => pageNo++}
			onpagesize={(s) => (pageSize = s)}
		/>
	{/snippet}
</DataTable>

<ConfirmDialog
	bind:open={confirmOpen}
	title={target?.status === 'active' ? 'Deactivate party?' : 'Activate party?'}
	message={target?.status === 'active'
		? `${target?.partyName} will no longer appear in the party list for new entries. Existing entries are not affected.`
		: `${target?.partyName} will be available again for new entries.`}
	confirmLabel={target?.status === 'active' ? 'Deactivate' : 'Activate'}
	tone={target?.status === 'active' ? 'danger' : 'primary'}
	{busy}
	onconfirm={toggle}
/>

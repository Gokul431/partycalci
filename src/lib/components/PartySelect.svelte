<script lang="ts">
	import type { Party } from '$lib/types';
	import Icon from './Icon.svelte';
	import StatusBadge from './StatusBadge.svelte';

	let {
		value = $bindable(''),
		parties,
		id = 'party',
		error = '',
		loading = false
	}: {
		value?: string;
		/** Selectable parties (callers pass Active parties only, plus the current one when editing). */
		parties: Party[];
		id?: string;
		error?: string;
		loading?: boolean;
	} = $props();

	let queryText = $state('');
	let open = $state(false);
	let editing = $state(false);
	let highlighted = $state(0);
	let input = $state<HTMLInputElement>();

	const selected = $derived(parties.find((p) => p.id === value) ?? null);
	const showSearch = $derived(!selected || editing);

	const filtered = $derived.by(() => {
		const q = queryText.trim().toLowerCase();
		const digits = q.replace(/\D/g, '');
		const list = q
			? parties.filter(
					(p) =>
						p.partyName.toLowerCase().includes(q) ||
						p.place.toLowerCase().includes(q) ||
						p.phoneNumber.toLowerCase().includes(q) ||
						(digits.length >= 3 && p.phoneNumber.replace(/\D/g, '').includes(digits))
				)
			: parties;
		return list.slice(0, 50);
	});

	$effect(() => {
		void filtered;
		highlighted = 0;
	});

	function choose(p: Party) {
		value = p.id;
		queryText = '';
		open = false;
		editing = false;
	}

	async function change() {
		editing = true;
		open = true;
		queueMicrotask(() => input?.focus());
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			highlighted = Math.min(highlighted + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (e.key === 'Enter') {
			if (open && filtered[highlighted]) {
				e.preventDefault();
				choose(filtered[highlighted]);
			}
		} else if (e.key === 'Escape') {
			open = false;
			if (selected) editing = false;
		}
	}

	function onblur() {
		// Delay so a click on an option registers first.
		setTimeout(() => {
			open = false;
			if (selected) editing = false;
			queryText = '';
		}, 150);
	}
</script>

{#if showSearch}
	<div class="relative">
		<Icon name="search" class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
		<input
			bind:this={input}
			{id}
			type="text"
			role="combobox"
			autocomplete="off"
			aria-expanded={open}
			aria-controls="{id}-listbox"
			aria-invalid={error ? 'true' : undefined}
			class="input pl-8 {error ? 'input-error' : ''}"
			placeholder={loading ? 'Loading parties…' : 'Search party name, phone or place...'}
			disabled={loading}
			bind:value={queryText}
			onfocus={() => (open = true)}
			oninput={() => (open = true)}
			{onkeydown}
			{onblur}
		/>
		{#if open}
			<ul
				id="{id}-listbox"
				role="listbox"
				class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
			>
				{#each filtered as p, i (p.id)}
					<!-- Keyboard selection is handled on the combobox input (arrow keys + Enter). -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<li
						role="option"
						aria-selected={p.id === value}
						class="cursor-pointer px-3 py-2 text-sm {i === highlighted ? 'bg-emerald-50' : ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => choose(p)}
						onmouseenter={() => (highlighted = i)}
					>
						<div class="font-medium text-slate-900">{p.partyName}</div>
						<div class="text-xs text-slate-500">{[p.place, p.phoneNumber].filter(Boolean).join(' · ') || '—'}</div>
					</li>
				{:else}
					<li class="px-3 py-3 text-sm text-slate-500">
						{parties.length ? 'No active party matches your search.' : 'No active parties. Add a party first.'}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else if selected}
	<div class="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
		<div class="text-sm">
			<div class="flex items-center gap-2">
				<span class="font-semibold text-slate-900">{selected.partyName}</span>
				{#if selected.status !== 'active'}<StatusBadge status={selected.status} />{/if}
			</div>
			<div class="mt-0.5 text-slate-600">{selected.place || '—'}</div>
			<div class="text-slate-600 tabular-nums">{selected.phoneNumber || '—'}</div>
		</div>
		<button type="button" class="btn-link shrink-0" onclick={change}>Change</button>
	</div>
{/if}

<script lang="ts">
	import Icon from './Icon.svelte';
	import { RANGE_PRESETS, matchPreset, type DateRange } from '$lib/utils/ranges';

	let {
		open = $bindable(false),
		initial,
		appliedFilters = '',
		busy = false,
		ondownload
	}: {
		open?: boolean;
		/** Pre-fills the range, so the dialog opens on whatever the list is already showing. */
		initial: DateRange;
		/** Plain-English note about the party/status filters that will also apply. */
		appliedFilters?: string;
		busy?: boolean;
		ondownload: (range: DateRange) => void;
	} = $props();

	let from = $state('');
	let to = $state('');
	let dialog: HTMLDialogElement;

	const preset = $derived(matchPreset({ from, to }));
	const rangeError = $derived(from && to && from > to ? 'Date From must be on or before Date To.' : '');

	$effect(() => {
		if (open && !dialog.open) {
			from = initial.from;
			to = initial.to;
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function choose(index: number) {
		const range = RANGE_PRESETS[index].of(new Date());
		from = range.from;
		to = range.to;
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
	onclose={() => (open = false)}
	oncancel={(e) => busy && e.preventDefault()}
	aria-labelledby="report-title"
>
	<div class="border-b border-slate-100 px-5 py-3">
		<h2 id="report-title" class="text-base font-semibold text-slate-900">Download PDF</h2>
		<p class="mt-0.5 text-sm text-slate-500">Choose the period to include in the voucher listing.</p>
	</div>

	<div class="p-5">
		<span class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase">Quick periods</span>
		<div class="flex flex-wrap gap-2">
			{#each RANGE_PRESETS as p, i (p.label)}
				<button
					type="button"
					class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {preset === p.label
						? 'border-emerald-600 bg-emerald-600 text-white'
						: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}"
					aria-pressed={preset === p.label}
					onclick={() => choose(i)}
				>
					{p.label}
				</button>
			{/each}
		</div>

		<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="r-from">Date From</label>
				<input id="r-from" type="date" class="input" bind:value={from} max={to || undefined} />
			</div>
			<div>
				<label class="label" for="r-to">Date To</label>
				<input id="r-to" type="date" class="input" bind:value={to} min={from || undefined} />
			</div>
		</div>

		{#if rangeError}<p class="field-error">{rangeError}</p>{/if}

		{#if !from && !to}
			<p class="mt-3 text-xs text-slate-500">Every entry will be included.</p>
		{/if}

		{#if appliedFilters}
			<p class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
				The list's current filters also apply — {appliedFilters}.
			</p>
		{/if}
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
		<button type="button" class="btn-secondary" disabled={busy} onclick={() => (open = false)}>Cancel</button>
		<button type="button" class="btn-primary" disabled={busy || !!rangeError} onclick={() => ondownload({ from, to })}>
			<Icon name="download" />{busy ? 'Preparing…' : 'Download PDF'}
		</button>
	</div>
</dialog>

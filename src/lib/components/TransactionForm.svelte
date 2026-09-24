<script lang="ts">
	import type { Party, TransactionFormValues } from '$lib/types';
	import { PURCHASE_TYPE_OPTIONS, STATUS_OPTIONS } from '$lib/types';
	import { KG_PER_BAG } from '$lib/utils/calculations';
	import {
		BAGS_EXCEED_TOTAL,
		computeWeights,
		validateTransaction,
		type FieldErrors,
		type TransactionField
	} from '$lib/utils/validation';
	import { formatKg, formatNumber } from '$lib/utils/format';
	import { friendlyError } from '$lib/utils/errors';
	import { todayISO } from '$lib/utils/dates';
	import { toast } from '$lib/stores/toast.svelte';
	import PartySelect from './PartySelect.svelte';

	let {
		initial,
		parties,
		partiesLoading = false,
		submitLabel = 'Save Entry',
		cancelHref,
		onsubmit
	}: {
		initial?: TransactionFormValues;
		parties: Party[];
		partiesLoading?: boolean;
		submitLabel?: string;
		cancelHref: string;
		onsubmit: (values: TransactionFormValues) => Promise<void>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let v = $state<TransactionFormValues>(
		initial ?? {
			transactionDate: todayISO(),
			purchaseType: 'purchase',
			wayNumber: '',
			partyId: '',
			itemName: '',
			load: null,
			empty: null,
			autoCalculate: true,
			total: null,
			bagCount: null,
			freightCharge: null,
			narration: '',
			price: null,
			amount: null,
			status: 'active'
		}
	);
	let submitted = $state(false);
	let busy = $state(false);

	// Live calculation — same functions used again before saving.
	const weights = $derived(computeWeights(v));
	const result = $derived(validateTransaction(v));
	const errors = $derived.by<FieldErrors<TransactionField>>(() => {
		if (submitted) return result.ok ? {} : result.errors;
		// Before first submit, surface only the weight-rule errors as the user types.
		const live: FieldErrors<TransactionField> = {};
		if (v.load != null && v.empty != null && weights.errors.empty) live.empty = weights.errors.empty;
		if (weights.errors.bagCount === BAGS_EXCEED_TOTAL) live.bagCount = weights.errors.bagCount;
		return live;
	});

	const manual = $derived(!v.autoCalculate);

	function setAutoCalculate(on: boolean) {
		// Switching to manual starts from the current calculated values, so nothing is lost.
		if (!on) {
			v.total ??= weights.total;
			v.bagCount ??= weights.bagCount;
		}
		v.autoCalculate = on;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (!result.ok) {
			toast.error('Please correct the highlighted fields.');
			return;
		}
		busy = true;
		try {
			await onsubmit($state.snapshot(v));
		} catch (err) {
			toast.error(friendlyError(err, 'Could not save the entry. Please try again.'));
		} finally {
			busy = false;
		}
	}
</script>

{#snippet err(field: TransactionField)}
	{#if errors[field]}<p class="field-error">{errors[field]}</p>{/if}
{/snippet}

{#snippet req()}<span class="text-red-600">*</span>{/snippet}

<form class="space-y-4" onsubmit={submit} novalidate>
	<section class="card">
		<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
			<h2 class="text-sm font-semibold text-slate-800">Basic Details</h2>
			<p class="text-xs text-slate-500">{@render req()} Required fields</p>
		</header>
		<div class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
			<div>
				<label class="label" for="transactionDate">Date {@render req()}</label>
				<input id="transactionDate" type="date" class="input {errors.transactionDate ? 'input-error' : ''}" bind:value={v.transactionDate} />
				{@render err('transactionDate')}
			</div>
			<div>
				<label class="label" for="purchaseType">Type of Purchase {@render req()}</label>
				<select id="purchaseType" class="select {errors.purchaseType ? 'input-error' : ''}" bind:value={v.purchaseType}>
					{#each PURCHASE_TYPE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('purchaseType')}
			</div>
			<div>
				<label class="label" for="wayNumber">Way Number {@render req()}</label>
				<input id="wayNumber" class="input {errors.wayNumber ? 'input-error' : ''}" bind:value={v.wayNumber} placeholder="e.g. 37473-R" maxlength="50" autocomplete="off" />
				{@render err('wayNumber')}
			</div>
			<div class="sm:col-span-2 lg:col-span-1">
				<label class="label" for="party">Party Name {@render req()}</label>
				<PartySelect id="party" bind:value={v.partyId} {parties} loading={partiesLoading} error={errors.partyId} />
				{@render err('partyId')}
			</div>
			<div class="sm:col-span-2">
				<label class="label" for="itemName">Item Name {@render req()}</label>
				<input id="itemName" class="input {errors.itemName ? 'input-error' : ''}" bind:value={v.itemName} maxlength="120" placeholder="e.g. Paddy" />
				{@render err('itemName')}
			</div>
		</div>
	</section>

	<section class="card">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
			<h2 class="text-sm font-semibold text-slate-800">Weight Details</h2>
			<label class="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
				<span>Auto-calculate Total &amp; Bags</span>
				<button
					type="button"
					role="switch"
					aria-checked={v.autoCalculate}
					aria-label="Auto-calculate Total and Bags"
					onclick={() => setAutoCalculate(!v.autoCalculate)}
					class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:outline-none {v.autoCalculate
						? 'bg-emerald-600'
						: 'bg-slate-300'}"
				>
					<span class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform {v.autoCalculate ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
				</button>
				<span class="w-7 text-xs font-semibold {v.autoCalculate ? 'text-emerald-700' : 'text-slate-500'}">{v.autoCalculate ? 'ON' : 'OFF'}</span>
			</label>
		</div>
		{#if manual}
			<p class="mx-5 mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
				Manual entry: type the Total and Number of Bags. Load and Empty are optional. Loose Kg is still Total − Bags × {KG_PER_BAG}.
			</p>
		{/if}
		<div class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label class="label" for="load">Load (kg) {#if manual}<span class="font-normal text-slate-400">— optional</span>{:else}{@render req()}{/if}</label>
				<input id="load" type="number" inputmode="decimal" min="0" step="any" class="input {errors.load ? 'input-error' : ''}" bind:value={v.load} placeholder="e.g. 7500" />
				{@render err('load')}
			</div>
			<div>
				<label class="label" for="empty">Empty (kg) {#if manual}<span class="font-normal text-slate-400">— optional</span>{:else}{@render req()}{/if}</label>
				<input id="empty" type="number" inputmode="decimal" min="0" step="any" class="input {errors.empty ? 'input-error' : ''}" bind:value={v.empty} placeholder="e.g. 2500" />
				{@render err('empty')}
			</div>
			{#if manual}
				<div>
					<label class="label" for="total">Total (kg) {@render req()}</label>
					<input id="total" type="number" inputmode="decimal" min="0" step="any" class="input {errors.total ? 'input-error' : ''}" bind:value={v.total} placeholder="e.g. 6000" />
					{@render err('total')}
				</div>
				<div>
					<label class="label" for="bagCount">Number of Bags {@render req()}</label>
					<input id="bagCount" type="number" inputmode="numeric" min="0" step="1" class="input {errors.bagCount ? 'input-error' : ''}" bind:value={v.bagCount} placeholder="e.g. 96" />
					{@render err('bagCount')}
				</div>
			{:else}
				<div>
					<label class="label" for="total">Total (kg) <span class="font-normal text-slate-400">— Load − Empty</span></label>
					<input id="total" class="input-readonly" readonly tabindex="-1" value={weights.total == null ? '' : formatNumber(weights.total)} placeholder="Auto calculated" />
				</div>
				<div>
					<label class="label" for="bagCount">Number of Bags <span class="font-normal text-slate-400">— Total ÷ {KG_PER_BAG}</span></label>
					<input id="bagCount" class="input-readonly" readonly tabindex="-1" value={weights.bagCount == null ? '' : formatNumber(weights.bagCount)} placeholder="Auto calculated" />
				</div>
			{/if}
		</div>

		<div class="mx-5 mb-5 overflow-hidden rounded-lg border border-slate-200" aria-live="polite">
			<div class="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50">
				<div class="px-4 py-3">
					<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total Weight</div>
					<div class="mt-0.5 text-lg font-bold text-slate-900">{formatKg(weights.total)}</div>
				</div>
				<div class="px-4 py-3">
					<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Bags</div>
					<div class="mt-0.5 text-lg font-bold text-slate-900">{formatNumber(weights.bagCount)}</div>
				</div>
				<div class="px-4 py-3">
					<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Loose Kg</div>
					<div class="mt-0.5 text-lg font-bold text-emerald-700">{formatKg(weights.kg)}</div>
				</div>
			</div>
			<p class="border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500 tabular-nums">
				{#if weights.total != null}
					{formatNumber(weights.total)} kg = {formatNumber(weights.bagCount)} bag{weights.bagCount === 1 ? '' : 's'}
					× {KG_PER_BAG} + {formatNumber(weights.kg)} kg
				{:else if manual}
					Type the Total and Number of Bags; the Loose Kg is Total − Bags × {KG_PER_BAG}.
				{:else}
					Total ÷ {KG_PER_BAG} gives the bags; the remainder is the loose Kg.
				{/if}
			</p>
		</div>
	</section>

	<section class="card">
		<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Other Details</h2>
		<div class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label class="label" for="freightCharge">Freight Charge (₹)</label>
				<input id="freightCharge" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.freightCharge ? 'input-error' : ''}" bind:value={v.freightCharge} placeholder="0.00" />
				{@render err('freightCharge')}
			</div>
			<div>
				<label class="label" for="price">Price (₹)</label>
				<input id="price" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.price ? 'input-error' : ''}" bind:value={v.price} placeholder="0.00" />
				{@render err('price')}
			</div>
			<div>
				<label class="label" for="amount">Amount (₹)</label>
				<input id="amount" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.amount ? 'input-error' : ''}" bind:value={v.amount} placeholder="0.00" />
				{@render err('amount')}
			</div>
			<div>
				<label class="label" for="status">Status {@render req()}</label>
				<select id="status" class="select" bind:value={v.status}>
					{#each STATUS_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('status')}
			</div>
			<div class="sm:col-span-2 lg:col-span-4">
				<label class="label" for="narration">Narration</label>
				<textarea id="narration" rows="3" class="input {errors.narration ? 'input-error' : ''}" bind:value={v.narration} maxlength="1000" placeholder="Optional notes about this entry"></textarea>
				{@render err('narration')}
			</div>
		</div>
	</section>

	<div class="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
		<a href={cancelHref} class="btn-secondary">Cancel</a>
		<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>

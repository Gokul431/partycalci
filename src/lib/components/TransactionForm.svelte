<script lang="ts">
	import type { Party, TransactionFormValues } from '$lib/types';
	import { PURCHASE_TYPE_OPTIONS, STATUS_OPTIONS } from '$lib/types';
	import { KG_PER_BAG, calculateItemAmount, calculateTotalAmount, ratePerKg } from '$lib/utils/calculations';
	import {
		computeWeights,
		validateTransaction,
		type FieldErrors,
		type TransactionField
	} from '$lib/utils/validation';
	import { formatCurrency, formatNumber, formatWayNumber } from '$lib/utils/format';
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
			kg: null,
			freightCharge: null,
			narration: '',
			price: null,
			status: 'active'
		}
	);
	let submitted = $state(false);
	let busy = $state(false);

	// Live calculation — same functions used again before saving.
	const weights = $derived(computeWeights(v));
	// The selected party decides whether the loose kg is billed. Until one is picked the
	// preview assumes wholesale; the write path re-reads the type from the party record.
	const selectedParty = $derived(parties.find((p) => p.id === v.partyId));
	const partyType = $derived(selectedParty?.partyType ?? 'wholesale');
	const result = $derived(validateTransaction(v, partyType));

	const money = $derived.by(() => {
		const pricePerBag = v.price ?? 0;
		const freight = v.freightCharge ?? 0;
		if (weights.bagCount == null || weights.kg == null) {
			return { rate: ratePerKg(pricePerBag), bags: null, loose: null, item: null, total: null };
		}
		const item = calculateItemAmount(partyType, weights.bagCount, weights.kg, pricePerBag);
		return {
			rate: ratePerKg(pricePerBag),
			bags: weights.bagCount * pricePerBag,
			loose: weights.kg * ratePerKg(pricePerBag),
			item,
			total: calculateTotalAmount(item, freight)
		};
	});
	const errors = $derived.by<FieldErrors<TransactionField>>(() => {
		if (submitted) return result.ok ? {} : result.errors;
		// Before first submit, surface only the weight-rule errors as the user types.
		const live: FieldErrors<TransactionField> = {};
		if (v.load != null && v.empty != null && weights.errors.empty) live.empty = weights.errors.empty;
		return live;
	});

	const manual = $derived(!v.autoCalculate);

	function setAutoCalculate(on: boolean) {
		// Switching to manual starts from the current calculated values, so nothing is lost.
		if (!on) {
			v.total ??= weights.total;
			v.bagCount ??= weights.bagCount;
			v.kg ??= weights.kg;
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
				<select
					id="purchaseType"
					class="select {errors.purchaseType ? 'input-error' : ''}"
					bind:value={v.purchaseType}
					onchange={() => {
						if (v.wayNumber.trim()) {
							v.wayNumber = formatWayNumber(v.wayNumber, v.purchaseType);
						}
					}}
				>
					{#each PURCHASE_TYPE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('purchaseType')}
			</div>
			<div>
				<label class="label" for="wayNumber">Way Number {@render req()}</label>
				<input
					id="wayNumber"
					class="input {errors.wayNumber ? 'input-error' : ''}"
					bind:value={v.wayNumber}
					oninput={() => {
						const trimmed = v.wayNumber.trim();
						if (/(?:-\s*|(?<=\d))r$/i.test(trimmed)) {
							v.purchaseType = 'return';
						} else if (/(?:-\s*|(?<=\d))p$/i.test(trimmed)) {
							v.purchaseType = 'purchase';
						}
					}}
					onblur={() => {
						const trimmed = v.wayNumber.trim();
						if (/(?:-\s*|(?<=\d))r$/i.test(trimmed)) {
							v.purchaseType = 'return';
						} else if (/(?:-\s*|(?<=\d))p$/i.test(trimmed)) {
							v.purchaseType = 'purchase';
						}
						if (trimmed) {
							v.wayNumber = formatWayNumber(v.wayNumber, v.purchaseType);
						}
					}}
					placeholder="e.g. 37473-P or 37473-R"
					maxlength="50"
					autocomplete="off"
				/>
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
				Manual entry: nothing is calculated. Type the Total, Number of Bags and Loose Kg exactly as they
					should be recorded — they do not have to agree with each other. Load and Empty are optional.
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
				<div>
					<label class="label" for="kg">Loose Kg {@render req()}</label>
					<input id="kg" type="number" inputmode="decimal" min="0" step="any" class="input {errors.kg ? 'input-error' : ''}" bind:value={v.kg} placeholder="e.g. 48" />
					{@render err('kg')}
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
				<div>
					<label class="label" for="kg">Loose Kg <span class="font-normal text-slate-400">— the remainder</span></label>
					<input id="kg" class="input-readonly" readonly tabindex="-1" value={weights.kg == null ? '' : formatNumber(weights.kg)} placeholder="Auto calculated" />
				</div>
			{/if}
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
				<label class="label" for="price">Price per Bag (₹)</label>
				<input id="price" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.price ? 'input-error' : ''}" bind:value={v.price} placeholder="e.g. 1500" />
				{@render err('price')}
				<p class="mt-1 text-xs text-slate-500">Loose Kg rate: {formatCurrency(money.rate)} per kg</p>
			</div>
			<div>
				<label class="label" for="itemAmount">Item Amount (₹) <span class="font-normal text-slate-400">— calculated</span></label>
				<input id="itemAmount" class="input-readonly" readonly tabindex="-1" value={money.item == null ? '' : formatCurrency(money.item)} placeholder="Auto calculated" />
			</div>
			<div>
				<label class="label" for="status">Status {@render req()}</label>
				<select id="status" class="select" bind:value={v.status}>
					{#each STATUS_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('status')}
			</div>
			<div class="sm:col-span-2 lg:col-span-4 overflow-hidden rounded-lg border border-slate-200" aria-live="polite">
				<div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
					<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Billing</span>
					<span class="text-xs text-slate-500">
						{selectedParty ? `${selectedParty.partyName} · ` : ''}{partyType === 'farmer' ? 'Farmer' : 'Wholesale'}
						{partyType === 'farmer' ? '— bags and loose Kg are billed' : '— full bags only, loose Kg is not billed'}
					</span>
				</div>
				<dl class="divide-y divide-slate-100 text-sm tabular-nums">
					<div class="flex justify-between px-4 py-2">
						<dt class="text-slate-600">{formatNumber(weights.bagCount)} bags × {formatCurrency(v.price ?? 0)}</dt>
						<dd class="font-medium text-slate-900">{money.bags == null ? '—' : formatCurrency(money.bags)}</dd>
					</div>
					<div class="flex justify-between px-4 py-2 {partyType === 'farmer' ? '' : 'text-slate-400'}">
						<dt>{formatNumber(weights.kg)} kg × {formatCurrency(money.rate)}</dt>
						<dd class="font-medium">
							{#if partyType === 'farmer'}
								{money.loose == null ? '—' : formatCurrency(money.loose)}
							{:else}
								Not billed
							{/if}
						</dd>
					</div>
					<div class="flex justify-between bg-slate-50/60 px-4 py-2">
						<dt class="font-medium text-slate-700">Item Amount</dt>
						<dd class="font-semibold text-slate-900">{money.item == null ? '—' : formatCurrency(money.item)}</dd>
					</div>
					<div class="flex justify-between px-4 py-2">
						<dt class="text-slate-600">Less freight charge</dt>
						<dd class="font-medium text-slate-700">− {formatCurrency(v.freightCharge ?? 0)}</dd>
					</div>
					<div class="flex justify-between bg-emerald-50/60 px-4 py-2.5">
						<dt class="font-semibold text-slate-800">Total Amount</dt>
						<dd class="text-base font-bold text-emerald-700">{money.total == null ? '—' : formatCurrency(money.total)}</dd>
					</div>
				</dl>
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

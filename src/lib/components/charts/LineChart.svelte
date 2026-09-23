<script lang="ts">
	import { axisScale } from './scale';

	interface LinePoint {
		label: string;
		value: number;
	}

	let {
		data,
		format = (n: number) => String(n),
		tickFormat = format,
		summary
	}: {
		data: LinePoint[];
		format?: (n: number) => string;
		tickFormat?: (n: number) => string;
		summary: string;
	} = $props();

	const W = 680;
	const H = 240;
	const PAD = { top: 20, right: 16, bottom: 26, left: 62 };
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const baseline = PAD.top + plotH;

	const axis = $derived(axisScale(Math.max(...data.map((d) => d.value), 0)));
	const step = $derived(data.length > 1 ? plotW / (data.length - 1) : 0);
	const isEmpty = $derived(data.every((d) => d.value === 0));

	const y = (v: number) => PAD.top + plotH * (1 - v / axis.top);
	const x = (i: number) => PAD.left + step * i;

	const linePath = $derived(data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(d.value)}`).join(''));
	const areaPath = $derived(`${linePath}L${x(data.length - 1)} ${baseline}L${x(0)} ${baseline}Z`);

	let active = $state<number | null>(null);
	const shown = $derived(active ?? data.length - 1);
</script>

<div class="relative">
	<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img" aria-label={summary}>
		{#each axis.ticks as tick (tick)}
			<line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" stroke-width="1" />
			<text x={PAD.left - 10} y={y(tick) + 4} text-anchor="end" font-size="11" fill="#94a3b8" class="tabular-nums">
				{tickFormat(tick)}
			</text>
		{/each}

		{#if isEmpty}
			<text x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} text-anchor="middle" font-size="12" fill="#94a3b8">
				No entries in this period
			</text>
		{:else}
			<path d={areaPath} fill="#059669" opacity="0.1" />
			<path d={linePath} fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

			{#if active !== null}
				<line x1={x(active)} x2={x(active)} y1={PAD.top} y2={baseline} stroke="#cbd5e1" stroke-width="1" />
			{/if}

			<circle cx={x(shown)} cy={y(data[shown].value)} r="4.5" fill="#059669" stroke="#ffffff" stroke-width="2" />

			{#if active === null}
				<text x={x(data.length - 1)} y={y(data[data.length - 1].value) - 12} text-anchor="end" font-size="11" font-weight="600" fill="#334155">
					{format(data[data.length - 1].value)}
				</text>
			{/if}
		{/if}

		{#each data as d, i (d.label)}
			<text x={x(i)} y={H - 8} text-anchor="middle" font-size="11" fill="#94a3b8">{d.label}</text>
			<rect
				x={x(i) - step / 2}
				y={PAD.top}
				width={step}
				height={plotH}
				fill="transparent"
				role="presentation"
				onmouseenter={() => (active = i)}
				onmouseleave={() => (active = null)}
			>
				<title>{d.label}: {format(d.value)}</title>
			</rect>
		{/each}
	</svg>

	{#if active !== null && !isEmpty}
		{@const d = data[active]}
		<div
			class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
			style="left: clamp(4.5rem, {(x(active) / W) * 100}%, calc(100% - 4.5rem)); top: calc({(y(d.value) / H) * 100}% - 0.75rem);"
		>
			<span class="text-slate-300">{d.label}</span>
			<span class="ml-1.5 font-semibold tabular-nums">{format(d.value)}</span>
		</div>
	{/if}
</div>

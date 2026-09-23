<script lang="ts">
	import { axisScale, columnPath } from './scale';

	interface ColumnPoint {
		label: string;
		value: number;
	}

	let {
		data,
		format = (n: number) => String(n),
		summary
	}: { data: ColumnPoint[]; format?: (n: number) => string; summary: string } = $props();

	const W = 680;
	const H = 240;
	const PAD = { top: 20, right: 10, bottom: 26, left: 50 };
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const baseline = PAD.top + plotH;

	const axis = $derived(axisScale(Math.max(...data.map((d) => d.value), 0)));
	const band = $derived(plotW / Math.max(data.length, 1));
	const barW = $derived(Math.min(24, band - 10));
	const peak = $derived(data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0));
	const isEmpty = $derived(data.every((d) => d.value === 0));

	const y = (v: number) => PAD.top + plotH * (1 - v / axis.top);
	const centerOf = (i: number) => PAD.left + band * i + band / 2;

	let active = $state<number | null>(null);
</script>

<div class="relative">
	<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img" aria-label={summary}>
		{#each axis.ticks as tick (tick)}
			<line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" stroke-width="1" />
			<text x={PAD.left - 10} y={y(tick) + 4} text-anchor="end" font-size="11" fill="#94a3b8" class="tabular-nums">
				{format(tick)}
			</text>
		{/each}

		{#if isEmpty}
			<text x={PAD.left + plotW / 2} y={PAD.top + plotH / 2} text-anchor="middle" font-size="12" fill="#94a3b8">
				No entries in this period
			</text>
		{:else}
			{#each data as d, i (d.label)}
				<path d={columnPath(centerOf(i) - barW / 2, y(d.value), barW, baseline - y(d.value))} fill="#059669" opacity={active === null || active === i ? 1 : 0.45} />
			{/each}

			{#if data[peak].value > 0}
				<text x={centerOf(peak)} y={y(data[peak].value) - 8} text-anchor="middle" font-size="11" font-weight="600" fill="#334155">
					{format(data[peak].value)}
				</text>
			{/if}
		{/if}

		{#each data as d, i (d.label)}
			<text x={centerOf(i)} y={H - 8} text-anchor="middle" font-size="11" fill="#94a3b8">{d.label}</text>
			<rect
				x={PAD.left + band * i}
				y={PAD.top}
				width={band}
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
			style="left: clamp(4rem, {(centerOf(active) / W) * 100}%, calc(100% - 4rem)); top: calc({(y(d.value) / H) * 100}% - 0.5rem);"
		>
			<span class="text-slate-300">{d.label}</span>
			<span class="ml-1.5 font-semibold tabular-nums">{format(d.value)}</span>
		</div>
	{/if}
</div>

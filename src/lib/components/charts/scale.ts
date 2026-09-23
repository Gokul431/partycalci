/** Tick steps that stay whole numbers at every magnitude, so axis labels never read 1.25. */
const STEPS = [
	1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 25_000,
	50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000
];

export interface Axis {
	top: number;
	ticks: number[];
}

export function axisScale(max: number, divisions = 4): Axis {
	const step = STEPS.find((s) => s * divisions >= max) ?? Math.ceil(max / divisions);
	return { top: step * divisions, ticks: Array.from({ length: divisions + 1 }, (_, i) => i * step) };
}

/** Column with a rounded cap and square feet on the baseline. */
export function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
	if (h <= 0) return '';
	const rr = Math.min(r, w / 2, h);
	return `M${x} ${y + h}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h}Z`;
}

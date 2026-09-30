import { addDays, addMonths, startOfMonth, startOfWeek, toISODate } from './dates';

export interface DateRange {
	/** YYYY-MM-DD, or '' for an open end. */
	from: string;
	to: string;
}

export interface RangePreset {
	label: string;
	of: (today: Date) => DateRange;
}

/** Quick periods offered when choosing what to print. */
export const RANGE_PRESETS: RangePreset[] = [
	{
		label: 'This week',
		of: (t) => ({ from: toISODate(startOfWeek(t)), to: toISODate(t) })
	},
	{
		label: 'Last week',
		of: (t) => {
			const start = addDays(startOfWeek(t), -7);
			return { from: toISODate(start), to: toISODate(addDays(start, 6)) };
		}
	},
	{
		label: 'This month',
		of: (t) => ({ from: toISODate(startOfMonth(t)), to: toISODate(t) })
	},
	{
		label: 'Last month',
		of: (t) => ({
			from: toISODate(addMonths(startOfMonth(t), -1)),
			to: toISODate(addDays(startOfMonth(t), -1))
		})
	},
	{
		label: 'Last 3 months',
		of: (t) => ({ from: toISODate(addMonths(t, -3)), to: toISODate(t) })
	},
	{
		label: 'Last 6 months',
		of: (t) => ({ from: toISODate(addMonths(t, -6)), to: toISODate(t) })
	},
	{
		label: 'This year',
		of: (t) => ({ from: toISODate(new Date(t.getFullYear(), 0, 1)), to: toISODate(t) })
	},
	{ label: 'All dates', of: () => ({ from: '', to: '' }) }
];

/** The period the entry list opens on when the URL carries no dates of its own. */
export function defaultDateRange(today = new Date()): DateRange {
	return { from: toISODate(addMonths(today, -1)), to: toISODate(today) };
}

/** The preset a range corresponds to, so reopening the dialog keeps the chip highlighted. */
export function matchPreset(range: DateRange, today = new Date()): string | null {
	return RANGE_PRESETS.find((p) => {
		const r = p.of(today);
		return r.from === range.from && r.to === range.to;
	})?.label ?? null;
}

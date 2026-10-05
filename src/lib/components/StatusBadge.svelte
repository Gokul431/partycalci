<script lang="ts">
	import type { Status } from '$lib/types';
	import { entryStatusLabel } from '$lib/utils/format';

	/**
	 * `Status` carries two different meanings. On a party it is whether the party can be
	 * chosen for new entries — Active / Inactive. On an entry it describes the bill:
	 * active is still Pending, inactive is Completed. `kind` picks which reading applies
	 * so renaming one never silently relabels the other.
	 */
	let { status, kind = 'party' }: { status: Status; kind?: 'party' | 'entry' } = $props();

	const done = $derived(status === 'inactive');
	const label = $derived(kind === 'entry' ? entryStatusLabel(status) : done ? 'Inactive' : 'Active');
	// A pending bill is the one that still needs attention, so it takes the amber.
	const tone = $derived(
		kind === 'entry'
			? done
				? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
				: 'bg-amber-50 text-amber-800 ring-amber-600/20'
			: done
				? 'bg-slate-100 text-slate-600 ring-slate-500/20'
				: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
	);
	const dot = $derived(
		kind === 'entry'
			? done
				? 'bg-emerald-500'
				: 'bg-amber-500'
			: done
				? 'bg-slate-400'
				: 'bg-emerald-500'
	);
</script>

<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {tone}">
	<span class="h-1.5 w-1.5 rounded-full {dot}"></span>
	{label}
</span>

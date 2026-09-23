<script lang="ts">
	import type { Status } from '$lib/types';
	let { status }: { status: Status } = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {status === 'active'
		? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
		: 'bg-slate-100 text-slate-600 ring-slate-500/20'}"
>
	<span class="h-1.5 w-1.5 rounded-full {status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
	{status === 'active' ? 'Active' : 'Inactive'}
</span>

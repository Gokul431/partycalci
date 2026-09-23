<script lang="ts">
	import Icon from './Icon.svelte';

	let { onmenu }: { onmenu: () => void } = $props();
</script>

<header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
	<button type="button" class="rounded p-1.5 text-slate-600 hover:bg-slate-100" onclick={onmenu} aria-label="Open menu">
		<Icon name="menu" class="h-5 w-5" />
	</button>
	<span class="text-sm font-semibold text-slate-900">MillBooks</span>
</header>

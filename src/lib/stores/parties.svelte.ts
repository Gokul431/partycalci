import { SvelteMap } from 'svelte/reactivity';
import { subscribeParties } from '$lib/firebase/firestore';
import { friendlyError } from '$lib/utils/errors';
import type { Party } from '$lib/types';

/**
 * Live party master list, shared across pages. Parties are small master data,
 * so they are kept in memory for name/phone search and for joining onto transactions.
 */
class PartiesStore {
	list = $state<Party[]>([]);
	byId = new SvelteMap<string, Party>();
	loading = $state(true);
	error = $state<string | null>(null);
	private unsubscribe: (() => void) | null = null;

	get active() {
		return this.list.filter((p) => p.status === 'active');
	}

	start() {
		if (this.unsubscribe) return;
		this.loading = true;
		this.unsubscribe = subscribeParties(
			(parties) => {
				this.list = parties;
				this.byId.clear();
				for (const p of parties) this.byId.set(p.id, p);
				this.loading = false;
				this.error = null;
			},
			(err) => {
				this.error = friendlyError(err, 'Could not load parties.');
				this.loading = false;
				this.unsubscribe = null;
			}
		);
	}

	stop() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.list = [];
		this.byId.clear();
		this.loading = true;
	}
}

export const parties = new PartiesStore();

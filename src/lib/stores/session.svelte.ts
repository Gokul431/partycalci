import type { User } from 'firebase/auth';
import { onUserChanged } from '$lib/firebase/auth';

class Session {
	user = $state<User | null>(null);
	/** False until Firebase has restored (or ruled out) a signed-in user. */
	ready = $state(false);

	constructor() {
		onUserChanged((u) => {
			this.user = u;
			this.ready = true;
		});
	}
}

export const session = new Session();

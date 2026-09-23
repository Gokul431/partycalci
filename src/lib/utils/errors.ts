/** An error whose message is safe to show to the user as-is. */
export class AppError extends Error {}

const MESSAGES: Record<string, string> = {
	'permission-denied':
		'You do not have permission for this action, or the data failed server validation.',
	unauthenticated: 'Your session has expired. Please sign in again.',
	unavailable: 'Cannot reach the server. Check your internet connection and try again.',
	'deadline-exceeded': 'The request took too long. Please try again.',
	'not-found': 'The requested record was not found.',
	'failed-precondition':
		'The database is not ready for this search yet (an index may still be building). Please try again in a few minutes.',
	'resource-exhausted': 'Too many requests. Please wait a moment and try again.',
	'auth/invalid-credential': 'Incorrect email or password.',
	'auth/wrong-password': 'Incorrect email or password.',
	'auth/user-not-found': 'Incorrect email or password.',
	'auth/invalid-email': 'Enter a valid email address.',
	'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
	'auth/too-many-requests': 'Too many sign-in attempts. Please wait and try again.',
	'auth/configuration-not-found':
		'Sign-in is not set up for this app yet. Enable Email/Password in Firebase Authentication.',
	'auth/operation-not-allowed':
		'Email/password sign-in is disabled. Enable it in Firebase Authentication.',
	'auth/network-request-failed': 'Network error. Check your internet connection.'
};

/** Converts any thrown value into a friendly message; raw details go to the console only. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
	if (err instanceof AppError) return err.message;
	console.error(err);
	const code = (err as { code?: unknown })?.code;
	if (typeof code === 'string') {
		const key = code.replace(/^firestore\//, '');
		if (MESSAGES[key]) return MESSAGES[key];
	}
	if (typeof navigator !== 'undefined' && !navigator.onLine) return MESSAGES.unavailable;
	return fallback;
}

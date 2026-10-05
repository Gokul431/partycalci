import {
	EmailAuthProvider,
	getAuth,
	onAuthStateChanged,
	reauthenticateWithCredential,
	signInWithEmailAndPassword,
	signOut,
	updatePassword,
	verifyBeforeUpdateEmail,
	type User
} from 'firebase/auth';
import { app } from './config';
import { AppError } from '$lib/utils/errors';

export const auth = getAuth(app);

/**
 * Firebase refuses to change credentials on a stale session, and this app keeps people
 * signed in indefinitely — so proving the current password first is the normal path, not
 * an edge case. Every credential change goes through here so that step cannot be skipped.
 */
async function reauthenticate(currentPassword: string): Promise<User> {
	const user = auth.currentUser;
	if (!user?.email) throw new AppError('Your session has expired. Please sign in again.');
	await reauthenticateWithCredential(
		user,
		EmailAuthProvider.credential(user.email, currentPassword)
	);
	return user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
	const user = await reauthenticate(currentPassword);
	await updatePassword(user, newPassword);
}

/**
 * Sends a confirmation link to the new address; the sign-in email only changes once that
 * link is opened. The current address keeps working until then, so a typo cannot lock
 * anyone out.
 */
export async function requestEmailChange(currentPassword: string, newEmail: string): Promise<void> {
	const user = await reauthenticate(currentPassword);
	await verifyBeforeUpdateEmail(user, newEmail.trim());
}

export function login(email: string, password: string) {
	return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
	return signOut(auth);
}

export function onUserChanged(cb: (user: User | null) => void) {
	return onAuthStateChanged(auth, cb);
}

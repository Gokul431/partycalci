import {
	getAuth,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	type User
} from 'firebase/auth';
import { app } from './config';

export const auth = getAuth(app);

export function login(email: string, password: string) {
	return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
	return signOut(auth);
}

export function onUserChanged(cb: (user: User | null) => void) {
	return onAuthStateChanged(auth, cb);
}

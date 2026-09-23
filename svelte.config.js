import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Single-page app: Firebase Hosting serves index.html for every route.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;

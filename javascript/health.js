// =============================================
// health.js  —  Bookmark link health checker
// =============================================

'use strict';

let abortController = null;

export async function checkAllBookmarks(categories, options = {}) {
	const {concurrency = 5, progress, complete} = options;
	const allBookmarks = categories.flatMap(c => (c.bookmarks || []).map(b => ({...b, category: c.category})));
	const urls = [...new Set(allBookmarks.map(b => b.url))];

	abortController = new AbortController();
	const signal = abortController.signal;

	const results = [];
	const queue = [...urls];
	let checked = 0;

	async function worker() {
		while (queue.length > 0) {
			if (signal.aborted) break;
			const url = queue.shift();
			if (!url) continue;

			const result = await checkUrl(url, signal);
			results.push(result);
			checked++;
			progress?.(url, checked, urls.length);
		}
	}

	const workers = Array.from({length: Math.min(concurrency, urls.length)}, () => worker());
	await Promise.all(workers);

	if (complete) complete(results);
	return results;
}

export function cancelCheck() {
	if (abortController) {
		abortController.abort();
		abortController = null;
	}
}

async function checkUrl(url, signal) {
	// Try regular fetch first (respects CORS, gives real status if allowed)
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10000);

		const response = await fetch(url, {
			method: 'HEAD',
			signal: AbortSignal.any([signal, controller.signal])
		});

		clearTimeout(timeout);

		const status = response.status;
		let category;
		if (status >= 200 && status < 300) category = 'ok';
		else if (status >= 300 && status < 400) category = 'redirect';
		else if (status >= 400 && status < 500) category = 'client-error';
		else if (status >= 500) category = 'server-error';
		else category = 'ok';

		return {url, category, status};
	} catch (err) {
		if (err.name === 'AbortError' || signal.aborted) {
			return {url, category: 'cancelled'};
		}

		// HEAD might fail due to CORS, try GET with no-cors as fallback
		// This won't give us status, but can detect if domain is reachable
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 10000);

			await fetch(url, {
				method: 'GET',
				mode: 'no-cors',
				signal: AbortSignal.any([signal, controller.signal])
			});

			clearTimeout(timeout);
			// Got a response (even opaque), assume OK
			return {url, category: 'ok', status: 200};
		} catch (err2) {
			if (err2.name === 'AbortError' || signal.aborted) {
				return {url, category: 'cancelled'};
			}
			// Network error, domain unreachable, etc.
			return {url, category: 'error', error: err2.message || 'Network error'};
		}
	}
}

export function getResults() {
	return [];
}

export function getSummary() {
	return {};
}
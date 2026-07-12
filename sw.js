// LocalMarks Service Worker
// Caches bookmarks.json and static assets for offline viewing

const CACHE_NAME = 'localmarks-v1';
const STATIC_ASSETS = [
	'/',
	'/index.html',
	'/favicon.ico',
	'/stylesheet/style.css',
	'/stylesheet/themes/light.css'
];

const CACHE_STRATEGIES = {
	// Network first, fallback to cache
	networkFirst: ['/bookmarks.json'],
	// Cache first, fallback to network
	cacheFirst: [...STATIC_ASSETS]
};

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(STATIC_ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys()
			.then(keys => Promise.all(
				keys.filter(key => key !== CACHE_NAME)
					.map(key => caches.delete(key))
			))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', event => {
	const url = new URL(event.request.url);

	// Only handle same-origin requests
	if (url.origin !== location.origin) return;

	const pathname = url.pathname;

	// Network-first for bookmarks.json
	if (pathname === '/bookmarks.json') {
		event.respondWith(networkFirst(event.request));
		return;
	}

	// Cache-first for static assets
	if (CACHE_STRATEGIES.cacheFirst.some(path => pathname.startsWith(path) || pathname === path)) {
		event.respondWith(cacheFirst(event.request));
		return;
	}

	// Default: network first for everything else
	event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (err) {
		const cached = await cache.match(request);
		if (cached) return cached;
		// Return offline fallback for navigation requests
		if (request.mode === 'navigate') {
			return caches.match('/index.html');
		}
		throw err;
	}
}

async function cacheFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	if (cached) {
		// Update cache in background
		fetch(request).then(response => {
			if (response.ok) cache.put(request, response);
		}).catch(() => {});
		return cached;
	}

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (err) {
		// Return offline fallback for navigation
		if (request.mode === 'navigate') {
			return caches.match('/index.html');
		}
		throw err;
	}
}

// Listen for messages from main thread
self.addEventListener('message', event => {
	if (event.data === 'skipWaiting') {
		self.skipWaiting();
	}
});
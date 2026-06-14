// =============================================
// script.js  —  LocalMarks bookmark viewer
// =============================================

'use strict';

// ── State ──────────────────────────────────
let allCategories  = [];   // book_Marks array
let searchIndex    = [];   // flat list for searching
let activeCategory = 0;    // index into allCategories
let activeTags     = new Set();
let searchQuery    = '';
let tagBarExpanded = false; // was renderTagBar.expanded (fragile function-property)

// ── DOM refs (resolved after DOMContentLoaded) ──
let elSearch, elClear, elCatList, elSidebarCount,
    elPanelTitle, elTagBar, elBookmarkList, elHeaderTitle;

// =============================================
// BOOT
// =============================================

window.addEventListener('DOMContentLoaded', async () => {
	elSearch       = document.getElementById('search-input');
	elClear        = document.getElementById('clear-search');
	elCatList      = document.getElementById('category-list');
	elSidebarCount = document.getElementById('sidebar-count');
	elPanelTitle   = document.getElementById('panel-title');
	elTagBar       = document.getElementById('tag-bar');
	elBookmarkList = document.getElementById('bookmark-list');
	elHeaderTitle  = document.getElementById('header-title');

	bindGlobalEvents();
	await loadData();
});

// =============================================
// DATA
// =============================================

async function loadData() {
	try {
		const res = await fetch('bookmarks.json');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();

		// Support both {book_Marks:[]} and {categories:[]} shapes
		allCategories = data.book_Marks || data.categories || [];

		if (!allCategories.length) throw new Error('No categories found in bookmarks.json');

		buildSearchIndex();
		updateHeaderCount();
		renderSidebar();

		// If arriving from info.html with ?q=domain, pre-fill search
		const urlParam = new URLSearchParams(window.location.search).get('q');
		if (urlParam) {
			elSearch.value = urlParam;
			searchQuery    = urlParam;
			elClear.classList.add('visible');
			renderSearch(searchQuery);
		} else {
			renderPanel();
		}

	} catch (err) {
		console.error('❌ Failed to load bookmarks:', err);
		showError(elBookmarkList, 'Could not load <code>bookmarks.json</code>. Place it next to index.html and serve via a local server.');
	}
}

// Flat index built once; each entry caches a pre-lowercased search string
function buildSearchIndex() {
	searchIndex = allCategories.flatMap(cat =>
		(cat.bookmarks || []).map(bm => ({
			category: cat.category,
			bookmark: bm,
			text: [bm.title, bm.description, bm.url, ...(bm.tags || [])]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
		}))
	);
}

function updateHeaderCount() {
	const total = allCategories.reduce((s, c) => s + (c.bookmarks || []).length, 0);
	if (elHeaderTitle) elHeaderTitle.textContent = `📚 ${total} Bookmarks`;
}

// =============================================
// SIDEBAR
// =============================================

function renderSidebar() {
	elSidebarCount.textContent = allCategories.length;

	// Build all items at once with a fragment — one DOM insertion
	const frag = document.createDocumentFragment();
	allCategories.forEach((cat, i) => {
		const li = document.createElement('li');
		li.innerHTML = `
			<span class="cat-label">📋 ${esc(cat.category)}</span>
			<span class="cat-badge">${(cat.bookmarks || []).length}</span>
		`;
		if (i === activeCategory) li.classList.add('active');

		li.addEventListener('click', () => {
			if (searchQuery) clearSearch();
			activeCategory = i;
			activeTags.clear();
			tagBarExpanded = false;
			highlightSidebar(i);
			renderPanel();
		});

		frag.appendChild(li);
	});

	elCatList.innerHTML = '';
	elCatList.appendChild(frag);
}

function highlightSidebar(index) {
	elCatList.querySelectorAll('li').forEach((li, i) =>
		li.classList.toggle('active', i === index)
	);
}

// =============================================
// MAIN PANEL
// =============================================

function renderPanel() {
	if (searchQuery) { renderSearch(searchQuery); return; }

	const cat = allCategories[activeCategory];
	if (!cat) return;

	// Deduplicate by URL (in-place, preserves original order)
	const seen = new Set();
	const bookmarks = (cat.bookmarks || []).filter(bm => {
		if (seen.has(bm.url)) return false;
		seen.add(bm.url);
		return true;
	});

	// Apply tag filter
	const filtered = activeTags.size
		? bookmarks.filter(bm =>
			[...activeTags].every(t => (bm.tags || []).includes(t))
		  )
		: bookmarks;

	const countLabel = filtered.length !== bookmarks.length
		? `${filtered.length} of ${bookmarks.length}`
		: filtered.length;

	elPanelTitle.innerHTML = `
		📋 ${esc(cat.category)}
		<span class="panel-count">(${countLabel})</span>
	`;

	// Collect unique tags across all (unfiltered) bookmarks
	const allTags = [...new Set(bookmarks.flatMap(bm => bm.tags || []))].sort();
	renderTagBar(allTags);
	renderCards(filtered, elBookmarkList);
}

// =============================================
// TAG BAR
// =============================================

function renderTagBar(tags) {
	elTagBar.innerHTML = '';
	if (!tags.length) return;

	const INITIAL_COUNT = 30;
	const frag = document.createDocumentFragment();

	const label = document.createElement('span');
	label.className   = 'tag-bar-label';
	label.textContent = 'Tags:';
	frag.appendChild(label);

	const visibleTags = tagBarExpanded ? tags : tags.slice(0, INITIAL_COUNT);

	visibleTags.forEach(tag => {
		const pill = document.createElement('span');
		pill.className   = 'tag-pill' + (activeTags.has(tag) ? ' active' : '');
		pill.textContent = tag;
		pill.addEventListener('click', () => {
			activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag);
			renderPanel();
		});
		frag.appendChild(pill);
	});

	if (tags.length > INITIAL_COUNT) {
		const hiddenCount = tags.length - INITIAL_COUNT;
		const toggle = document.createElement('button');
		toggle.className   = 'tag-clear';
		toggle.textContent = tagBarExpanded ? '▼ Show less' : `▶ +${hiddenCount} more`;
		toggle.addEventListener('click', () => {
			tagBarExpanded = !tagBarExpanded;
			renderTagBar(tags);
		});
		frag.appendChild(toggle);
	}

	if (activeTags.size) {
		const clr = document.createElement('button');
		clr.className   = 'tag-clear';
		clr.textContent = 'Clear filters';
		clr.addEventListener('click', () => { activeTags.clear(); renderPanel(); });
		frag.appendChild(clr);
	}

	elTagBar.appendChild(frag);
}

// =============================================
// BOOKMARK CARDS
// =============================================

function renderCards(bookmarks, container) {
	container.innerHTML = '';

	if (!bookmarks.length) {
		container.innerHTML = `
			<div class="state-empty">
				<div class="state-icon">🔍</div>
				<p>No bookmarks match your filters.</p>
			</div>`;
		return;
	}

	// DocumentFragment: one DOM write instead of N
	const frag = document.createDocumentFragment();
	bookmarks.forEach(bm => frag.appendChild(buildCard(bm, { tagClickable: true })));
	container.appendChild(frag);
}

function buildCard(bm, { tagClickable = false } = {}) {
	const a = document.createElement('a');
	a.className = 'bookmark-card';
	a.href      = bm.url;
	a.target    = '_blank';
	a.rel       = 'noopener noreferrer';

	const domain       = bm.domain;
	const displayTitle = bm.title || bm.description || bm.url;
	// Only need a custom faviconSrc when bm.icon exists; otherwise Google is both primary & fallback
	const faviconSrc   = bm.icon || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
	const fallbackSrc  = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

	a.innerHTML = `
		<img class="bm-favicon" src="${esc(faviconSrc)}" alt=""
			onerror="this.__retried?this.style.display='none':(this.__retried=true,this.src='${esc(fallbackSrc)}')">
		<div class="bm-body">
			<div class="bm-title">${esc(displayTitle)}</div>
			${bm.description && bm.description !== displayTitle
				? `<div class="bm-desc">${esc(bm.description)}</div>`
				: ''}
			${(bm.tags || []).length
				? `<div class="bm-tags">${bm.tags.map(t =>
					`<span class="bm-tag" data-tag="${esc(t)}">${esc(t)}</span>`
				  ).join('')}</div>`
				: ''}
			<div class="bm-domain">${esc(domain)}</div>
		</div>`;

	if (tagClickable) {
		a.querySelectorAll('.bm-tag').forEach(el => {
			el.addEventListener('click', e => {
				e.preventDefault();
				e.stopPropagation();
				activeTags.add(el.dataset.tag);
				renderPanel();
			});
		});
	}

	return a;
}

// =============================================
// SEARCH
// =============================================

function renderSearch(query) {
	const q       = query.toLowerCase();
	const results = searchIndex.filter(item => item.text.includes(q));

	elPanelTitle.innerHTML = `
		🔍 Results for <em style="color:var(--accent)">"${esc(query)}"</em>
		<span class="panel-count">(${results.length})</span>
	`;
	elTagBar.innerHTML = '';

	if (!results.length) {
		elBookmarkList.innerHTML = `
			<div class="state-empty">
				<div class="state-icon">📭</div>
				<p>No bookmarks found for <strong>${esc(query)}</strong>.</p>
			</div>`;
		return;
	}

	// Group by category — Map preserves insertion order
	const groups = new Map();
	results.forEach(({ category, bookmark }) => {
		if (!groups.has(category)) groups.set(category, []);
		groups.get(category).push(bookmark);
	});

	const frag = document.createDocumentFragment();
	groups.forEach((bms, catName) => {
		const header = document.createElement('div');
		header.className   = 'search-group-header';
		header.textContent = `📋 ${catName}`;
		frag.appendChild(header);

		// Deduplicate within search results
		const seen = new Set();
		bms.forEach(bm => {
			if (seen.has(bm.url)) return;
			seen.add(bm.url);
			frag.appendChild(buildCard(bm));
		});
	});

	elBookmarkList.innerHTML = '';
	elBookmarkList.appendChild(frag);
}

// =============================================
// EVENTS
// =============================================

function bindGlobalEvents() {
	elSearch.addEventListener('input', () => {
		searchQuery = elSearch.value.trim();
		elClear.classList.toggle('visible', searchQuery.length > 0);

		if (!searchQuery) {
			highlightSidebar(activeCategory);
			renderPanel();
		} else {
			elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
			renderSearch(searchQuery);
		}
	});

	elClear.addEventListener('click', clearSearch);

	document.addEventListener('keydown', e => {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			elSearch.focus();
			elSearch.select();
		}
		if (e.key === 'Escape' && document.activeElement === elSearch) {
			clearSearch();
		}
	});
}

function clearSearch() {
	elSearch.value = '';
	searchQuery    = '';
	elClear.classList.remove('visible');
	activeTags.clear();
	highlightSidebar(activeCategory);
	renderPanel();
	elSearch.blur();
}

// =============================================
// UTILS
// =============================================

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function showError(container, msg) {
	container.innerHTML = `
		<div class="state-empty">
			<div class="state-icon">❌</div>
			<p>${msg}</p>
		</div>`;
}

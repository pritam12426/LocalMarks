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
			searchQuery = urlParam;
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

function buildSearchIndex() {
	searchIndex = [];
	allCategories.forEach(cat => {
		(cat.bookmarks || []).forEach(bm => {
			searchIndex.push({
				category: cat.category,
				bookmark: bm,
				text: [
					bm.title || '',
					bm.description || '',
					bm.url || '',
					...(bm.tags || [])
				].join(' ').toLowerCase()
			});
		});
	});
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
	elCatList.innerHTML = '';

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
			highlightSidebar(i);
			renderPanel();
		});

		elCatList.appendChild(li);
	});
}

function highlightSidebar(index) {
	elCatList.querySelectorAll('li').forEach((li, i) => {
		li.classList.toggle('active', i === index);
	});
}

// =============================================
// MAIN PANEL
// =============================================

function renderPanel() {
	if (searchQuery) {
		renderSearch(searchQuery);
		return;
	}

	const cat = allCategories[activeCategory];
	if (!cat) return;

	// Deduplicate by URL
	const seen = new Set();
	const bookmarks = (cat.bookmarks || []).filter(bm => {
		if (seen.has(bm.url)) return false;
		seen.add(bm.url);
		return true;
	});

	// Apply tag filter
	const filtered = activeTags.size
		? bookmarks.filter(bm => [...activeTags].every(t => (bm.tags || []).includes(t)))
		: bookmarks;

	// Panel title
	elPanelTitle.innerHTML = `
		📋 ${esc(cat.category)}
		<span class="panel-count">(${filtered.length}${filtered.length !== bookmarks.length ? ` of ${bookmarks.length}` : ''})</span>
	`;

	// Tag bar
	const allTags = [...new Set(bookmarks.flatMap(bm => bm.tags || []))].sort();
	renderTagBar(allTags);

	// Cards
	renderCards(filtered, elBookmarkList);
}

// =============================================
// TAG BAR
// =============================================

function renderTagBar(tags) {
	elTagBar.innerHTML = '';
	if (!tags.length) return;

	const label = document.createElement('span');
	label.className = 'tag-bar-label';
	label.textContent = 'Tags:';
	elTagBar.appendChild(label);

	tags.forEach(tag => {
		const pill = document.createElement('span');
		pill.className = 'tag-pill' + (activeTags.has(tag) ? ' active' : '');
		pill.textContent = '#' + tag;
		pill.addEventListener('click', () => {
			activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag);
			renderPanel();
		});
		elTagBar.appendChild(pill);
	});

	if (activeTags.size) {
		const clr = document.createElement('button');
		clr.className = 'tag-clear';
		clr.textContent = 'Clear filters';
		clr.addEventListener('click', () => { activeTags.clear(); renderPanel(); });
		elTagBar.appendChild(clr);
	}
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

	bookmarks.forEach(bm => {
		container.appendChild(buildCard(bm, { tagClickable: true }));
	});
}

function buildCard(bm, { tagClickable = false } = {}) {
	const a = document.createElement('a');
	a.className = 'bookmark-card';
	a.href      = bm.url;
	a.target    = '_blank';
	a.rel       = 'noopener noreferrer';

	const domain       = bm.domain;
	// const displayTitle = bm.title || bm.description || bm.url || domain;
	const displayTitle = bm.title || bm.description || bm.url;
	const faviconSrc   = bm.icon || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
	// Fallback chain: bm.icon → google favicon → hidden
	const fallbackSrc  = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

	a.innerHTML = `
		<img class="bm-favicon" src="${esc(faviconSrc)}" alt=""
				 onerror="this.__retried ? this.style.display='none' : (this.__retried=true, this.src='${esc(fallbackSrc)}')">
		<div class="bm-body">
			<div class="bm-title">${esc(displayTitle)}</div>
			${bm.description && bm.description !== displayTitle
				? `<div class="bm-desc">${esc(bm.description)}</div>`
				: ''}
			${(bm.tags || []).length
				? `<div class="bm-tags">${(bm.tags).map(t =>
						`<span class="bm-tag" data-tag="${esc(t)}">#${esc(t)}</span>`
					).join('')}</div>`
				: ''}
			<div class="bm-domain">${esc(domain)}</div>
		</div>`;

	// Tags on cards trigger sidebar filter (only on index page)
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
	const q = query.toLowerCase();
	const results = searchIndex.filter(item => item.text.includes(q));

	elPanelTitle.innerHTML = `
		🔍 Results for <em style="color:var(--accent)">"${esc(query)}"</em>
		<span class="panel-count">(${results.length})</span>
	`;
	elTagBar.innerHTML = '';
	elBookmarkList.innerHTML = '';

	if (!results.length) {
		elBookmarkList.innerHTML = `
			<div class="state-empty">
				<div class="state-icon">📭</div>
				<p>No bookmarks found for <strong>${esc(query)}</strong>.</p>
			</div>`;
		return;
	}

	// Group by category
	const groups = {};
	results.forEach(item => {
		(groups[item.category] = groups[item.category] || []).push(item.bookmark);
	});

	Object.entries(groups).forEach(([catName, bms]) => {
		const header = document.createElement('div');
		header.className = 'search-group-header';
		header.textContent = `📋 ${catName}`;
		elBookmarkList.appendChild(header);

		// Deduplicate within search results
		const seen = new Set();
		bms.filter(bm => {
			if (seen.has(bm.url)) return false;
			seen.add(bm.url);
			return true;
		}).forEach(bm => {
			elBookmarkList.appendChild(buildCard(bm));
		});
	});
}

// =============================================
// EVENTS
// =============================================

function bindGlobalEvents() {
	// Search input
	elSearch.addEventListener('input', () => {
		searchQuery = elSearch.value.trim();
		elClear.classList.toggle('visible', searchQuery.length > 0);

		if (!searchQuery) {
			// Return to category view
			highlightSidebar(activeCategory);
			renderPanel();
		} else {
			// Deselect sidebar when searching
			elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
			renderSearch(searchQuery);
		}
	});

	// Clear button
	elClear.addEventListener('click', clearSearch);

	// Ctrl/Cmd + K
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
	searchQuery = '';
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

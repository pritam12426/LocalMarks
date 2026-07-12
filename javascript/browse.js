// =============================================
// browse.js  —  Bookmark browser view
// =============================================

'use strict';

import { esc, getFavorites, buildCard } from './data.js';

// ── State ──────────────────────────────────
let allCategories  = [];
let searchIndex    = [];
let activeCategory = 0;
let activeTags     = new Set();
let searchQuery    = '';
let tagBarExpanded = false;
let renderSidebar  = null; // filled below
let renderPanel    = null;

// Keyboard navigation state
let focusedCardIndex = -1;
let cards            = [];
let searchDebounceTimer = null;

// ── DOM refs ──
let elSearch, elClear, elCatList, elSidebarCount,
    elPanelTitle, elTagBar, elBookmarkList, elHeaderTitle;

export function initBrowse(data) {
	elSearch       = document.getElementById('search-input');
	elClear        = document.getElementById('clear-search');
	elCatList      = document.getElementById('category-list');
	elSidebarCount = document.getElementById('sidebar-count');
	elPanelTitle   = document.getElementById('panel-title');
	elTagBar       = document.getElementById('tag-bar');
	elBookmarkList = document.getElementById('bookmark-list');
	elHeaderTitle  = document.getElementById('header-title');

	allCategories = data.book_Marks || data.categories || [];

	buildSearchIndex();
	updateHeaderCount();
	renderSidebar();
	bindEvents();
	initKeyboardNav();
}

export function renderBrowse() {
	const q = elSearch.value.trim();
	if (q) {
		searchQuery = q;
		elClear.classList.add('visible');
		elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
		renderSearch(q);
	} else if (searchQuery) {
		renderSearch(searchQuery);
	} else {
		renderPanel();
	}
}

// ── Data ───────────────────────────────────

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

// ── Favorites count helper ──

function getFavoritesCount() {
	const favUrls = new Set(getFavorites());
	const seen    = new Set();
	let count     = 0;
	for (const cat of allCategories) {
		for (const bm of (cat.bookmarks || [])) {
			if (favUrls.has(bm.url) && !seen.has(bm.url)) {
				seen.add(bm.url);
				count++;
			}
		}
	}
	return count;
}

// ── Sidebar ────────────────────────────────

renderSidebar = function() {
	const favCount = getFavoritesCount();
	if (activeCategory === -1 && !favCount) activeCategory = 0;
	elSidebarCount.textContent = allCategories.length;

	const frag = document.createDocumentFragment();

	if (favCount) {
		const li = document.createElement('li');
		li.innerHTML = `<span class="cat-label">⭐ Favorites</span><span class="cat-badge">${favCount}</span>`;
		if (activeCategory === -1) li.classList.add('active');
		li.tabIndex = 0;
		li.setAttribute('role', 'button');
		li.setAttribute('aria-label', `Favorites, ${favCount} bookmarks`);
		li.addEventListener('click', () => {
			if (searchQuery) clearSearch();
			activeCategory = -1;
			activeTags.clear();
			tagBarExpanded = false;
			highlightSidebar(-1);
			renderPanel();
		});
		li.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				li.click();
			}
		});
		frag.appendChild(li);
	}

	allCategories.forEach((cat, i) => {
		const li = document.createElement('li');
		li.innerHTML = `
			<span class="cat-label">📋 ${esc(cat.category)}</span>
			<span class="cat-badge">${(cat.bookmarks || []).length}</span>
		`;
		if (i === activeCategory) li.classList.add('active');
		li.tabIndex = 0;
		li.setAttribute('role', 'button');
		li.setAttribute('aria-label', `${cat.category}, ${(cat.bookmarks || []).length} bookmarks`);

		li.addEventListener('click', () => {
			if (searchQuery) clearSearch();
			activeCategory = i;
			activeTags.clear();
			tagBarExpanded = false;
			highlightSidebar(i);
			renderPanel();
		});
		li.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				li.click();
			}
		});

		frag.appendChild(li);
	});

	elCatList.innerHTML = '';
	elCatList.appendChild(frag);
};

function highlightSidebar(index) {
	const hasFavs = getFavoritesCount() > 0;
	elCatList.querySelectorAll('li').forEach((li, i) => {
		const targetIdx = hasFavs ? i - 1 : i;
		li.classList.toggle('active', targetIdx === index);
	});
}

// ── Panel ──────────────────────────────────

renderPanel = function() {
	if (searchQuery) { renderSearch(searchQuery); return; }

	if (activeCategory === -1) {
		const favUrls = getFavorites();
		let bookmarks = allCategories.flatMap(cat =>
			(cat.bookmarks || []).filter(bm => favUrls.includes(bm.url))
		);
		const seen = new Set();
		bookmarks = bookmarks.filter(bm => {
			if (seen.has(bm.url)) return false;
			seen.add(bm.url);
			return true;
		});

		elPanelTitle.innerHTML = `⭐ Favorites <span class="panel-count">(${bookmarks.length})</span>`;
		const allTags = [...new Set(bookmarks.flatMap(bm => bm.tags || []))].sort();
		renderTagBar(allTags);
		renderCards(bookmarks, elBookmarkList);
		return;
	}

	const cat = allCategories[activeCategory];
	if (!cat) return;

	const seen = new Set();
	const bookmarks = (cat.bookmarks || []).filter(bm => {
		if (seen.has(bm.url)) return false;
		seen.add(bm.url);
		return true;
	});

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

	const allTags = [...new Set(bookmarks.flatMap(bm => bm.tags || []))].sort();
	renderTagBar(allTags);
	renderCards(filtered, elBookmarkList);
};

// ── Tag bar ────────────────────────────────

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
		const toggle = document.createElement('button');
		toggle.className   = 'tag-clear';
		toggle.textContent = tagBarExpanded ? '▼ Show less' : `▶ +${tags.length - INITIAL_COUNT} more`;
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

// ── Cards ──────────────────────────────────

function renderCards(bookmarks, container) {
	container.innerHTML = '';

	if (!bookmarks.length) {
		container.innerHTML = `
			<div class="state-empty">
				<div class="state-icon">🔍</div>
				<p>No bookmarks match your filters.</p>
				<button class="state-action" onclick="document.querySelector('.tag-clear')?.click()">Clear all filters</button>
			</div>`;
		return;
	}

	const frag = document.createDocumentFragment();
	bookmarks.forEach(bm => frag.appendChild(buildCard(bm, {
		tagClickable: true,
		onTagClick: tag => { activeTags.add(tag); renderPanel(); }
	})));
	container.appendChild(frag);
	refreshCards();
}

// ── Search ─────────────────────────────────

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
				<button class="state-action" onclick="document.getElementById('clear-search')?.click()">Clear search</button>
			</div>`;
		return;
	}

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

		const seen = new Set();
		bms.forEach(bm => {
			if (seen.has(bm.url)) return;
			seen.add(bm.url);
			frag.appendChild(buildCard(bm, {
				tagClickable: true,
				onTagClick: tag => { activeTags.add(tag); renderPanel(); }
			}));
		});
	});

	elBookmarkList.innerHTML = '';
	elBookmarkList.appendChild(frag);
	refreshCards();
}

// ── Events ─────────────────────────────────

function bindEvents() {
	elClear.addEventListener('click', clearSearch);

	window.addEventListener('favorites-changed', () => {
		const wasFavView = activeCategory === -1;
		renderSidebar();
		if (wasFavView) renderPanel();
	});

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
	if (activeCategory === -1) {
		elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
		const first = elCatList.firstElementChild;
		if (first) first.classList.add('active');
	} else {
		highlightSidebar(activeCategory);
	}
	renderPanel();
	elSearch.blur();
}

// ── Keyboard Navigation ─────────────────────────────────

function initKeyboardNav() {
	document.addEventListener('keydown', handleGlobalKeys);
	elBookmarkList.addEventListener('keydown', handleListKeys);
	elCatList.addEventListener('keydown', handleSidebarKeys);
	elSearch.addEventListener('input', handleSearchInput);
	elSearch.addEventListener('keydown', handleSearchKeydown);
}

function handleGlobalKeys(e) {
	// While the help modal is open, only Escape/? do anything here —
	// its own listener handles the rest and stops propagation.
	if (isHelpOpen()) {
		if (e.key === 'Escape' || e.key === '?') {
			e.preventDefault();
			closeKeyboardHelp();
		}
		return;
	}

	const inField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

	// '/' jumps to search from anywhere — the search box lives in the shared
	// header, not inside the Browse view, so this one isn't route-gated.
	if (e.key === '/' && !inField) {
		e.preventDefault();
		elSearch.focus();
		elSearch.select();
		return;
	}

	// The rest only make sense while the Browse view is actually on screen —
	// Info/Random have their own content (or no cards/sidebar at all), so
	// don't let vim keys silently poke at hidden state there.
	if (!document.body.classList.contains('route-browse')) return;

	// Don't intercept when typing in inputs
	if (inField) {
		if (e.key === 'Escape' && e.target === elSearch) {
			clearSearch();
		}
		return;
	}

	// Vim-style navigation
	switch (e.key.toLowerCase()) {
		case 'j':
			e.preventDefault();
			focusNextCard();
			break;
		case 'k':
			e.preventDefault();
			focusPrevCard();
			break;
		case 'h':
			// From link-selector mode → back to category selector
			e.preventDefault();
			focusSidebar();
			break;
		case 'l':
			// From category-selector mode → into link selector.
			// If we're already among the cards, don't yank focus back to #1.
			e.preventDefault();
			if (focusedCardIndex === -1) focusFirstCard();
			break;
		case 'g':
			if (e.shiftKey) { // G
				e.preventDefault();
				focusLastCard();
			} else if (lastKey === 'g') { // gg
				e.preventDefault();
				focusFirstCard();
			}
			break;
		case '?':
			e.preventDefault();
			showKeyboardHelp();
			break;
		case 'enter':
			if (focusedCardIndex >= 0 && cards[focusedCardIndex]) {
				e.preventDefault();
				cards[focusedCardIndex].click();
			}
			break;
		case 'escape':
			clearSearch();
			blurCards();
			break;
	}
	lastKey = e.key.toLowerCase();
}

let lastKey = '';

function handleSearchInput() {
	clearTimeout(searchDebounceTimer);
	searchDebounceTimer = setTimeout(() => {
		searchQuery = elSearch.value.trim();
		elClear.classList.toggle('visible', searchQuery.length > 0);

		// Typing a search from Info/Random should actually show it, not just
		// update Browse's hidden DOM in the background.
		if (searchQuery && !document.body.classList.contains('route-browse')) {
			location.hash = '#browse';
		}

		if (!searchQuery) {
			highlightSidebar(activeCategory);
			renderPanel();
		} else {
			elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
			renderSearch(searchQuery);
		}
	}, 300);
}

function handleSearchKeydown(e) {
	if (e.key === 'Enter') {
		e.preventDefault();
		// Force immediate search render, then focus first result
		clearTimeout(searchDebounceTimer);
		searchQuery = elSearch.value.trim();
		elClear.classList.toggle('visible', searchQuery.length > 0);

		if (searchQuery && !document.body.classList.contains('route-browse')) {
			location.hash = '#browse';
		}

		if (!searchQuery) {
			highlightSidebar(activeCategory);
			renderPanel();
		} else {
			elCatList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
			renderSearch(searchQuery);
		}

		elSearch.blur();
		setTimeout(() => {
			focusFirstCard();
		}, 50);
	}
}

// j/k inside the category list: move AND select, like arrow-keying a menu
function handleSidebarKeys(e) {
	if (e.key !== 'j' && e.key !== 'k' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

	const items = Array.from(elCatList.querySelectorAll('li'));
	if (!items.length) return;

	const current = items.indexOf(document.activeElement);
	const step    = (e.key === 'j' || e.key === 'ArrowDown') ? 1 : -1;
	const next    = current + step;

	if (next < 0 || next >= items.length) return; // no wrap-around

	e.preventDefault();
	e.stopPropagation();

	items[next].focus();
	items[next].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	items[next].click(); // reuses the existing click handler to actually switch category
}

function handleListKeys(e) {
	if (e.target.closest('.bm-star') || e.target.closest('.bm-tag')) return;

	switch (e.key) {
		case 'j':
		case 'ArrowDown':
			e.preventDefault();
			e.stopPropagation();
			focusNextCard();
			break;
		case 'k':
		case 'ArrowUp':
			e.preventDefault();
			e.stopPropagation();
			focusPrevCard();
			break;
		case 'Enter':
			if (focusedCardIndex >= 0 && cards[focusedCardIndex]) {
				e.preventDefault();
				e.stopPropagation();
				cards[focusedCardIndex].click();
			}
			break;
		case 'Escape':
			e.stopPropagation();
			blurCards();
			elSearch.focus();
			break;
	}
}

function refreshCards() {
	cards = Array.from(elBookmarkList.querySelectorAll('.bookmark-card'));
	// Clamp focused index
	if (focusedCardIndex >= cards.length) focusedCardIndex = cards.length - 1;
	if (focusedCardIndex < -1) focusedCardIndex = -1;
	updateCardFocus();
}

function focusFirstCard() {
	refreshCards();
	if (cards.length) {
		focusedCardIndex = 0;
		updateCardFocus();
		cards[0].focus({ preventScroll: true });
		cards[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

function focusLastCard() {
	refreshCards();
	if (cards.length) {
		focusedCardIndex = cards.length - 1;
		updateCardFocus();
		cards[focusedCardIndex].focus({ preventScroll: true });
		cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

function focusNextCard() {
	refreshCards();
	if (cards.length === 0) return;
	if (focusedCardIndex < cards.length - 1) {
		focusedCardIndex++;
		updateCardFocus();
		cards[focusedCardIndex].focus({ preventScroll: true });
		cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

function focusPrevCard() {
	refreshCards();
	if (cards.length === 0) return;
	if (focusedCardIndex > 0) {
		focusedCardIndex--;
		updateCardFocus();
		cards[focusedCardIndex].focus({ preventScroll: true });
		cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	} else if (focusedCardIndex === 0) {
		// Go back to sidebar
		blurCards();
		focusSidebar();
	}
}

function blurCards() {
	focusedCardIndex = -1;
	updateCardFocus();
}

function updateCardFocus() {
	cards.forEach((card, i) => {
		const isFocused = i === focusedCardIndex;
		card.classList.toggle('focused', isFocused);
		if (isFocused) {
			card.setAttribute('aria-selected', 'true');
			card.tabIndex = 0;
		} else {
			card.removeAttribute('aria-selected');
			card.tabIndex = -1;
		}
	});
}

function focusSidebar() {
	blurCards();
	const activeLi = elCatList.querySelector('li.active');
	if (activeLi) {
		activeLi.focus();
		activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

// ── Keyboard help modal ─────────────────────

let helpModal = null;

function ensureHelpModal() {
	if (helpModal) return helpModal;

	const overlay = document.createElement('div');
	overlay.className = 'modal-overlay';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'Keyboard shortcuts');

	overlay.innerHTML = `
		<div class="modal-box">
			<button class="modal-close" aria-label="Close">✕</button>
			<div class="keyboard-help">
				<h3>⌨️ Keyboard Shortcuts</h3>
				<table>
					<tr><td><kbd>j</kbd> / <kbd>↓</kbd></td><td>Next bookmark</td></tr>
					<tr><td><kbd>k</kbd> / <kbd>↑</kbd></td><td>Previous bookmark</td></tr>
					<tr><td><kbd>h</kbd></td><td>Back to categories</td></tr>
					<tr><td><kbd>l</kbd></td><td>Into bookmarks</td></tr>
					<tr><td><kbd>gg</kbd></td><td>Jump to first bookmark</td></tr>
					<tr><td><kbd>G</kbd> (<kbd>Shift+G</kbd>)</td><td>Jump to last bookmark</td></tr>
					<tr><td><kbd>/</kbd></td><td>Focus search</td></tr>
					<tr><td><kbd>Enter</kbd></td><td>Open focused bookmark</td></tr>
					<tr><td><kbd>Esc</kbd></td><td>Clear search / close this window</td></tr>
					<tr><td><kbd>?</kbd></td><td>Toggle this help window</td></tr>
					<tr><td><kbd>Ctrl/Cmd+K</kbd></td><td>Focus search</td></tr>
				</table>
			</div>
		</div>
	`;

	overlay.addEventListener('click', e => {
		if (e.target === overlay) closeKeyboardHelp();
	});
	overlay.querySelector('.modal-close').addEventListener('click', closeKeyboardHelp);
	overlay.addEventListener('keydown', e => {
		if (e.key === 'Escape') {
			e.stopPropagation();
			closeKeyboardHelp();
		}
	});

	document.body.appendChild(overlay);
	helpModal = overlay;
	return overlay;
}

function isHelpOpen() {
	return !!(helpModal && helpModal.classList.contains('open'));
}

function showKeyboardHelp() {
	const modal = ensureHelpModal();
	modal.classList.add('open');
	modal.querySelector('.modal-close').focus();
}

function closeKeyboardHelp() {
	if (!helpModal) return;
	helpModal.classList.remove('open');
	if (focusedCardIndex >= 0 && cards[focusedCardIndex]) {
		cards[focusedCardIndex].focus({ preventScroll: true });
	} else {
		focusSidebar();
	}
}

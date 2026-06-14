'use strict';

const elCount   = document.getElementById('random-count');
const elTag     = document.getElementById('random-tag');
const elGo      = document.getElementById('random-go');
const elResults = document.getElementById('random-results');

let allBookmarks = [];

fetch('bookmarks.json')
	.then(r => r.json())
	.then(data => {
		const cats = data.book_Marks || data.categories || [];
		allBookmarks = cats.flatMap(c =>
			(c.bookmarks || []).map(bm => ({ ...bm, _category: c.category || '' }))
		);

		// Build tag datalist
		const allTags  = [...new Set(allBookmarks.flatMap(b => b.tags || []))].sort();
		const datalist = document.createElement('datalist');
		datalist.id    = 'tag-suggestions';
		// Fragment for tag options
		const frag = document.createDocumentFragment();
		allTags.forEach(t => {
			const opt = document.createElement('option');
			opt.value = t;
			frag.appendChild(opt);
		});
		datalist.appendChild(frag);
		document.body.appendChild(datalist);
		elTag.setAttribute('list', 'tag-suggestions');
	})
	.catch(() => {
		elResults.innerHTML = '<div class="state-empty"><div class="state-icon">❌</div><p>Could not load bookmarks.json</p></div>';
	});

// Fisher-Yates partial shuffle — O(n) but only iterates k times, no full array copy
function pickRandom(arr, k) {
	const copy   = [...arr];
	const result = [];
	const count  = Math.min(k, copy.length);
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(Math.random() * (copy.length - i));
		[copy[i], copy[j]] = [copy[j], copy[i]];
		result.push(copy[i]);
	}
	return result;
}

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildCard(bm) {
	const a = document.createElement('a');
	a.className = 'bookmark-card';
	a.href      = bm.url;
	a.target    = '_blank';
	a.rel       = 'noopener noreferrer';

	const domain  = bm.domain || new URL(bm.url).hostname;
	const title   = bm.title || bm.description || bm.url;
	const favicon = bm.icon  || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

	a.innerHTML = `
		<img class="bm-favicon" src="${esc(favicon)}" alt=""
			onerror="this.style.display='none'">
		<div class="bm-body">
			<div class="bm-title" style="color:var(--accent)">${esc(title)}</div>
			${bm.description && bm.description !== title
				? `<div class="bm-desc">${esc(bm.description)}</div>`
				: ''}
			${(bm.tags || []).length
				? `<div class="bm-tags">${bm.tags.map(t =>
					`<span class="bm-tag">${esc(t)}</span>`
				  ).join('')}</div>`
				: ''}
			<div class="bm-domain">${esc(domain)}${bm._category ? `  ·  📋 ${esc(bm._category)}` : ''}</div>
		</div>`;
	return a;
}

function render() {
	const n = parseInt(elCount.value, 10);
	if (!n || n < 1) return;

	const tagFilter = elTag.value.trim().toLowerCase();
	const pool = tagFilter
		? allBookmarks.filter(bm =>
			(bm.tags || []).some(t => t.toLowerCase().includes(tagFilter))
		  )
		: allBookmarks;

	const picked = pickRandom(pool, n);
	elResults.innerHTML = '';

	if (!picked.length) {
		elResults.innerHTML = `<div class="state-empty"><div class="state-icon">📭</div><p>${
			tagFilter
				? `No bookmarks tagged "${esc(elTag.value.trim())}".`
				: 'No bookmarks loaded.'
		}</p></div>`;
		return;
	}

	const frag = document.createDocumentFragment();
	picked.forEach(bm => frag.appendChild(buildCard(bm)));
	elResults.appendChild(frag);
}

function triggerOnEnter(e) { if (e.key === 'Enter') render(); }

elGo.addEventListener('click', render);
elCount.addEventListener('keydown', triggerOnEnter);
elTag.addEventListener('keydown', triggerOnEnter);

// =============================================
// info.js	—	LocalMarks database stats page
// =============================================

'use strict';

// =============================================
// BOOT
// =============================================

window.addEventListener('DOMContentLoaded', loadInfo);

async function loadInfo() {
	try {
		const res = await fetch('bookmarks.json');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();

		const categories = data.book_Marks || data.categories || [];
		const hashRaw		= (data.book_mark_domain_hash || [{}])[0] || {};

		renderStats(categories, hashRaw);
		renderCategoryChart(categories);
		renderTagCloud(categories);
		renderDomainGrid(hashRaw);

	} catch (err) {
		console.error('❌ info.js failed:', err);
		document.getElementById('domain-grid').innerHTML =
			`<p style="color:var(--muted)">Could not load bookmarks.json — ${esc(err.message)}</p>`;
	}
}

// =============================================
// STATS STRIP
// =============================================

function renderStats(categories, hashRaw) {
	const allBookmarks = categories.flatMap(c => c.bookmarks || []);
	const uniqueUrls	 = new Set(allBookmarks.map(b => b.url)).size;
	const allTags			= new Set(allBookmarks.flatMap(b => b.tags || []));
	const domains			= Object.keys(hashRaw).length;

	set('stat-total',	 allBookmarks.length);
	set('stat-unique',	uniqueUrls);
	set('stat-cats',		categories.length);
	set('stat-domains', domains);
	set('stat-tags',		allTags.size);
}

// =============================================
// CATEGORY BREAKDOWN
// =============================================

function renderCategoryChart(categories) {
	const container = document.getElementById('cat-breakdown');
	const max = Math.max(...categories.map(c => (c.bookmarks || []).length), 1);

	container.innerHTML = categories.map(cat => {
		const count = (cat.bookmarks || []).length;
		const pct	 = Math.round(count / max * 100);
		return `
			<div class="cat-row">
				<div class="cat-row-name" title="${esc(cat.category)}">📋 ${esc(cat.category)}</div>
				<div class="cat-row-track">
					<div class="cat-row-bar" style="width:${pct}%"></div>
				</div>
				<div class="cat-row-num">${count}</div>
			</div>`;
	}).join('');
}

// =============================================
// TAG CLOUD
// =============================================

function renderTagCloud(categories) {
	const container = document.getElementById('tag-breakdown');
	const allBookmarks = categories.flatMap(c => c.bookmarks || []);

	// Count tag occurrences
	const counts = {};
	allBookmarks.forEach(bm => {
		(bm.tags || []).forEach(tag => {
			counts[tag] = (counts[tag] || 0) + 1;
		});
	});

	const sorted = Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 60);	 // show top 60 tags max

	if (!sorted.length) {
		container.innerHTML = '<p style="color:var(--muted);font-size:12px">No tags found.</p>';
		return;
	}

	container.innerHTML = `
		<div class="tag-cloud">
			${sorted.map(([tag, count]) =>
				`<div class="tag-cloud-item">
					#${esc(tag)}
					<span class="tc-count">${count}</span>
				</div>`
			).join('')}
		</div>`;
}

// =============================================
// DOMAIN GRID
// =============================================

function renderDomainGrid(hashRaw) {
	const domains = Object.entries(hashRaw).sort((a, b) => b[1] - a[1]);

	const label = document.getElementById('domain-count-label');
	if (label) label.textContent = domains.length;

	const container = document.getElementById('domain-grid');

	if (!domains.length) {
		container.innerHTML = '<p style="color:var(--muted);font-size:12px">No domain data in book_mark_domain_hash.</p>';
		return;
	}

	container.innerHTML = domains.map(([domain, count]) => `
		<div class="domain-card">
			<div class="domain-card-header">
				<img
					src="https://www.google.com/s2/favicons?sz=32&domain=${esc(domain)}"
					alt=""
					loading="lazy"
					onerror="this.style.display='none'"
				>
				<div class="domain-card-name" title="${esc(domain)}">${esc(domain)}</div>
			</div>
			<div class="domain-card-count">${count}</div>
			<div class="domain-card-label">bookmark${count !== 1 ? 's' : ''}</div>
		</div>
	`).join('');
}

// =============================================
// UTILS
// =============================================

function set(id, val) {
	const el = document.getElementById(id);
	if (el) el.textContent = val;
}

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

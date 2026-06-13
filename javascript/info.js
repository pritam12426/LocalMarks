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
		const domainHash = (data.book_mark_domain_hash || {});
		const tagHash    = (data.book_mark_tag_hash    || {});

		renderStats(categories, domainHash, tagHash);
		renderCategoryChart(categories);
		renderTagCloud(tagHash);
		renderDomainGrid(domainHash);

	} catch (err) {
		console.error('❌ info.js failed:', err);
		document.getElementById('domain-grid').innerHTML =
			`<p style="color:var(--muted)">Could not load bookmarks.json — ${esc(err.message)}</p>`;
	}
}

// =============================================
// STATS STRIP
// =============================================

function renderStats(categories, domainHash, tagHash) {
	const allBookmarks = categories.flatMap(c => c.bookmarks || []);
	const uniqueUrls   = new Set(allBookmarks.map(b => b.url)).size;
	const domains      = Object.keys(domainHash).length;
	const uniqueTags   = Object.keys(tagHash).length;

	set('stat-total',   allBookmarks.length);
	set('stat-unique',  uniqueUrls);
	set('stat-cats',    categories.length);
	set('stat-domains', domains);
	set('stat-tags',    uniqueTags);
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
// TAG CLOUD  (uses book_mark_tag_hash directly)
// =============================================

function renderTagCloud(tagHash) {
	const container = document.getElementById('tag-breakdown');

	const sorted = Object.entries(tagHash)
		.sort((a, b) => b[1] - a[1]);

	if (!sorted.length) {
		container.innerHTML =
			'<p style="color:var(--muted);font-size:12px">No tags found.</p>';
		return;
	}

	const INITIAL_COUNT = 35;
	let expanded = false;

	function render() {
		const visible = expanded
			? sorted
			: sorted.slice(0, INITIAL_COUNT);

		const hiddenCount = Math.max(
			0,
			sorted.length - INITIAL_COUNT
		);

		container.innerHTML = `
			<div class="tag-cloud">
				${visible.map(([tag, count]) => `
					<div class="tag-cloud-item" data-tag="${esc(tag)}">
						${esc(tag)}
						<span class="tc-count">${count}</span>
					</div>
				`).join('')}
			</div>

			${hiddenCount > 0 ? `
				<div class="tag-cloud-toggle">
					${expanded
						? '▼ Show less'
						: `▶ +${hiddenCount} more tags`}
				</div>
			` : ''}
		`;

		// Tag click handlers
		container.querySelectorAll('.tag-cloud-item').forEach(card => {
			card.addEventListener('click', () => {
				const tag = card.dataset.tag;
				window.location.href =
					`index.html?q=${encodeURIComponent(tag)}`;
			});
		});

		// Fold/unfold handler
		const toggle = container.querySelector('.tag-cloud-toggle');
		if (toggle) {
			toggle.addEventListener('click', () => {
				expanded = !expanded;
				render();
			});
		}
	}

	render();
}

// =============================================
// DOMAIN GRID
// =============================================

function renderDomainGrid(domainHash) {
	const domains = Object.entries(domainHash).sort((a, b) => b[1] - a[1]);

	const label = document.getElementById('domain-count-label');
	if (label) label.textContent = domains.length;

	const container = document.getElementById('domain-grid');

	if (!domains.length) {
		container.innerHTML = '<p style="color:var(--muted);font-size:12px">No domain data in book_mark_domain_hash.</p>';
		return;
	}

	// Build cards — clicking navigates to index.html with ?q=domain pre-filled
	container.innerHTML = domains.map(([domain, count]) => `
		<div class="domain-card" data-domain="${esc(domain)}" title="Search all bookmarks from ${esc(domain)}" style="cursor:pointer">
			<div class="domain-card-header">
				<img
					src="https://www.google.com/s2/favicons?sz=32&domain=${esc(domain)}"
					alt=""
					loading="lazy"
					onerror="this.style.display='none'"
				>
				<div class="domain-card-name">${esc(domain)}</div>
			</div>
			<div class="domain-card-count">${count}</div>
			<div class="domain-card-label">bookmark${count !== 1 ? 's' : ''}</div>
			<div class="domain-card-hint">🔍 search</div>
		</div>
	`).join('');

	// Attach click handlers after rendering
	container.querySelectorAll('.domain-card').forEach(card => {
		card.addEventListener('click', () => {
			const domain = card.dataset.domain;
			// Navigate to index.html with the domain pre-filled in the search bar
			window.location.href = `index.html?q=${encodeURIComponent(domain)}`;
		});
	});
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

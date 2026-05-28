// =============================================
// script.js
// Bookmark Viewer
// =============================================

let allBookmarksData = [];
let allDomainsData = [];
let searchIndex = [];

// ------------------------------------------------
// Search Index
// ------------------------------------------------

function buildSearchIndex() {
	console.log("🔍 Building search index...");

	searchIndex = [];

	allBookmarksData.forEach(category => {
		category.bookmarks.forEach(bookmark => {
			searchIndex.push({
				category: category.category,
				bookmark,
				searchText: [
					bookmark.title || "",
					bookmark.description || "",
					bookmark.url || "",
					...(bookmark.tags || [])
				]
					.join(" ")
					.toLowerCase()
			});
		});
	});

	console.log(`✅ Search index built (${searchIndex.length} entries)`);
}

// ------------------------------------------------
// Render Category
// ------------------------------------------------

function renderCategory(category) {
	console.log(`📁 Viewing category: ${category.category}`);

	const mainContent = document.getElementById("main-content");

	let html = `
		<h2>
			📁 ${category.category}
			<span style="opacity:0.7;">
				(${category.bookmarks.length})
			</span>
		</h2>
	`;

	category.bookmarks.forEach(bm => {
		const iconHtml = bm.icon
			? `<img
					src="${bm.icon}"
					alt=""
					width="24"
					height="24"
					style="
						vertical-align:middle;
						margin-right:12px;
						border-radius:4px;
					"
				>`
			: "🔗";

		html += `
			<div class="bookmark">
				<a href="${bm.url}" target="_blank">
					${iconHtml}
					<strong>${bm.title || bm.url}</strong>
				</a>
				<br>

				<small>${bm.description || "nill"}</small>

				${
					bm.tags?.length
						? `<div class="tags">#${bm.tags.join(" #")}</div>`
						: ""
				}
			</div>
		`;
	});

	mainContent.innerHTML = html;
}

// ------------------------------------------------
// Search
// ------------------------------------------------

function performSearch(query, mainContent) {
	console.log(`🔍 Search query: "${query}"`);

	const results = searchIndex.filter(item =>
		item.searchText.includes(query)
	);

	console.log(`📊 Search results: ${results.length}`);

	let html = `
		<div class="search-results">
			<h2>
				🔍 Search Results
				<span style="opacity:0.7;">
					(${results.length})
				</span>
			</h2>
		</div>
	`;

	if (results.length === 0) {
		html += `
			<div class="no-results">
				No bookmarks found for:
				<strong>${query}</strong>
			</div>
		`;

		mainContent.innerHTML = html;
		return;
	}

	let currentCategory = "";

	results.forEach(item => {
		if (currentCategory !== item.category) {
			currentCategory = item.category;

			html += `
				<h3 style="
					margin:25px 0 15px;
					color:#00ccff;
				">
					📁 ${currentCategory}
				</h3>
			`;
		}

		const bm = item.bookmark;

		const iconHtml = bm.icon
			? `<img
					src="${bm.icon}"
					alt=""
					width="24"
					height="24"
					style="
						vertical-align:middle;
						margin-right:12px;
						border-radius:4px;
					"
				>`
			: "🔗";

			html += `
						<div class="bookmark">
							<a href="${bm.url}" target="_blank">
								${iconHtml}
								<strong>${bm.title || bm.url}</strong>
							</a>

							${
								bm.description
									? `<br><small>${bm.description}</small>`
									: ""
							}

							${
								bm.tags?.length
									? `<div class="tags">#${bm.tags.join(" #")}</div>`
									: ""
							}
						</div>
			`;

		html += `
			<div class="bookmark">
				<a href="${bm.url}" target="_blank">
					${iconHtml}
					<strong>${bm.title}</strong>
				</a>
				<br>

				<small>${bm.description || ""}</small>

				${
					bm.tags?.length
						? `<div class="tags">#${bm.tags.join(" #")}</div>`
						: ""
				}
			</div>
		`;
	});

	mainContent.innerHTML = html;
}

// ------------------------------------------------
// Main Loader
// ------------------------------------------------

async function renderBookmarks() {
	console.group("🚀 Bookmark Viewer");

	try {
		console.log("🌐 Loading bookmarks.json...");

		const response = await fetch("bookmarks.json");

		if (!response.ok) {
			throw new Error(
				`HTTP Error: ${response.status}`
			);
		}

		const data = await response.json();

		allBookmarksData = Array.isArray(data)
			? data
			: (data.categories || []);
		allDomainsData = data.domains || [];

		console.log(
			`📂 Categories loaded: ${allBookmarksData.length}`
		);

		console.log(
			`🌐 Domains loaded: ${allDomainsData.length}`
		);

		const totalBookmarks =
			allBookmarksData.reduce(
				(sum, category) =>
					sum + category.bookmarks.length,
				0
			);

		console.log(
			`🔖 Total bookmarks: ${totalBookmarks}`
		);

		buildSearchIndex();

		const header =
			document.querySelector(".top-header h1");

		if (header) {
			header.textContent = `📚 ${totalBookmarks} Bookmarks`
		}

		const container =
			document.getElementById(
				"bookmarks-container"
			);

		container.innerHTML = `
			<div class="sidebar">
				<h2>
					📚 Categories
					(${allBookmarksData.length})
				</h2>

				<ul
					class="category-list"
					id="category-list"
				></ul>
			</div>

			<div
				class="main-content"
				id="main-content"
			></div>
		`;

		const categoryList =
			document.getElementById(
				"category-list"
			);

		const mainContent =
			document.getElementById(
				"main-content"
			);

		// ------------------------------------
		// Category Sidebar
		// ------------------------------------

		allBookmarksData.forEach(
			(category, index) => {

				const li =
					document.createElement("li");

				li.textContent =
					`📁 ${category.category} ` +
					`(${category.bookmarks.length})`;

				if (index === 0) {
					li.classList.add("active");
				}

				li.addEventListener(
					"click",
					() => {
						document
							.querySelectorAll(
								".category-list li"
							)
							.forEach(item =>
								item.classList.remove(
									"active"
								)
							);

						li.classList.add("active");

						const searchInput =
							document.getElementById(
								"search-input"
							);

						if (searchInput) {
							searchInput.value = "";
						}

						renderCategory(category);
					}
				);

				categoryList.appendChild(li);
			}
		);

		// ------------------------------------
		// Search Input
		// ------------------------------------

		const searchInput =
			document.getElementById(
				"search-input"
			);

		searchInput.addEventListener(
			"input",
			() => {

				const query =
					searchInput.value
						.trim()
						.toLowerCase();

				if (!query) {

					const firstCategory =
						document.querySelector(
							".category-list li"
						);

					if (firstCategory) {
						firstCategory.click();
					}

					return;
				}

				performSearch(
					query,
					mainContent
				);
			}
		);

		// ------------------------------------
		// Clear Search Button
		// ------------------------------------

		const clearBtn =
			document.getElementById(
				"clear-search"
			);

		clearBtn?.addEventListener(
			"click",
			() => {

				searchInput.value = "";

				const firstCategory =
					document.querySelector(
						".category-list li"
					);

				if (firstCategory) {
					firstCategory.click();
				}

				searchInput.focus();

				console.log(
					"🧹 Search cleared"
				);
			}
		);

		// ------------------------------------
		// Ctrl/Cmd + K
		// ------------------------------------

		document.addEventListener(
			"keydown",
			e => {

				if (
					(e.ctrlKey || e.metaKey) &&
					e.key.toLowerCase() === "k"
				) {
					e.preventDefault();

					searchInput.focus();
					searchInput.select();

					console.log(
						"⌨️ Focused search bar"
					);
				}
			}
		);

		// ------------------------------------
		// Initial Category
		// ------------------------------------

		if (allBookmarksData.length > 0) {
			renderCategory(
				allBookmarksData[0]
			);
		}

		console.log("✅ Bookmark viewer ready");

	} catch (error) {

		console.error(
			"❌ Failed loading bookmarks:",
			error
		);

		document.getElementById(
			"bookmarks-container"
		).innerHTML = `
			<div
				style="
					text-align:center;
					color:red;
					padding:40px;
				"
			>
				<h2>❌ Failed to load bookmarks</h2>

				<p>
					Check browser console
					for details.
				</p>
			</div>
		`;
	}

	console.groupEnd();
}

// ------------------------------------------------
// Start
// ------------------------------------------------

window.onload = renderBookmarks;

// =============================================
// generate-bookmarks.js
// Run this to update bookmarks.json from your .txt files
// =============================================

const fs = require("node:fs");
const path = require("node:path");

const BOOKMARK_DIR = process.env.HOME + "/.local/share/bookmarks";

console.log("🚀 Starting Bookmark Generator...");
console.log(`📂 Reading from: ${BOOKMARK_DIR}`);

// Helper: Format Category Name
function formatCategoryName(filename) {
	let name = path.basename(filename, ".txt");
	name = name.replace(/_/g, " ");
	name = name
		.split(" ")
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
	return name;
}

function parseTags(tagString) {
	return tagString
		.split(" ")
		.filter((x) => x.startsWith("#"))
		.map((x) => x.replace(/^#/, "").trim())
		.filter(Boolean);
}

function getFaviconUrl(url) {
	try {
		const domain = new URL(url).hostname;
		return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
	} catch (e) {
		return "";
	}
}

function parseBookmarkLine(line) {
	const parts = line
		.split("|")
		.map((x) => x.trim())
		.filter(Boolean);

	let title = "";
	let url = "";
	let description = "";
	const tags = [];

	for (const part of parts) {
		if (part.startsWith("http://") || part.startsWith("https://")) {
			url = part;
		} else if (part.startsWith("#")) {
			tags.push(
				...part
					.split(/\s+/)
					.filter((x) => x.startsWith("#"))
					.map((x) => x.slice(1))
			);
		} else if (!title) {
			// First non-url, non-tag field becomes title
			title = part;
		} else if (!description) {
			// Second non-url, non-tag field becomes description
			description = part;
		}
	}

	if (!url) {
		return null;
	}

	return {
		title,
		url,
		description,
		tags,
		icon: getFaviconUrl(url),
	};
}

function loadBookmarks() {
	console.log("📖 Scanning .txt files...");

	const files = fs
		.readdirSync(BOOKMARK_DIR)
		.filter((x) => x.endsWith(".txt"));

	console.log(`📁 Found ${files.length} category files`);

	const result = [];

	for (const file of files) {
		const fullPath = path.join(BOOKMARK_DIR, file);
		const content = fs.readFileSync(fullPath, "utf8");
		const lines = content.split("\n").filter(Boolean);

		console.log(`   📄 Processing: ${file} (${lines.length} bookmarks)`);

		const bookmarks = lines
			.map(parseBookmarkLine)
			.filter(Boolean);

		if (bookmarks.length === 0) continue;

		result.push({
			category: formatCategoryName(file),
			bookmarks,
		});
	}

	return result;
}

// Main Execution
console.log("🔄 Loading bookmarks...");
const data = loadBookmarks();

fs.writeFileSync("bookmarks.json", JSON.stringify(data, null, 2));

console.log("✅ SUCCESS! bookmarks.json has been updated");
console.log(`📊 Total Categories: ${data.length}`);
console.log(`📈 Total Bookmarks: ${data.reduce((sum, cat) => sum + cat.bookmarks.length, 0)}`);
console.log("\n🎉 You can now open your index.html in the browser!");

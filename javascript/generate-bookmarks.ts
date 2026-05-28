// =============================================
// generate-bookmarks.ts
// Run this to update bookmarks.json from your .txt files
// =============================================

import * as fs from "node:fs";
import * as path from "node:path";

const BOOKMARK_DIR = `${process.env.HOME}/.local/share/bookmarks`;

interface Bookmark {
	title: string;
	url: string;
	description: string;
	tags: string[];
	icon: string;
}

interface BookmarkCategory {
	category: string;
	bookmarks: Bookmark[];
}

console.log("🚀 Starting Bookmark Generator...");
console.log(`📂 Reading from: ${BOOKMARK_DIR}`);

// Helper: Format Category Name
function formatCategoryName(filename: string): string {
	let name = path.basename(filename, ".txt");

	name = name.replace(/_/g, " ");

	return name
		.split(" ")
		.map(
			(word) =>
				word.charAt(0).toUpperCase() +
				word.slice(1).toLowerCase(),
		)
		.join(" ");
}

function parseTags(tagString: string): string[] {
	return tagString
		.split(" ")
		.filter((x) => x.startsWith("#"))
		.map((x) => x.replace(/^#/, "").trim())
		.filter(Boolean);
}

function getFaviconUrl(url: string): string {
	try {
		const domain = new URL(url).hostname;
		return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
	} catch {
		return "";
	}
}

function parseBookmarkLine(line: string): Bookmark | null {
	const parts = line.split("|").map((x) => x.trim());

	if (parts.length < 4) {
		return null;
	}

	const url = parts[1];

	return {
		title: parts[0],
		url,
		description: parts[2],
		tags: parseTags(parts[3]),
		icon: getFaviconUrl(url),
	};
}

function loadBookmarks(): BookmarkCategory[] {
	console.log("📖 Scanning .txt files...");

	const files = fs
		.readdirSync(BOOKMARK_DIR)
		.filter((x) => x.endsWith(".txt"));

	console.log(`📁 Found ${files.length} category files`);

	const result: BookmarkCategory[] = [];

	for (const file of files) {
		const fullPath = path.join(BOOKMARK_DIR, file);

		const content = fs.readFileSync(fullPath, "utf8");

		const lines = content
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		console.log(
			`   📄 Processing: ${file} (${lines.length} bookmarks)`,
		);

		const bookmarks = lines
			.map(parseBookmarkLine)
			.filter(
				(bookmark): bookmark is Bookmark =>
					bookmark !== null,
			);

		if (bookmarks.length === 0) {
			continue;
		}

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

fs.writeFileSync(
	"bookmarks.json",
	JSON.stringify(data, null, 2),
	"utf8",
);

console.log("✅ SUCCESS! bookmarks.json has been updated");
console.log(`📊 Total Categories: ${data.length}`);

const totalBookmarks = data.reduce(
	(sum, category) => sum + category.bookmarks.length,
	0,
);

console.log(`📈 Total Bookmarks: ${totalBookmarks}`);
console.log("\n🎉 You can now open your index.html in the browser!");

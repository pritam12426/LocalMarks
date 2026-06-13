#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

import requests


def get_channel_icon_url(channel_url: str) -> str | None:
	headers = {
		"User-Agent": (
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
			"AppleWebKit/537.36 (KHTML, like Gecko) "
			"Chrome/120.0.0.0 Safari/537.36"
		),
	}

	response = requests.get(channel_url, headers=headers, timeout=5)
	html = response.text

	match = re.search(r"ytInitialData\s*=\s*(\{.*?\});</script>", html, re.DOTALL)
	if not match:
		raise ValueError("Could not find ytInitialData in page")

	data = json.loads(match.group(1))

	avatar = (
		data["header"]
		["pageHeaderRenderer"]
		["content"]
		["pageHeaderViewModel"]
		["image"]
		["decoratedAvatarViewModel"]
		["avatar"]
		["avatarViewModel"]
		["image"]
		["sources"]
	)

	return avatar[-1]["url"]


# ── Helpers ────────────────────────────────────────────────────────────────────
def format_category_name(filename: str) -> str:
	"""Format a filename stem into a readable category name."""
	name = Path(filename).stem.replace("_", " ")
	return " ".join(word.capitalize() for word in name.split())


def get_domain(url: str) -> str:
	"""Extract the bare domain from a URL."""
	try:
		host = urlparse(url).hostname or ""
		return host.removeprefix("www.").lower()
	except Exception:
		return ""


# ── Parsing ────────────────────────────────────────────────────────────────────
def parse_bookmark_line(
	line: str,
	fetch_icons: bool,
	domain_counter: dict[str, int],
	tag_counter: dict[str, int],
) -> dict | None:
	"""Parse one pipe-separated bookmark line. Returns None if the line should be skipped."""
	if not line or line.strip().startswith("#"):
		return None

	if "http://" not in line and "https://" not in line:
		return None

	parts = [x.strip() for x in line.strip().split("|") if x.strip()]

	if len(parts) > 4:
		return None

	title       = ""
	url         = ""
	description = ""
	tags: list[str] = []

	for part in parts:
		if part.startswith(("http://", "https://")):
			url = part
		elif part.startswith("#"):
			tags.extend(
				t.removeprefix("#").strip()
				for t in part.split()
				if t.startswith("#") and t.removeprefix("#").strip()
			)
		elif not title:
			title = part
		elif not description:
			description = part

	if not url:
		return None

	# Update tag counters
	for tag in tags:
		tag_counter[tag] = tag_counter.get(tag, 0) + 1

	# Update domain counters
	domain = get_domain(url)
	if domain:
		domain_counter[domain] = domain_counter.get(domain, 0) + 1

	entry: dict = {
		"title":       title,
		"url":         url,
		"description": description,
		"tags":        tags,
		"domain":      domain,
	}

	if fetch_icons and url.startswith("https://www.youtube.com/@"):
		print(f"     🛜  Fetching icon for '{url}'")
		try:
			icon_url = get_channel_icon_url(url)
			if icon_url:
				entry["icon"] = icon_url
		except Exception as exc:
			print(f"     ⚠️  Could not fetch icon: {exc}")

	return entry


def process_files(
	files: list[Path],
	fetch_icons: bool,
	domain_counter: dict[str, int],
	tag_counter: dict[str, int],
) -> list[dict]:
	"""Read a list of .txt files and return a list of category dicts."""
	categories: list[dict] = []

	for file_path in sorted(files):
		if not file_path.exists():
			print(f"   ⚠️  File not found, skipping: {file_path}")
			continue

		category_name = format_category_name(file_path.name)
		bookmarks: list[dict] = []

		for line in file_path.read_text(encoding="utf-8").splitlines():
			bookmark = parse_bookmark_line(line, fetch_icons, domain_counter, tag_counter)
			if bookmark:
				bookmarks.append(bookmark)

		if bookmarks:
			categories.append({"category": category_name, "bookmarks": bookmarks})
			print(f"   📄 {file_path.name}  ({len(bookmarks)} bookmarks)")

	return categories


def print_summary(book_marks: list[dict], domain_counter: dict, tag_counter: dict, output_file: Path) -> None:
	total = sum(len(c["bookmarks"]) for c in book_marks)
	print("\n✅  Done!")
	print(f"   📊 Categories : {len(book_marks)}")
	print(f"   📎 Bookmarks  : {total}")
	print(f"   🌐 Domains    : {len(domain_counter)}")
	print(f"   🏷️  Tags       : {len(tag_counter)}")
	print(f"   💾 Saved to   : {output_file}")

def bookmark_sort_key(bm: dict) -> str:
	return (
		bm.get("title")
		or bm.get("description")
		or bm.get("url")
		or ""
	).strip().lower()


def sort_database(book_marks: list[dict]) -> list[dict]:
	# Sort bookmarks inside each category
	for category in book_marks:
		category["bookmarks"].sort(key=bookmark_sort_key)

	# Sort categories by category name
	book_marks.sort(
		key=lambda cat: cat.get("category", "").strip().lower()
	)

	return book_marks

# ── Subcommands ────────────────────────────────────────────────────────────────

def cmd_create(args: argparse.Namespace) -> None:
	"""Build a fresh database from the given .txt files."""
	output: Path = args.to
	output.parent.mkdir(parents=True, exist_ok=True)

	print("🚀 Creating bookmark database…")

	domain_counter: dict[str, int] = {}
	tag_counter:    dict[str, int] = {}

	book_marks = process_files(args.files, args.icon, domain_counter, tag_counter)

	book_marks = sort_database(book_marks)

	final_data = {
		"book_Marks":            book_marks,
		"book_mark_domain_hash": domain_counter,
		"book_mark_tag_hash":    tag_counter,
	}

	output.write_text(json.dumps(final_data, indent="\t", ensure_ascii=False), encoding="utf-8")
	print_summary(book_marks, domain_counter, tag_counter, output)


def cmd_append(args: argparse.Namespace) -> None:
	"""Append bookmarks from the given .txt files into an existing database."""
	output: Path = args.to

	if not output.exists():
		raise SystemExit(f"❌ Database not found: {output}\n   Use 'create' to start a new one.")

	print(f"📂 Loading existing database: {output}")
	existing = json.loads(output.read_text(encoding="utf-8"))

	book_marks:     list[dict]     = existing.get("book_Marks", [])
	domain_counter: dict[str, int] = existing.get("book_mark_domain_hash", {})
	tag_counter:    dict[str, int] = existing.get("book_mark_tag_hash", {})

	# Build a set of already-known URLs so we don't add duplicates
	known_urls: set[str] = {
		bm["url"]
		for cat in book_marks
		for bm in cat.get("bookmarks", [])
	}

	print("📖 Scanning new files…")
	new_categories = process_files(args.files, args.icon, domain_counter, tag_counter)

	# Merge: if the category already exists add to it, otherwise append it
	added_total = 0
	for new_cat in new_categories:
		new_bms = [bm for bm in new_cat["bookmarks"] if bm["url"] not in known_urls]
		if not new_bms:
			continue

		added_total += len(new_bms)
		known_urls.update(bm["url"] for bm in new_bms)

		existing_cat = next(
			(c for c in book_marks if c["category"] == new_cat["category"]),
			None,
		)
		if existing_cat:
			existing_cat["bookmarks"].extend(new_bms)
			print(f"   ➕ {new_cat['category']}: added {len(new_bms)} bookmark(s)")
		else:
			book_marks.append({"category": new_cat["category"], "bookmarks": new_bms})
			print(f"   🆕 New category '{new_cat['category']}': {len(new_bms)} bookmark(s)")

	if added_total == 0:
		print("   ℹ️  No new bookmarks to add (all URLs already exist in the database).")
		return


	book_marks = sort_database(book_marks)

	final_data = {
		"book_Marks":            book_marks,
		"book_mark_domain_hash": domain_counter,
		"book_mark_tag_hash":    tag_counter,
	}

	output.write_text(json.dumps(final_data, indent="\t", ensure_ascii=False), encoding="utf-8")
	print_summary(book_marks, domain_counter, tag_counter, output)


# ── CLI ────────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(
		prog="marks2json",
		description="Convert bookmark .txt files into a JSON database",
	)

	parser.add_argument(
		"-I", "--icon",
		action="store_true",
		help="Fetch channel icons (requires network)",
	)

	subparsers = parser.add_subparsers(dest="command", required=True)

	# ── create ──
	create_parser = subparsers.add_parser(
		"create",
		help="Create a new bookmark database from .txt files",
	)
	create_parser.add_argument(
		"files",
		type=Path,
		nargs="+",
		metavar="FILE",
		help="One or more .txt bookmark files",
	)
	create_parser.add_argument(
		"-T", "--to",
		type=Path,
		default=Path("bookmarks.json"),
		metavar="DB",
		help="Output JSON file (default: bookmarks.json)",
	)
	create_parser.set_defaults(func=cmd_create)

	# ── append ──
	append_parser = subparsers.add_parser(
		"append",
		help="Append bookmarks from .txt files into an existing database",
	)
	append_parser.add_argument(
		"files",
		type=Path,
		nargs="+",
		metavar="FILE",
		help="One or more .txt bookmark files",
	)
	append_parser.add_argument(
		"-T", "--to",
		type=Path,
		required=True,
		metavar="DB",
		help="Path to the existing JSON database",
	)
	append_parser.set_defaults(func=cmd_append)

	return parser


def main() -> None:
	parser = build_parser()
	args   = parser.parse_args()
	args.func(args)


if __name__ == "__main__":
	main()

#!/usr/bin/env python3

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


def format_category_name(filename: str) -> str:
	"""Format filename to nice category name"""
	name = Path(filename).stem
	name = name.replace("_", " ")
	name = " ".join(word.capitalize() for word in name.split())
	return name


def get_domain(url: str) -> str:
	"""Extract clean domain from URL"""
	try:
		parsed = urlparse(url)
		domain = parsed.hostname
		if domain and domain.startswith("www."):
			domain = domain[4:]
		return domain.lower()
	except Exception:
		return ""


def parse_bookmark_line(line: str):
	"""Parse a single bookmark line"""
	if not line or line.strip().startswith("#"):
		return None

	parts = [x.strip() for x in line.strip().split("|") if x.strip()]

	title = ""
	url = ""
	description = ""
	tags = []

	for part in parts:
		if part.startswith(("http://", "https://")):
			url = part
		elif part.startswith("#"):
			tags.extend(tag.replace("#", "").strip() for tag in part.split() if tag.startswith("#") and tag.replace("#", "").strip())
		elif not title:
			title = part
		elif not description:
			description = part

	if not url:
		return None

	return {
		"title": title,
		"url": url,
		"description": description,
		"tags": tags,
	}


parser = argparse.ArgumentParser(prog="dotmason", description="Convert bookmark .txt files to JSON database")
parser.add_argument("inputdir", type=Path, help="Input directory containing .txt bookmark files")
parser.add_argument("outputdir", type=Path, help="Output directory where bookmarks.json will be saved")
args = parser.parse_args()

if not args.inputdir.is_dir():
	parser.error(f"Input directory does not exist: {args.inputdir}")

args.outputdir.mkdir(parents=True, exist_ok=True)

print("🚀 Starting Bookmark Generator...")
print(f"📂 Reading from: {args.inputdir}")

book_marks = []
domain_counter = {}  # domain -> counter
seen_domains = set()

print("📖 Scanning .txt files...")

txt_files = sorted(args.inputdir.glob("*.txt"))

for file_path in txt_files:
	category_name = format_category_name(file_path.name)

	with file_path.open("r", encoding="utf-8") as f:
		lines = f.readlines()

	bookmarks = []

	for line in lines:
		bookmark = parse_bookmark_line(line)
		if not bookmark:
			continue

		bookmarks.append(bookmark)

		# Track unique domains for hash
		domain = get_domain(bookmark["url"])
		if domain and domain not in seen_domains:
			seen_domains.add(domain)
			domain_counter[domain] = 1  # Start counter at 0
		else:
			domain_counter[domain] += 1

	if bookmarks:
		book_marks.append({"category": category_name, "bookmarks": bookmarks})
		print(f"   📄 Processing: {file_path.name} ({len(bookmarks)} bookmarks)")


# New structure: list containing one dictionary (domain: counter)
book_mark_domain_hash = [domain_counter]

# Final data structure
final_data = {"book_Marks": book_marks, "book_mark_domain_hash": book_mark_domain_hash}

output_file = args.outputdir / "bookmarks.json"

with output_file.open("w", encoding="utf-8") as f:
	json.dump(final_data, f, indent="\t", ensure_ascii=False)

print("\n✅ SUCCESS! Bookmarks have been updated")
print(f"📊 Total Categories: {len(book_marks)}")
print(f"📈 Total Bookmarks: {sum(len(cat['bookmarks']) for cat in book_marks)}")
print(f"🔢 Unique Domains in hash: {len(domain_counter)}")
print(f"💾 Saved to: {output_file}")

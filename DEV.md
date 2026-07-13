# LocalMarks — Developer Guide

## Quick Start

```bash
# Clone and serve
git clone <repo>
cd LocalMarks
python3 -m http.server 8085
# Open http://localhost:8085

# Build bookmarks database
python3 marks2json.py create *.txt -T bookmarks.json

# Update with new bookmarks
python3 marks2json.py update new_category.txt -T bookmarks.json

# With YouTube channel icons (requires: pip install requests)
python3 marks2json.py create *.txt -T bookmarks.json --icon
```

## Development Workflow

### 1. Making Changes

**JavaScript (viewer):**

- Edit files in `javascript/` — changes reflect on reload (ES modules, no build)
- Use browser DevTools Console for debugging
- Clear IndexedDB cache if `bookmarks.json` changes aren't picked up:
  ```js
  indexedDB.deleteDatabase('LocalMarksCache')
  ```

**Python (converter):**

- Edit `marks2json.py` — runs directly, no install needed
- Test: `python3 marks2json.py create test.txt -T /tmp/test.json`

### 2. Code Style

**JavaScript:**

- ES2022 modules (`import`/`export`)
- `'use strict'` at top of each file
- 1 tab indentation (matches `style.css` and `bookmarks.json`)
- No semicolons (ASI-safe)
- Single quotes for strings
- Named exports only

**Python:**

- 1 tab indentation
- Type hints where practical
- Stdlib only (except `requests` for `--icon`)
- Functions small and single-purpose

### 3. Module Communication (Critical)

**All cross-module communication uses `CustomEvent` on `window`:**

| Event                    | Payload   | Emitted By                   | Consumed By                     |
| ------------------------ | --------- | ---------------------------- | ------------------------------- |
| `sidebar-fav-click`      | —         | `sidebar.js`                 | `browse.js`                     |
| `sidebar-category-click` | `{index}` | `sidebar.js`                 | `browse.js`                     |
| `tag-filter-change`      | —         | `tag_bar.js`, `panel.js`     | `browse.js`                     |
| `tag-bar-toggle`         | —         | `tag_bar.js`                 | `browse.js`                     |
| `search-query-changed`   | `{query}` | `keyboard.js`                | `browse.js`                     |
| `search-query-empty`     | —         | `keyboard.js`                | `browse.js`                     |
| `search-cleared`         | —         | `search.js`, `keyboard.js`   | `browse.js`                     |
| `cards-rendered`         | —         | `panel.js`, `search.js`      | `keyboard.js` (via `browse.js`) |
| `tag-filter-from-search` | `{tag}`   | `search.js`                  | `browse.js`                     |
| `favorites-changed`      | —         | `data.js` (`toggleFavorite`) | `browse.js`                     |

**Never** import sibling browse modules directly. Always go through `browse.js` orchestrator.

### 4. Adding a New Browse Feature

1. Create `javascript/feature.js` with `initFeature(cfg)` + pure functions
2. Export only what `browse.js` needs
3. In `browse.js`:
   - Import `initFeature` from `./feature.js`
   - Call in `initBrowse()` with required DOM refs
   - Listen for relevant `CustomEvent`s in `bindEvents()`
4. Keep state in `browse.js` (or feature module if self-contained)

### 5. Testing

**No formal test suite exists.** Manual verification:

```bash
# 1. Verify converter
python3 marks2json.py create *.txt -T /tmp/test.json
python3 -m json.tool /tmp/test.json | head -50

# 2. Verify viewer
python3 -m http.server 8085
# Open http://localhost:8085
# Test: browse, search, tags, favorites, layout, sidebar resize, keyboard nav, info, random
```

**Key test scenarios:**

- Empty categories / no bookmarks
- Duplicate URLs within/between categories
- Special chars in titles/descriptions/tags
- Very long tag lists (>30) → auto-collapse
- Very long tag clouds (>35) → auto-collapse
- YouTube URLs with/without `--icon`
- Theme toggle persistence (localStorage)
- Layout persistence
- Sidebar width persistence + double-click reset
- Hash routing: `#browse`, `#browse?q=term`, `#info`, `#random`
- Keyboard: `j/k/h/l/gg/G/?/Esc/Enter/Ctrl+K` in browse view only

### 6. Common Debugging

| Issue                        | Fix                                                      |
| ---------------------------- | -------------------------------------------------------- |
| `bookmarks.json` not loading | Must serve via HTTP (`file://` blocks `fetch`)           |
| Stale data after rebuild     | `indexedDB.deleteDatabase('LocalMarksCache')` in console |
| Module import errors         | Check `javascript/` imports are relative (`./module.js`) |
| Styles not applying          | Check `stylesheet/style.css` loads (200 OK)              |
| Sidebar drag broken          | `window.innerWidth <= 768` disables on mobile            |
| Keyboard nav not working     | Only active in `#browse` view; `Escape` clears search    |

### 7. Architecture Notes

**State ownership:**

- `main.js`: theme, layout, sidebar width, router, data fetch
- `browse.js`: `allCategories`, `activeCategory`, `searchQuery`, `activeTags`
- `sidebar.js`: renders category list, emits click events
- `panel.js`: renders cards/favorites, consumes `activeTags`
- `tag_bar.js`: owns `activeTags` Set + `expanded` boolean
- `search.js`: owns search index, renders grouped results
- `keyboard.js`: owns focused card index, card list, help modal
- `data.js`: all utilities, IndexedDB, localStorage keys

**localStorage keys:**

- `localmarks-favorites` — `string[]` of URLs
- `localmarks-layout` — `'single' \| 'grid' \| 'compact'`
- `localmarks-sidebar-w` — `number` (px)
- `localmarks-theme` — `'dark' \| 'light'`

**IndexedDB:** `LocalMarksCache` / `bookmarks` store, key `'bookmarks'` — `{data, timestamp}`

### 8. Converter Details (`marks2json.py`)

**Input format (per line):**

```
title | url | description | #tag1 #tag2
```

- `url` required (must contain `http://` or `https://`)
- Lines without URL → skipped silently
- Lines with `>3` pipes (`>4` cols) → skipped
- Lines starting with `#` → comments
- Category = filename (underscores → spaces, capitalize)

**Output schema:**

```json
{
  "book_Marks": [
    {"category": "Name", "bookmarks": [
      {"title": "", "url": "", "description": "", "tags": ["#tag"], "domain": "", "icon": ""}
    ]}
  ],
  "book_mark_domain_hash": {"example.com": 3},
  "book_mark_tag_hash": {"#Tag": 5}
}
```

**Update logic:**

- `create`: fresh DB, sort by title then category
- `update`: merge by URL (dedup), `--override` refreshes title/desc/tags/icon
- `find-dead`: checks all URLs via HEAD requests, prints summary, `--healthy FILE` writes filtered DB
- Icon re-fetch skipped if title/desc/tags unchanged

### 9. File Locations for Common Tasks

| Task                        | Files to Touch                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Add CLI flag                | `marks2json.py` (argparse)                                                                 |
| New MIME type               | N/A (viewer uses Google favicon service)                                                   |
| New theme                   | `stylesheet/themes/new.css` + `<link media="(prefers-color-scheme: ...)">` in `index.html` |
| New keyboard shortcut       | `keyboard.js` (`handleGlobalKeys`)                                                         |
| New tag bar behavior        | `tag_bar.js`                                                                               |
| New search behavior         | `search.js`                                                                                |
| New card layout             | `data.js` (`buildCard`) + `style.css`                                                      |
| New info panel section      | `info.js`                                                                                  |
| New random filter           | `random.js`                                                                                |
| Change sidebar width limits | `main.js` (`MIN_W`, `MAX_W`)                                                               |

### 10. Git Hygiene

- `bookmarks.json` is committed (exception to `*.json` in `.gitignore`)
- `bookmarks.json--` is backup, ignore
- `stylesheet/themes/` NOT gitignored — add themes there
- Temp files (`temp.png`, `temp.txt`, `.DS_Store`) ignored
- No CI, no lint config — add if needed

### 11. Release Checklist

- [ ] `python3 marks2json.py create *.txt -T bookmarks.json` (rebuild DB)
- [ ] `python3 -m http.server 8085` → manual smoke test
- [ ] Update version in `README.md` if applicable
- [ ] Commit `bookmarks.json` with changes
- [ ] Tag release

---

_Keep this updated as architecture evolves._

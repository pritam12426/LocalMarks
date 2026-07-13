# LocalMarks — Agent Guide

## What this is
Offline-first bookmark manager: plain `.txt` → `marks2json` → `bookmarks.json` → static HTML viewer. No build step, no package manager, no npm.

## Quick start
```bash
# Serve the viewer (MUST be HTTP — file:// breaks fetch)
python3 -m http.server 8085
# open http://localhost:8085

# Build bookmark database from .txt files
python3 marks2json.py create path/to/*.txt -T bookmarks.json

# Update (append) bookmarks to existing database (dedup by URL)
python3 marks2json.py update path/to/new.txt -T bookmarks.json

# With YouTube channel icons (requires `pip install requests`)
python3 marks2json.py create *.txt -T bookmarks.json --icon

# Override existing URLs on update (refresh title/desc/tags/icon)
python3 marks2json.py update new.txt -T bookmarks.json --override

# Check link health (HEAD requests) and print results to stdout
python3 marks2json.py find-dead -T bookmarks.json

# Check link health and write new database with only healthy links
python3 marks2json.py find-dead -T bookmarks.json --healthy healthy.json
```

## Architecture

| File | Role |
|------|------|
| `index.html` | Single-page shell (browse/info/random via hash routing) |
| `javascript/main.js` | Entry point; bootstraps data, hash router, theme/layout/sidebar, SW |
| `javascript/data.js` | Shared helpers (fetch, card builder, favorites/theme/layout, IndexedDB) |
| `javascript/browse.js` | Browse view orchestrator — wires submodules |
| `javascript/sidebar.js` | Category sidebar rendering & events |
| `javascript/panel.js` | Main panel rendering (categories, favorites, cards) |
| `javascript/tag_bar.js` | Tag filter bar rendering & interaction |
| `javascript/search.js` | Search index building & results rendering |
| `javascript/keyboard.js` | Vim-style keyboard nav & help modal |
| `javascript/info.js` | Info view (stats, domain grid, tag cloud, category chart) |
| `javascript/random.js` | Random view (picker with category/tag filters) |
| `stylesheet/style.css` | All visual styles (dark theme default) |
| `stylesheet/themes/light.css` | Light theme (auto via `prefers-color-scheme: light`) |
| `sw.js` | Service worker (offline cache, cache-first static, network-first bookmarks.json) |
| `marks2json.py` | Standalone CLI to convert `.txt` → `bookmarks.json` |

## marks2json details
- **Only dependency**: `requests` (for `--icon` and `find-dead`). Otherwise stdlib-only.
- **Subcommands**: `create` (fresh DB), `update` (merge, dedup by URL), `find-dead` (check link health via HEAD requests).
- **`update --override`**: refreshes title/description/tags/icon for existing URLs.
- **`find-dead`**: checks all links in the database using HEAD requests, prints summary table to stdout. Does NOT modify the original database by default.
- **`find-dead --healthy FILE`**: writes a new database containing only healthy links (excludes links matching `--status`).
- **`find-dead --status`**: comma-separated categories to treat as dead (default: `4xx,5xx,error`). Options: `ok`, `redirect`, `4xx`, `5xx`, `error`.
- **`find-dead --concurrency`**: concurrent requests (default: 5).
- **`find-dead --timeout`**: request timeout in seconds (default: 10).
- **Input format**: `title | url | description | #tag1 #tag2`
- Lines without `http://`/`https://` → **silently skipped**.
- Lines with `>3` pipe chars (`>4` columns) → **skipped entirely**.
- Lines starting with `#` → comments.
- Category names from filenames: `free_time.txt` → `"Free Time"`.
- Output JSON uses tab indentation (`indent="\t"`).
- Icon re-fetch skipped during `update` if title/description/tags unchanged.

## Theme system
- **Two themes**: dark (default, in `style.css`) and light (`stylesheet/themes/light.css`).
- Light theme activates automatically via `<link media="(prefers-color-scheme: light)">` — no JS.
- **Theme toggle in header** (`data.js:initTheme`): persists to `localStorage` (`localmarks-theme`). Overrides system preference when set.
- System preference changes respected if user hasn't set manual preference.
- `stylesheet/themes/` is NOT gitignored; add new theme CSS files there.

## Viewer quirks
- **Must be served over HTTP** — `file://` blocks `fetch('bookmarks.json')`.
- `bookmarks.json` fetched at runtime; no build step.
- **IndexedDB cache**: `fetchBookmarks()` caches in `LocalMarksCache`. Stale cache returned immediately; fresh fetch in background. Clear via DevTools or `indexedDB.deleteDatabase('LocalMarksCache')`.
- Accepts `data.categories` (legacy) alongside `data.book_Marks` (see `browse.js:38`).
- `/` focuses search; `Escape` clears it.
- Domain cards on info page link to `#browse?q=domain`.
- Search, tag filtering, per-category duplicate-URL dedup happen client-side.
- Tag bar auto-collapses at >30 tags with expand toggle.
- Tag cloud on info page collapses at >35 tags with expand toggle.
- **Favorites**: star icon on each card, persisted in `localStorage` (`localmarks-favorites`). "⭐ Favorites" virtual category appears at top of sidebar when any bookmarks starred.
- **Layout toggle**: three modes (single/grid/compact) in header; hidden on info/random. Persisted in `localStorage` (`localmarks-layout`).
- **Sidebar resizer**: drag handle (160–480px), double-click to reset. Width persisted in `localStorage` (`localmarks-sidebar-w`).
- Random view "Open All" opens bookmarks with 150ms staggered delays.
- Vim-style keyboard nav in browse: `j`/`k` next/prev, `h`/`←` back to sidebar, `l`/`→` into cards, `gg`/`G` first/last, `/` focus search, `?` help modal.
- **Extra shortcuts**: `o` open in same tab, `yy` copy URL, `p` pin/unpin bookmark.
- **Modular browse view**: `browse.js` (orchestrator) + `sidebar.js` + `panel.js` + `tag_bar.js` + `search.js` + `keyboard.js`. Cross-module communication via `CustomEvent` on `window` (e.g., `sidebar-fav-click`, `tag-filter-change`, `search-query-changed`, `cards-rendered`).
- **Service worker** (`sw.js`): caches `bookmarks.json`, `index.html`, all JS/CSS/assets for offline. Cache-first static, network-first `bookmarks.json`. Auto-updates in background.

## Database schema
```jsonc
{
  "book_Marks": [{ "category": "Name", "bookmarks": [{ "title": "", "url": "", "description": "", "tags": ["#tag"], "domain": "", "icon": "" }] }],
  "book_mark_domain_hash": { "example.com": 3 },
  "book_mark_tag_hash":    { "#Tag": 5 }
}
```

## Constraints & conventions
- No tests, no CI, no linting config exist — add if needed.
- `.gitignore` blocks `*.svg`, `*.json`, `assets/favicon/*` — but `bookmarks.json` is committed (exception). `stylesheet/themes/` is NOT gitignored (only `light.css` exists).
- No `setup.py` or modern packaging for `marks2json` — run as script or symlink manually.
- Legacy `data.categories` supported in viewer (`browse.js:38`) for backward compatibility.
- Server port 8085 in quickstart is convention only; any port works.
- **No `themes.json` file exists** (mentioned in README but not in repo). Theme logic lives entirely in `data.js` + CSS media query.
- **No `javascript/theme.js` file exists** — theme toggle logic is in `data.js` (`initTheme`, `getTheme`, `setTheme`, `toggleTheme`).
- The `bookmarks.json--` file is a backup, not used by the viewer.
- Temporary files (`temp.png`, `temp.txt`, `.DS_Store`) exist but are gitignored/ignored.

## Key localStorage keys
| Key | Purpose |
|-----|---------|
| `localmarks-favorites` | Array of bookmarked URLs |
| `localmarks-layout` | Layout mode: `single` \| `grid` \| `compact` |
| `localmarks-sidebar-w` | Sidebar width in pixels |
| `localmarks-theme` | Theme: `dark` \| `light` (overrides system preference) |

## Developer workflow
```bash
# Make JS changes — edit files in javascript/, reload browser (ES modules, no build)
# Clear IndexedDB cache if bookmarks.json changes aren't picked up:
#   indexedDB.deleteDatabase('LocalMarksCache')

# Test converter
python3 marks2json.py create *.txt -T /tmp/test.json
python3 -m json.tool /tmp/test.json | head -50

# Smoke test viewer
python3 -m http.server 8085
# Test: browse, search, tags, favorites, layout, sidebar resize, keyboard nav, info, random
```

## Code style
- **JavaScript**: ES2022 modules, `'use strict'`, 1 tab indent, no semicolons, single quotes, named exports only.
- **Python**: 1 tab indent, type hints where practical, stdlib only (except `requests` for `--icon`), small single-purpose functions.

## Cross-module communication (Critical)
All communication uses `CustomEvent` on `window`:
- `sidebar-fav-click`, `sidebar-category-click` ({index})
- `tag-filter-change`, `tag-bar-toggle`
- `search-query-changed` ({query}), `search-query-empty`, `search-cleared`
- `cards-rendered`
- `tag-filter-from-search` ({tag, category})
- `favorites-changed` (from `data.js:toggleFavorite`)

**Never** import sibling browse modules directly. Always go through `browse.js` orchestrator.
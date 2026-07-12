# LocalMarks — Agent Guide

## What this is

Offline-first bookmark manager: plain `.txt` → `marks2json` → `bookmarks.json` → static HTML viewer. No build step, no package manager, no npm.

## Quick start

```bash
# Serve the viewer (MUST be HTTP — file:// breaks fetch)
python3 -m http.server 8085
# then open http://localhost:8085

# Build the bookmark database from .txt files
python3 marks2json.py create path/to/*.txt -T bookmarks.json

# Update (append) bookmarks to an existing database (dedup by URL)
python3 marks2json.py update path/to/new.txt -T bookmarks.json

# Optional: fetch YouTube channel icons (requires `pip install requests`)
python3 marks2json.py create *.txt -T bookmarks.json --icon

# Light theme auto-activates via `prefers-color-scheme: light` media query
```

## Architecture

| File                      | Role                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `index.html`              | Single-page shell (browse/info/random views via hash routing)                            |
| `javascript/main.js`      | Entry point; bootstraps data, registers hash router, layout toggle, sidebar resizer      |
| `javascript/data.js`      | Shared helpers (fetch, card builder, layout/favorites/theme, IndexedDB cache)            |
| `javascript/browse.js`    | Browse view **orchestrator** — wires together submodules                                 |
| `javascript/sidebar.js`   | Category sidebar rendering & events                                                      |
| `javascript/panel.js`     | Main panel rendering (categories, favorites, cards)                                      |
| `javascript/tag-bar.js`   | Tag filter bar rendering & interaction                                                   |
| `javascript/search.js`    | Search index building & results rendering                                                |
| `javascript/keyboard.js`  | Vim-style keyboard navigation & help modal                                               |
| `javascript/info.js`      | Info view (stats, domain grid, tag cloud, category chart)                                |
| `javascript/random.js`    | Random view (picker with category/tag filters)                                           |
| `stylesheet/style.css`    | All visual styles (incl. responsive & reduced-motion)                                    |
| `marks2json.py`           | Standalone CLI to convert `.txt` → `bookmarks.json`                                      |

## marks2json details

- **Only dependency**: `requests` (for `--icon` YouTube channel icon fetch). Otherwise stdlib-only.
- **Subcommands**: `create` (fresh DB) and `update` (merge into existing, no duplicates by default).
- **`update --override`**: refreshes title/description/tags/icon for bookmarks whose URL already exists.
- **Input format**: `title | url | description | #tag1 #tag2`
- Lines without `http://`/`https://` are **silently skipped**.
- Lines with `>3` pipe chars (`>4` columns) are **skipped entirely**.
- Lines starting with `#` are comments.
- Category names come from filenames: `free_time.txt` → `"Free Time"` (underscores → spaces, capitalised).
- Output JSON uses tab indentation (`indent="\t"`).
- Icon re-fetch is skipped for unchanged entries during `update` (same title/description/tags).

## Theme system

- **Two themes**: dark (default, in `style.css`) and light (`stylesheet/themes/light.css`).
- Light theme activates automatically via `<link media="(prefers-color-scheme: light)">` — no JavaScript, no manual toggle needed.
- **Theme toggle in header** (`javascript/data.js:initTheme`): persists user choice to `localStorage` (key `localmarks-theme`). Overrides system preference when set.
- System preference changes are respected if user hasn't set a manual preference.
- `stylesheet/themes/` is NOT gitignored; add new theme CSS files there if needed.

## Viewer quirks

- **Must be served over HTTP** — `file://` URLs block `fetch('bookmarks.json')`.
- `bookmarks.json` is fetched at runtime; no build step.
- **IndexedDB cache**: `fetchBookmarks()` in `data.js` caches the JSON in IndexedDB (`LocalMarksCache`). Stale cache returned immediately, fresh fetch happens in background. Clear browser storage or use DevTools to force a fresh load during development.
- Also accepts `data.categories` (legacy) alongside `data.book_Marks` (see `browse.js:38`).
- `/` focuses search; `Escape` clears it.
- Domain cards on info page link back to `#browse?q=domain`.
- Search, tag filtering, and per-category duplicate-URL dedup happen client-side.
- Tag bar auto-collapses at >30 tags with expand toggle.
- Tag cloud on info page collapses at >35 tags with expand toggle.
- **Favorites**: star icon on each card, persisted in `localStorage` (key `localmarks-favorites`). A "⭐ Favorites" virtual category appears at the top of the sidebar when any bookmarks are starred.
- **Layout toggle**: three modes (single-column, two-column grid, compact list) in the header; hidden on info/random views. Choice persisted in `localStorage` (key `localmarks-layout`).
- **Sidebar resizer**: drag handle to resize sidebar (160–480px), double-click to reset. Width persisted in `localStorage` (key `localmarks-sidebar-w`).
- Random view "Open All" opens bookmarks with 150ms staggered delays.
- Vim-style keyboard navigation in browse view: `j`/`k` next/prev card, `h` back to sidebar, `l` into cards, `gg`/`G` first/last, `/` focus search, `?` help modal.
- **Modular browse view**: `browse.js` (orchestrator) + `sidebar.js` + `panel.js` + `tag-bar.js` + `search.js` + `keyboard.js`. Cross-module communication via `CustomEvent` on `window` (e.g., `sidebar-fav-click`, `tag-filter-change`, `search-query-changed`, `cards-rendered`).

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
- No `setup.py` or modern packaging for `marks2json` — run it as a script or symlink it manually.
- Legacy `data.categories` is supported in viewer (`browse.js:38`) for backward compatibility.
- Server port 8085 in quickstart is convention only; any port works.
- **No `themes.json` file exists** (mentioned in README but not in repo). Theme logic lives entirely in `data.js` + CSS media query.
- **No `javascript/theme.js` file exists** — theme toggle logic is in `data.js` (`initTheme`, `getTheme`, `setTheme`, `toggleTheme`).
- The `bookmarks.json--` file is a backup, not used by the viewer.
- Temporary files (`temp.png`, `temp.txt`, `.DS_Store`) exist but are gitignored/ignored.

## Developer commands

```bash
# Run the viewer
python3 -m http.server 8085

# Build bookmarks database
python3 marks2json.py create *.txt -T bookmarks.json

# Update database with new bookmarks
python3 marks2json.py update new.txt -T bookmarks.json

# With YouTube icons
python3 marks2json.py create *.txt -T bookmarks.json --icon

# Update with override (refresh existing URLs)
python3 marks2json.py update new.txt -T bookmarks.json --override
```

## Data flow

```
.txt files (per category) 
    → marks2json.py create/update 
    → bookmarks.json (committed) 
    → fetch() in data.js 
    → IndexedDB cache (LocalMarksCache) 
    → rendered by browse/info/random.js
```

## Key localStorage keys

| Key                    | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `localmarks-favorites` | Array of bookmarked URLs                               |
| `localmarks-layout`    | Layout mode: `single` \| `grid` \| `compact`           |
| `localmarks-sidebar-w` | Sidebar width in pixels                                |
| `localmarks-theme`     | Theme: `dark` \| `light` (overrides system preference) |

# LocalMarks — Complete Codebase Reference for A New Contributor

> **Purpose**: This document gives a new contributor a complete, accurate mental model of the codebase in one read. No speculation — only what exists in the repository as of the current commit.

---

## 1. Project Identity

| Attribute        | Value                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**         | LocalMarks                                                                                                                                                           |
| **Language**     | Vanilla JavaScript (ES2022 modules), Python 3.10+ (stdlib only + optional `requests`)                                                                                |
| **Platforms**    | Any browser with ES modules + IndexedDB support; any OS with Python 3                                                                                                |
| **Dependencies** | **Viewer**: Zero runtime deps. **Converter** (`marks2json`): `requests` (only for `--icon` YouTube icon fetch). Otherwise stdlib-only.                               |
| **Build**        | **No build step**. No bundler, no transpiler, no package manager. Runs directly from source.                                                                         |
| **Philosophy**   | _Offline-first, zero-dependency bookmark manager._ Plain text → JSON → static HTML viewer. Human-editable source, machine-readable database, zero-config deployment. |

**Not a SPA framework.** Not a library. Not extensible at runtime. A single-purpose tool for personal bookmark management.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                         │
│                                                                             │
│  .txt files (per category)                                                  │
│        │                                                                    │
│        ▼                                                                   │
│  marks2json.py (create / update)                                            │
│        │                                                                    │
│        ▼                                                                   │
│  bookmarks.json  (committed, ~65 KB typical)                                │
│        │                                                                    │
│        ▼                                                                   │
│  fetch() in data.js ──► IndexedDB (LocalMarksCache) ──► browser modules   │
│        │                    ▲                                              │
│        │          stale cache returned immediately                          │
│        │                    │                                               │
│        └────────────────────┘   (fresh fetch in background)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUNTIME ARCHITECTURE (Browser)                    │
│                                                                             │
│  index.html (single-page shell, hash routing)                               │
│        │                                                                    │
│        ▼                                                                   │
│  main.js ──► initTheme(), initLayoutToggle(), initSidebarResizer()         │
│        │                                                                    │
│        ▼                                                                   │
│  fetchBookmarks() ──► data = await fetch('bookmarks.json')                 │
│        │                                                                    │
│        ▼                                                                   │
│  initBrowse(data) + initRandom(data)                                        │
│        │                                                                    │
│        ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  hashchange → renderRoute()                                        │    │
│  │    ├─ #browse → renderBrowse()  → browse.js orchestrates:         │    │
│  │    │     ├─ sidebar.js   (categories + favorites)                   │    │
│  │    │     ├─ panel.js     (bookmark cards, tag filtering)            │    │
│  │    │     ├─ tag_bar.js   (filter pills, expand/collapse)            │    │
│  │    │     ├─ search.js    (index, results, groups by category)       │    │
│  │    │     └─ keyboard.js  (vim nav, help modal, search input)        │    │
│  │    ├─ #info   → info.js (stats, domain grid, tag cloud, cat chart  │    │
│  │    └─ #random → random.js (picker with cat/tag filters)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Cross-module: CustomEvent on window (sidebar-fav-click, tag-filter-change, │
│                search-query-changed, cards-rendered, favorites-changed)     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key invariants:**

- **Single entry point**: `main.js` boots everything, owns router, theme, layout, sidebar width
- **Modular browse view**: `browse.js` is orchestrator; 5 submodules handle distinct concerns
- **Shared state**: `data.js` holds all utilities (fetch, card builder, favorites, theme, layout, sidebar width, IndexedDB)
- **Event-driven**: Modules communicate via `CustomEvent` on `window` — no direct imports between submodules
- **No framework**: Vanilla JS, ES modules, native APIs only

---

## 3. Source Tree

```
LocalMarks/
├── index.html                    # Single-page shell (3 views via hash)
├── bookmarks.json                # Generated database (committed)
├── bookmarks.json--              # Backup (ignored by viewer)
├── marks2json.py                 # CLI converter (.txt → .json)
├── sw.js                         # Service worker (offline support)
├── README.md                     # User documentation
├── AGENTS.md                     # Agent instructions
├── DEV.md                        # Developer guide
├── REFERENCES.md                 # Empty placeholder
├── TODO.txt                      # Empty placeholder
├── LICENSE                       # MIT
├── favicon.ico                   # App icon
├── assets/                       # Screenshots for README
│   ├── home_page.png
│   ├── info_page.png
│   └── README_icon.png
├── stylesheet/
│   ├── style.css                 # All styles (dark theme default)
│   └── themes/
│       └── light.css             # Light theme (media query activated)
├── javascript/
│   ├── main.js                   # Entry point, router, UI init, SW registration
│   ├── data.js                   # Shared utilities (fetch, cache, card, theme, favorites, layout, sidebar)
│   ├── browse.js                 # Browse orchestrator + event wiring
│   ├── sidebar.js                # Category sidebar rendering
│   ├── panel.js                  # Main panel (cards, favorites, tag filtering)
│   ├── tag_bar.js                # Tag filter pills + expand/collapse
│   ├── search.js                 # Search index + grouped results
│   ├── keyboard.js               # Vim nav + help modal + search input + shortcuts
│   ├── info.js                   # Database stats view + health check
│   ├── random.js                 # Random picker view
│   └── health.js                 # Link health checker (async HEAD, progress, results)
└── .gitignore                    # *.svg, *.json, assets/favicon/*, __pycache__
```

**No subdirectories in `javascript/`** — flat module structure. All imports are relative (`./module.js`).

---

## 4. Module Deep Dive

### 4.1 `marks2json.py` — Converter CLI

**Subcommands**: `create` (fresh DB), `update` (merge, dedup by URL).

```python
# Core flow (create):
domain_counter = {}
tag_counter = {}
icon_stats = {}

book_marks = process_files(files, fetch_icons, domain_counter, tag_counter, icon_stats)
sort_database(book_marks)

final_data = {
    "book_Marks": book_marks,
    "book_mark_domain_hash": domain_counter,
    "book_mark_tag_hash": tag_counter,
}
json.dumps(final_data, indent="\t", ensure_ascii=False)
```

**Update logic**: Loads existing DB, indexes by URL. New entries only if URL not in DB. `--override` refreshes title/desc/tags/icon for existing URLs if incoming line differs.

**Icon re-fetch skip**: During `update`, if URL exists AND title/desc/tags identical → reuse existing icon (no network call).

**Input format**: `title | url | description | #tag1 #tag2`

- Lines without `http://`/`https://` → skipped
- `>3` pipes (`>4` cols) → skipped
- `#` prefix → comment (skipped)
- Category = filename stem (`free_time.txt` → `"Free Time"`)

**Output**: Tab-indented JSON (`indent="\t"`).

---

### 4.2 `index.html` — Single-Page Shell

Three views via hash routing (`#browse`, `#info`, `#random`):

- **Header**: logo, title, layout toggle (3 modes), theme toggle, Info/Random links, search box
- **Browse view**: sidebar (categories + favorites), resizer handle, main panel (tag bar + bookmark list)
- **Info view**: stats strip, category bar chart, tag cloud, domain grid
- **Random view**: controls (count, category filter, tag filter), results area

**Light theme**: Activated via `<link media="(prefers-color-scheme: light)">` — no JS involved.

---

### 4.3 `main.js` — Entry Point & Router

```javascript
async function init() {
    initTheme();           // data.js: reads localStorage, sets data-theme attr
    initLayoutToggle();    // restores localStorage layout, applies to bookmark-list
    initSidebarResizer();  // restores localStorage width, drag/dblclick handlers

    data = await fetchBookmarks();  // data.js: fetch + IndexedDB cache

    initBrowse(data);      // browse.js
    initRandom(data);      // random.js

    window.addEventListener('hashchange', renderRoute);
    if (!location.hash || location.hash === '#') location.hash = '#browse';
    renderRoute();
}
```

**Router (`renderRoute`)**:

- Parses hash + query string (`#browse?q=foo`)
- Switches `.view` active class, sets `body.className = route-${route}`
- Updates header title, shows/hides layout toggle
- Delegates: `browse`→`renderBrowse()`, `info`→`renderInfo(data)`, `random`→`renderRandom()`

---

### 4.4 `data.js` — Shared Utilities (Core)

| Export                                                            | Purpose                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `fetchBookmarks()`                                                | Fetch `bookmarks.json` with `no-cache`, store in IndexedDB (`LocalMarksCache`), return data        |
| `esc(str)`                                                        | HTML escape (`&`, `<`, `>`, `"`)                                                                   |
| `buildCard(bm, {tagClickable, onTagClick})`                       | Creates `<a class="bookmark-card">` with favicon (lazy), star, title, desc, tags, domain           |
| `getFavorites()` / `toggleFavorite(url)` / `isFavorite(url)`      | `localStorage['localmarks-favorites']` (URL array)                                                 |
| `initTheme()` / `getTheme()` / `setTheme(mode)` / `toggleTheme()` | Theme persistence: `localStorage['localmarks-theme']` overrides system; listens for system changes |
| `getLayout()` / `setLayout(mode)`                                 | `localStorage['localmarks-layout']` ∈ `single\|grid\|compact`                                      |
| `getSidebarWidth()` / `setSidebarWidth(px)`                       | `localStorage['localmarks-sidebar-w']` (160–480px)                                                 |
| **IndexedDB**                                                     | `LocalMarksCache` / `bookmarks` store, key `id: 'bookmarks'`, value `{data, timestamp}`            |

**IndexedDB cache behavior**:

- `fetchBookmarks()` → `fetch()` → `setCache(data)` → return data
- On next load: `getCached()` returns stale data immediately; `fetch()` happens in background
- Clear via DevTools → Application → IndexedDB → Delete, or `indexedDB.deleteDatabase('LocalMarksCache')`

---

### 4.5 `browse.js` — Browse Orchestrator

**State**: `allCategories`, `searchQuery`, `activeCategory` (index, `-1` = favorites), `activeTags` (Set)

**Imports & initializes**:

```javascript
initSidebar({categories, activeCategory, catListEl, sidebarCountEl})
initPanel({categories, activeCategory, panelTitleEl, bookmarkListEl})
initSearch({categories, panelTitleEl, tagBarEl, bookmarkListEl, searchEl, clearEl, catListEl})
initTagBar(elTagBar)
initKeyboard({bookmarkListEl, catListEl, searchEl, clearEl})
```

**Events handled** (via `window.addEventListener`):

- `sidebar-fav-click` → switch to favorites view
- `sidebar-category-click` → switch category
- `tag-filter-change` → re-render panel
- `tag-bar-toggle` → re-render tag bar with expanded state
- `search-query-changed` → render search results
- `search-cleared` / `search-query-empty` → back to category view
- `cards-rendered` → `refreshCards()` (keyboard.js)
- `tag-filter-from-search` → add tag from search result card click
- `favorites-changed` (from data.js) → re-render sidebar + panel if in fav view

**Keyboard shortcuts** (global, Ctrl+K → focus search, Esc → clear search).

---

### 4.6 `sidebar.js` — Category Sidebar

**Renders**: Favorites (if any) + all categories with counts.

**Events emitted**:

- `sidebar-fav-click` (no detail)
- `sidebar-category-click` (`{detail: {index}}`)

**Keyboard**: `j`/`k` / ArrowDown/Up → focus next/prev `<li>` + click (triggers category switch).

**State**: `categories`, `activeCategory`, DOM refs.

---

### 4.7 `panel.js` — Main Panel (Cards + Tag Filtering)

**Renders**:

- **Category view**: deduped bookmarks, filtered by `activeTags` (AND logic)
- **Favorites view**: deduped favorites across all categories, filtered by `activeTags`

**Tag bar**: Delegates to `tag_bar.js` via `renderTagBar(allTags)`.

**Card clicks on tags**: Adds tag to `activeTags`, emits `tag-filter-change`.

**Events emitted**: `cards-rendered` (after DOM updated).

**State**: `categories`, `activeCategory`, DOM refs.

---

### 4.8 `tag_bar.js` — Tag Filter Pills

**Renders**: Up to 30 pills initially, expand button if more, "Clear filters" if any active.

**State**: `activeTags` (Set), `expanded` (bool), `el` (DOM ref).

**Events emitted**:

- `tag-filter-change` (on pill click)
- `tag-bar-toggle` (on expand button click)

---

### 4.9 `search.js` — Search Index & Results

**Index**: Flat array built at init:

```javascript
searchIndex = categories.flatMap(cat =>
    cat.bookmarks.map(bm => ({
        category: cat.category,
        bookmark: bm,
        text: [title, desc, url, ...tags].join(' ').toLowerCase()
    }))
);
```

**Results**: Filters index by `query.toLowerCase()`, groups by category, dedups by URL per group.

**Events emitted**: `cards-rendered`, `tag-filter-from-search` (`{detail: {tag, category}}`).

---

### 4.10 `keyboard.js` — Vim Navigation + Help Modal + Shortcuts

**Global keys** (browse view only, not in inputs):

- `j`/`k` / ArrowDown/Up → next/prev card
- `h` / ArrowLeft → back to sidebar
- `l` / ArrowRight → into cards (focus first if none)
- `gg` / `G` (Shift+G) → first/last card
- `/` → focus search (anywhere)
- `?` → toggle help modal
- `Enter` → open focused card (new tab)
- `o` → open focused card (same tab)
- `yy` → copy URL to clipboard (shows domain toast)
- `p` → pin/unpin bookmark (toggles star)
- `Esc` → clear search + blur cards

**List keys** (inside card list):

- `j`/`k` / ArrowDown/Up → next/prev
- `Enter` → open
- `Esc` → blur + focus search

**Sidebar keys**: `j`/`k` → navigate + select category.

**Search input**: Debounced (300ms) → emits `search-query-changed` or `search-query-empty`; `Enter` → immediate.

**Help modal**: Created on first `?`, appended to `<body>`, trap focus, `Esc`/click overlay/close btn → close.

**State**: `focusedCardIndex`, `cards[]`, DOM refs, `helpModal`.

---

### 4.11 `info.js` — Database Stats View + Link Health Check

**Renders**:

- Stats strip: total, unique URLs, categories, domains, tags
- Category bar chart (horizontal, % of max)
- Tag cloud (from `book_mark_tag_hash`, top 35 + expand)
- Domain grid (from `book_mark_domain_hash`, clickable → `#browse?q=domain`)
- **Link Health Check**: "🔍 Check All Links" button runs async HEAD requests with progress bar; results table shows OK (2xx), Redirect (3xx), Client Error (4xx), Server Error (5xx), Network Error. Cancellable, configurable concurrency (default 5).

**Health check powered by**: `health.js` (async workers, AbortController for cancellation, progress callbacks).

**All from**: `data.book_Marks`, `data.book_mark_domain_hash`, `data.book_mark_tag_hash`.

---

### 4.12 `random.js` — Random Picker

**State**: `allBookmarks[]` (flattened with `_category`), `lastPicked[]`.

**Controls**: Count input, category `<select>`, tag `<input list=datalist>`.

**Algorithm**: Fisher-Yates shuffle on filtered pool (`catFilter`, `tagFilter`).

**Open All**: `setTimeout(window.open, i * 150)` staggered delays.

---

### 4.12 `random.js` — Random Picker

**State**: `allBookmarks[]` (flattened with `_category`), `lastPicked[]`.

**Controls**: Count input, category `<select>`, tag `<input list=datalist>`.

**Algorithm**: Fisher-Yates shuffle on filtered pool (`catFilter`, `tagFilter`).

**Open All**: `setTimeout(window.open, i * 150)` staggered delays.

---

### 4.13 `health.js` — Link Health Checker

**Exports**: `checkAllBookmarks(categories, {concurrency, progress, complete})`, `cancelCheck()`.

**Algorithm**:
1. Flattens categories → unique URLs
2. Creates worker pool (default 5 concurrent)
3. Each worker: HEAD request → fallback GET (no-cors) → classify status
4. Progress callback: `(url, checked, total)`
5. Complete callback: `results[]` with `{url, category, status, error}`

**Categories**: `ok` (2xx), `redirect` (3xx), `client-error` (4xx), `server-error` (5xx), `error` (network), `cancelled`.

**Cancellation**: `AbortController` aborts all in-flight requests.

---

### 4.14 `sw.js` — Service Worker (Offline Support)

**Caches**: `localmarks-v1` with static assets (HTML, CSS, JS, favicon, bookmarks.json).

**Strategies**:
- **Network-first** for `/bookmarks.json` (always fresh, cache on success)
- **Cache-first** for static assets (serve from cache, update in background)

**Install**: Pre-caches all static assets, `skipWaiting()`.

**Activate**: Cleans old caches, `clients.claim()`.

**Fetch**: Intercepts same-origin requests, applies strategy.

**Message handling**: `skipWaiting` message from main thread.

---

### 4.15 `stylesheet/style.css` — All Styles

**CSS Custom Properties** (root):

- Colors: `--bg`, `--fg`, `--muted`, `--accent`, `--card`, `--border`, `--sidebar-w` (230px default)
- Fonts: `--font-sans`, `--font-mono` (system stack)
- Spacing: `--space-*`, radii: `--radius-*`

**Media queries**:

- `prefers-color-scheme: light` → `light.css` loaded via HTML `<link media>`
- `prefers-reduced-motion` → disables transitions
- Responsive: `<=768px` (sidebar horizontal), `<=480px` (compact layout)

**Key classes**:

- `.bookmark-list.single` / `.grid` / `.compact` (layout modes)
- `.bookmark-card.focused` (keyboard nav)
- `.tag-pill.active` (selected filter)
- `.modal-overlay.open` (help modal)

---

### 4.16 `stylesheet/themes/light.css` — Light Theme

Overrides root custom properties for light mode. Activated by browser via media query.

---

## 5. Database Schema

```jsonc
{
  "book_Marks": [
    {
      "category": "Free Time",
      "bookmarks": [
        {
          "title": "akinator",
          "url": "https://en.akinator.com",
          "description": "Guess a celebrity",
          "tags": ["Game", "Akinator"],
          "domain": "en.akinator.com",
          "icon": "https://..."   // only for YouTube with --icon
        }
      ]
    }
  ],
  "book_mark_domain_hash": { "en.akinator.com": 1, "oddee.com": 3 },
  "book_mark_tag_hash":    { "Game": 4, "Dev": 12 }
}
```

**Notes**:

- `book_Marks` (capital M) — array of category objects
- `book_mark_domain_hash` / `book_mark_tag_hash` — precomputed for Info view
- Legacy `data.categories` also accepted (backward compat)

---

## 6. LocalStorage Keys

| Key                    | Type                          | Purpose                 |
| ---------------------- | ----------------------------- | ----------------------- |
| `localmarks-favorites` | `string[]` (URLs)             | Starred bookmarks       |
| `localmarks-layout`    | `'single'\|'grid'\|'compact'` | Browse panel layout     |
| `localmarks-sidebar-w` | `number` (px)                 | Sidebar width (160–480) |
| `localmarks-theme`     | `'dark'\|'light'`             | Manual theme override   |

---

## 7. Cross-Module Communication (CustomEvent)

| Event                    | Payload           | Emitted By                 | Consumed By                     |
| ------------------------ | ----------------- | -------------------------- | ------------------------------- |
| `favorites-changed`      | —                 | `data.js:toggleFavorite()` | `browse.js`                     |
| `sidebar-fav-click`      | —                 | `sidebar.js`               | `browse.js`                     |
| `sidebar-category-click` | `{index}`         | `sidebar.js`               | `browse.js`                     |
| `tag-filter-change`      | —                 | `tag_bar.js`, `panel.js`   | `browse.js`                     |
| `tag-bar-toggle`         | —                 | `tag_bar.js`               | `browse.js`                     |
| `search-query-changed`   | `{query}`         | `keyboard.js`              | `browse.js`                     |
| `search-query-empty`     | —                 | `keyboard.js`              | `browse.js`                     |
| `search-cleared`         | —                 | `search.js`, `keyboard.js` | `browse.js`                     |
| `cards-rendered`         | —                 | `panel.js`, `search.js`    | `keyboard.js` (via `browse.js`) |
| `tag-filter-from-search` | `{tag, category}` | `search.js`                | `browse.js`                     |

---

## 8. Request/Render Lifecycle (Browse View)

```
1. User opens http://localhost:8086
2. main.js:init() → initTheme/layout/sidebar → fetchBookmarks()
3. fetchBookmarks():
   - IndexedDB.get('bookmarks') → stale data (if exists)
   - fetch('bookmarks.json', {cache:'no-cache'}) → fresh data
   - setCache(fresh) → return fresh
4. initBrowse(data) → initSidebar/Panel/Search/TagBar/Keyboard
5. renderSidebar() → categories + favorites
6. renderPanel() → active category cards + tag bar
7. User clicks category:
   - sidebar.js emits sidebar-category-click
   - browse.js: activeCategory = index, clear tags, renderPanel()
8. User clicks tag pill:
   - tag_bar.js: activeTags.add(tag), emits tag-filter-change
   - browse.js: renderPanel() → filtered cards
9. User types in search:
   - keyboard.js: debounced → emits search-query-changed
   - browse.js: renderSearch(query) → grouped results
10. User presses / → keyboard.js focuses search
11. User presses j/k → keyboard.js moves focusedCardIndex, scrolls
```

---

## 9. Key Design Decisions

| Decision                           | Rationale                                                        |
| ---------------------------------- | ---------------------------------------------------------------- |
| **No build step**                  | Zero config, runs anywhere with Python + browser. Edit → reload. |
| **Plain text source**              | Human-editable, diffable, version-controllable, portable.        |
| **Tab-indented JSON**              | Readable diffs, matches Python `json.dumps(indent="\t")`.        |
| **ES modules**                     | Native browser support, no bundler, clear dependency graph.      |
| **Hash routing**                   | Works on static file server, no server-side config needed.       |
| **IndexedDB cache**                | Instant load on repeat visits; background refresh keeps fresh.   |
| **Modular browse (6 files)**       | Each concern isolated; easy to test/debug/replace.               |
| **CustomEvent bus**                | Loose coupling; modules don't import each other.                 |
| **Vim keybindings**                | Power-user efficiency; discoverable via `?` modal.               |
| **System theme + manual override** | Respects OS preference; user choice persists.                    |
| **Sidebar resizer + persist**      | Personal preference, survives reloads.                           |
| **Favorites as virtual category**  | No schema change; derived from `localStorage`.                   |
| **sendfile not needed**            | Static JSON is small (~65 KB); browser caches aggressively.      |
| **`requests` only for `--icon`**   | Optional feature; core works with stdlib.                        |

---

## 10. Performance Characteristics

| Metric          | Mechanism                                            | Impact                               |
| --------------- | ---------------------------------------------------- | ------------------------------------ |
| Initial load    | `fetch('bookmarks.json')` + IndexedDB                | ~65 KB JSON, ~50ms typical           |
| Repeat load     | IndexedDB (sync) + background fetch                  | <10ms paint, fresh data async        |
| Search          | In-memory index (flat array)                         | O(N) scan, N=total bookmarks (~1-5K) |
| Tag filter      | Client-side `filter()` per render                    | Negligible (<5ms)                    |
| Favicon loading | Lazy (IntersectionObserver) + Google favicon service | No blocking, batch requests          |
| Keyboard nav    | DOM `focus()` + `scrollIntoView`                     | Smooth, 60fps                        |
| Memory          | `bookmarks.json` + IndexedDB duplicate               | ~130 KB total                        |

---

## 11. Known Limitations (By Design)

- **Must serve via HTTP** — `file://` blocks `fetch()` (CORS). Use `python3 -m http.server`.
- **No full-text search engine** — simple substring match on concatenated fields.
- **No multi-user / auth** — single-user local tool.
- **No sync** — `bookmarks.json` is the source of truth; copy manually or via dotfiles.
- **YouTube icons only** — `--icon` fetches channel avatars via HTML scrape (fragile).
- **No tag management UI** — tags only from `.txt` source.
- **No import/export** — `.txt` ↔ `marks2json` is the workflow.
- **No mobile gestures** — sidebar resize drag only on desktop (>768px).

---

## 12. Files an Agent Might Need to Touch

| Task                              | Files                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| Add view (e.g., `#tags`)          | `index.html` (view + nav), `main.js` (router), new `javascript/tags.js` |
| Modify card layout                | `data.js:buildCard()`, `stylesheet/style.css`                           |
| Add keyboard shortcut             | `keyboard.js:handleGlobalKeys()`, help modal HTML                       |
| Change search algorithm           | `search.js:buildIndex()`, `renderSearch()`                              |
| Add theme                         | `stylesheet/themes/new.css` + `<link media>` in `index.html`            |
| Modify `marks2json` input format  | `marks2json.py:parse_bookmark_line()`                                   |
| Add field to bookmark schema      | `marks2json.py` + `data.js:buildCard()` + all renderers                 |
| Adjust sidebar width bounds       | `main.js:initSidebarResizer()` (MIN_W/MAX_W)                            |
| Change tag bar collapse threshold | `tag_bar.js:INITIAL_COUNT` (30)                                         |
| Change tag cloud threshold        | `info.js:INITIAL_COUNT` (35)                                            |

---

## 13. Mental Model Checklist

- [ ] Single HTML file, hash routing, 3 views
- [ ] `main.js` = boot + router + global UI (theme/layout/sidebar) + SW registration
- [ ] `data.js` = all shared logic (fetch, cache, card, favorites, theme, layout, sidebar)
- [ ] `browse.js` = orchestrator; 5 submodules (sidebar, panel, tag-bar, search, keyboard)
- [ ] Communication = `CustomEvent` on `window`
- [ ] `bookmarks.json` fetched once, cached in IndexedDB
- [ ] `marks2json.py` = offline converter, stdlib-only (+`requests` for icons)
- [ ] Source = `.txt` files (pipe-separated, category = filename)
- [ ] No build, no deps, no config files
- [ ] **Link health check** (`health.js`) = async HEAD workers + progress + results table
- [ ] **Service worker** (`sw.js`) = offline cache (cache-first static, network-first bookmarks.json)

---

## 14. Quick Commands

```bash
# Run viewer (MUST be HTTP)
python3 -m http.server 8085
# → http://localhost:8085

# Build database from .txt files
python3 marks2json.py create *.txt -T bookmarks.json

# Update database (dedup by URL)
python3 marks2json.py update new.txt -T bookmarks.json

# With YouTube icons
python3 marks2json.py create *.txt -T bookmarks.json --icon

# Override existing URLs on update
python3 marks2json.py update new.txt -T bookmarks.json --override

# Health check: open #info view and click "Check All Links"
# Service worker: auto-registers on load (sw.js)

# Clear IndexedDB cache (in DevTools Console)
indexedDB.deleteDatabase('LocalMarksCache')
```

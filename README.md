<h1 align="center">
	<br>
	<img src="favicon.ico" width="200">
	<br>
	📚 LocalMarks
	<br>
	<br>
</h1>

A fast, offline-first bookmark manager that runs entirely in your browser.
Write your bookmarks as plain `.txt` files, convert them to a JSON database with `marks2json`, and serve the viewer with one command.

<img src="./assets/home_page.png" alt="LocalMarks home page" width="100%">

---

## Table of Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Getting started](#getting-started)
- [Writing your .txt bookmark files](#writing-your-txt-bookmark-files)
- [marks2json — the converter](#marks2json--the-converter)
- [Running the viewer](#running-the-viewer)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Bonus — bookmarkfmt](#bonus--bookmarkfmt)
- [For developers](#for-developers)

---

## How it works

```
your .txt files  ──►  marks2json  ──►  bookmarks.json  ──►  LocalMarks viewer
```

1. You keep bookmarks as human-readable pipe-separated `.txt` files
2. `marks2json` converts them into a structured `bookmarks.json` database
3. The single-page viewer (`index.html`) reads that JSON and renders everything in the browser
4. No backend, no database engine, no build step

---

## Features

### Bookmark browser (`#browse`)

<img src="./assets/home_page.png" alt="LocalMarks home page" width="100%">

- Sidebar with all categories and bookmark counts
- **Favorites** virtual category (★) appears at top when any bookmark is starred
- Full-text search across title, description, tags, and URL — press `/` to focus
- Tag filter bar per category — click any tag pill to filter, multi-select supported
- Click a tag directly on a bookmark card to instantly add it to the filter
- Collapsible tag bar — automatically folds when a category has **more than 30 tags**, shows active filter count while folded
- Duplicate URLs are silently deduplicated within each category
- Favicons loaded via Google's favicon service, with fallback chain for YouTube thumbnails
- **Layout toggle** (header): single column / two-column grid / compact list — persisted
- **Sidebar resizer**: drag handle to resize (160–480px), double-click to reset — persisted

### Database info view (`#info`)

<img src="./assets/info_page.png" alt="LocalMarks info page" width="100%">

- Total bookmarks, unique URLs, categories, domains, and tags at a glance
- Per-category bar chart
- Tag cloud sorted by frequency (sourced from `book_mark_tag_hash`) — collapses at **>35 tags** with expand toggle
- Domain grid with favicon and count — click any domain card to jump to filtered search (`#browse?q=domain`)

### Random view (`#random`)

<img src="./assets/random_page.png" alt="LocalMarks random page" width="100%">

- Pick N random bookmarks with optional category/tag filters
- "Open All" opens picks with 150ms staggered delays
- Shows count of matches in current filter pool

### Theme system

- **Dark** (default, in `style.css`) and **Light** (`stylesheet/themes/light.css`)
- Light theme activates automatically via `prefers-color-scheme: light` media query — no JavaScript needed
- Manual toggle in header (☀️/🌙) persists choice to `localStorage` (`localmarks-theme`), overriding system preference

### Persistence (localStorage)

| Key                    | Purpose                                      |
| ---------------------- | --------------------------------------------- |
| `localmarks-favorites` | Array of starred bookmark URLs               |
| `localmarks-layout`    | Layout mode: `single` \| `grid` \| `compact` |
| `localmarks-sidebar-w` | Sidebar width in pixels                      |
| `localmarks-theme`     | `dark` \| `light` (overrides system)         |

### IndexedDB cache

`bookmarks.json` is cached in IndexedDB (`LocalMarksCache`). On load, stale cache returns immediately; fresh fetch happens in background. Clear browser storage or run `indexedDB.deleteDatabase('LocalMarksCache')` in DevTools to force reload.

---

## Getting started

> **Regular users:** download the latest release from the [Releases page](https://github.com/pritam12426/LocalMarks/releases/latest) — do not clone the repository. Cloning is for development only.

**1. Download the release**

Go to the [Releases page](https://github.com/pritam12426/LocalMarks/releases/latest) and download the latest `.zip`.

**2. Unzip it and move inside**

```bash
unzip LocalMarks-*.zip
cd LocalMarks
```

**3. Install `marks2json`**

`marks2json.py` ships inside the extracted folder. Install its one dependency, then copy it onto your `PATH` so you can run it as `marks2json` from anywhere:

```bash
pip install requests

# copy it into your local bin directory
cp marks2json.py ~/.local/bin/marks2json
chmod +x ~/.local/bin/marks2json
```

> Make sure `~/.local/bin` is on your `PATH`. If `marks2json` isn't found after this step, add
> `export PATH="$HOME/.local/bin:$PATH"` to your `~/.bashrc` / `~/.zshrc` and restart your shell.

**4. Create your bookmark database**

```bash
marks2json create ~/bookmarks/*.txt -T bookmarks.json
```

Place the generated `bookmarks.json` next to `index.html`.

**5. Start the viewer**

```bash
cd LocalMarks/
python3 -m http.server 8085
```

Open [http://localhost:8085](http://localhost:8085) in your browser.

---

## Writing your .txt bookmark files

Each `.txt` file becomes one **category** in the viewer. The filename becomes the category name — underscores are replaced with spaces and each word is capitalised.

```
free_time.txt        →  "Free Time"
learning_python.txt  →  "Learning Python"
```

### Line format

Each bookmark is one line with fields separated by `|`:

```
title | url | description | tags
```

| Field         | Required | Notes                                   |
| ------------- | -------- | ---------------------------------------- |
| `title`       | no       | Display name shown in the viewer        |
| `url`         | **yes**  | Must contain `http://` or `https://`    |
| `description` | no       | Short note about the link               |
| `tags`        | no       | Space-separated, each prefixed with `#` |

### Rules `marks2json` enforces

- A line **without** `http://` or `https://` is **skipped entirely**
- A line with **more than 3 pipe characters** (more than 4 columns) is **skipped entirely**
- Lines starting with `#` are treated as **comments** and skipped
- Empty lines are skipped

### Comments

Lines starting with `#` are ignored by `marks2json`, so you can use them freely as comments or section headers inside your files:

```
# ── Learning ────────────────────────────────
MDN      | https://developer.mozilla.org | Web platform docs | #Dev #Web
Python   | https://docs.python.org       | Python reference  | #Dev #Python

# ── YouTube channels ────────────────────────
Tsoding  | https://www.youtube.com/@tsoding | Live coding streams | #YouTube #C
```

### Full example — `free_time.txt`

```
# ── Games ───────────────────────────────────
akinator      | https://en.akinator.com          | Guess a celebrity     | #Game #Akinator
invisiblecow  | https://findtheinvisiblecow.com/ | Find the Invisible Cow | #Game

# ── Reading ──────────────────────────────────
oddee         | https://www.oddee.com/           | Random interesting stuff | #Blog #Read

# ── Misc ─────────────────────────────────────
earthcam      | https://www.earthcam.com         | Live cameras worldwide   | #Cam #Media
```

> **Tip:** keep one `.txt` file per topic. The filename is the category name, so name them clearly.

---

## marks2json — the converter

`marks2json` has three subcommands: `create`, `update`, and `find-dead`.

### Create a new database

```bash
# Single file
marks2json create free_time.txt -T bookmarks.json

# Multiple files
marks2json create *.txt -T bookmarks.json

# With YouTube channel icon fetching (requires `pip install requests`)
marks2json create *.txt -T bookmarks.json --icon
```

Fetched channel icons are cached to `~/.cache/marks2json_icons.json`, keyed by channel URL. On later runs (`create` or `update`, still with `--icon`), any URL already in the cache is reused instead of hitting the network again — so re-running `create` on the same bookmarks is fast even with `--icon` on.

### Update an existing database

Use `update` when you add a new `.txt` file and don't want to rebuild from scratch. URLs already in the database are automatically skipped — no duplicates.

```bash
marks2json update new_category.txt -T bookmarks.json

# Multiple files
marks2json update tools.txt references.txt -T bookmarks.json
```

If the category name already exists in the database, new bookmarks are merged into it. If it's a new category, it's added.

### Override existing entries

By default, `update` skips URLs that already exist. Use `--override` to refresh title/description/tags/icon for existing URLs when the incoming line differs:

```bash
marks2json update updated.txt -T bookmarks.json --override
```

### Check link health

`find-dead` checks all links in the database by making HEAD requests and prints a summary table to stdout. It does NOT modify the database by default.

```bash
# Check all links, print results to stdout
marks2json find-dead -T bookmarks.json

# Only treat these statuses as "dead" (default: 4xx,5xx,error)
marks2json find-dead -T bookmarks.json --status 5xx,error

# Adjust concurrency and timeout
marks2json find-dead -T bookmarks.json --concurrency 10 --timeout 5

# Write new database with only healthy links to a file
marks2json find-dead -T bookmarks.json --healthy healthy.json
```

The `--healthy` file is a new database written by `find-dead` containing only healthy links (those not matching the `--status` dead categories), and looks like a regular `bookmarks.json`:

```jsonc
{
  "book_Marks": [
    {
      "category": "Free Time",
      "bookmarks": [
        {
          "title": "example",
          "url": "https://example.com",
          "description": "Example domain",
          "tags": ["test"],
          "domain": "example.com"
        }
      ]
    }
  ],
  "book_mark_domain_hash": { "example.com": 1 },
  "book_mark_tag_hash":    { "test": 1 }
}
```

Matching entries are removed from every category, domain/tag counts are adjusted accordingly, and any category left with zero bookmarks is dropped from the database.

### All options

```
usage: marks2json {create,update,find-dead} ...

options:
  -I / --icon           Fetch channel icons (requires network)

subcommands:
  create        Build a fresh database from .txt files
  update        Add bookmarks to an existing database
  find-dead     Check link health in database (HEAD requests)

shared options (create / update):
  FILE ...              One or more .txt bookmark files
  -T / --to DB          Output / target JSON file
  -O / --override       (update only) refresh existing entries that changed

find-dead options:
  -T / --to DB          Path to the existing JSON database
  --status LIST         Comma-separated dead statuses (default: 4xx,5xx,error)
  --concurrency N       Concurrent requests (default: 5)
  --timeout SEC         Request timeout in seconds (default: 10)
  --healthy FILE        Write new database with only healthy links to this file
```

### The JSON schema

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
          "icon": "https://..."   // only present for YouTube channels with --icon
        }
      ]
    }
  ],
  "book_mark_domain_hash": { "en.akinator.com": 1, "oddee.com": 3 },
  "book_mark_tag_hash":    { "Game": 4, "Dev": 12 }
}
```

---

## Running the viewer

```bash
cd LocalMarks/
python3 -m http.server 8085
```

Then open **http://localhost:8085**

> The viewer **must be served over HTTP** — opening `index.html` directly as a `file://` URL will not work because browsers block `fetch()` on local files.

---

## Keyboard shortcuts

| Key             | Action                            |
| --------------- | ---------------------------------- |
| `j` / `↓`       | Next bookmark                     |
| `k` / `↑`       | Previous bookmark                 |
| `h` / `←`       | Back to categories (sidebar)      |
| `l` / `→`       | Into bookmarks (cards)            |
| `gg`            | Jump to first bookmark            |
| `G` (`Shift+G`) | Jump to last bookmark             |
| `/`             | Focus search (global)             |
| `Enter`         | Open focused bookmark (new tab)   |
| `o`             | Open focused bookmark (same tab)  |
| `yy`            | Copy URL to clipboard (shows domain toast) |
| `p`             | Pin/unpin bookmark                |
| `Esc`           | Clear search / close help         |
| `?`             | Toggle help modal                 |
| `Ctrl/Cmd+K`    | Focus search                      |

> Vim-style navigation only works in the **Browse** view (`#browse`).

---

## Bonus — bookmarkfmt

If you want your `.txt` files to stay neatly column-aligned (easier to read and edit by hand), there is a companion formatter called **`bookmarkfmt`**.

It is not part of this repository. It lives in the author's dotfiles:

**[bookmarkfmt.py — pritam12426/dotfiles](https://github.com/pritam12426/dotfiles/blob/main/unix/bin_scripts/bookmarkfmt.py)**

```sh
mkdir -p ~/.local/bin/
curl -fsSL "https://raw.githubusercontent.com/pritam12426/dotfiles/refs/heads/main/unix/bin_scripts/bookmarkfmt.py" -o ~/.local/bin/bookmarkfmt
chmod +x ~/.local/bin/bookmarkfmt
```

```bash
# Format one file in-place
bookmarkfmt free_time.txt

# Preview without writing
bookmarkfmt --dry-run *.txt

# CI / git pre-commit hook — exits with code 1 if any file needs formatting
bookmarkfmt --check *.txt
```

Before:

```
earthcam | https://www.earthcam.com | See random places | #Cam #Media
oddee | https://www.oddee.com/ | Read stuff | #Blog #Read
akinator | https://en.akinator.com | Guess celebs | #Game
```

After:

```
earthcam | https://www.earthcam.com | See random places | #Cam #Media
oddee    | https://www.oddee.com/   | Read stuff        | #Blog #Read
akinator | https://en.akinator.com  | Guess celebs      | #Game
```

---

## For developers

Clone the repository and work directly:

```bash
git clone https://github.com/YOUR_USERNAME/LocalMarks.git
cd LocalMarks
python3 -m http.server 8085
```

Place your `bookmarks.json` next to `index.html` and the viewer picks it up automatically on reload.

### Project structure

```
LocalMarks/
├── assets/
│   ├── home_page.png
│   └── info_page.png
├── javascript/
│   ├── main.js            # Entry point, hash router, theme/layout/sidebar init, SW registration
│   ├── data.js            # Shared utilities (fetch, cache, card builder, theme, favorites, layout)
│   ├── browse.js          # Browse view orchestrator (wires submodules)
│   ├── sidebar.js         # Category sidebar rendering & events
│   ├── panel.js           # Main panel (categories, favorites, cards, tag filtering)
│   ├── tag_bar.js         # Tag filter pills + expand/collapse
│   ├── search.js          # Search index + grouped results
│   ├── keyboard.js        # Vim-style navigation + help modal
│   ├── info.js            # Info view (stats, domain grid, tag cloud, category chart, health check)
│   ├── random.js          # Random picker with category/tag filters
│   └── health.js          # Link health checker (async HEAD requests)
├── stylesheet/
│   ├── style.css          # All visual styles (dark theme default)
│   └── themes/
│       └── light.css      # Light theme (auto-activated via media query)
├── index.html             # Single-page shell (browse/info/random via hash routing)
├── bookmarks.json         # Generated by marks2json — place here
├── marks2json.py          # CLI converter (.txt → .json)
├── sw.js                  # Service worker (offline support)
├── favicon.ico
├── README.md
├── AGENTS.md              # Agent instructions
├── DEV.md                 # Developer guide
├── PROJECT_BRIEF.md       # Deep technical reference
├── REFERENCES.md
├── TODO.txt
└── LICENSE
```

### File responsibilities

| File                           | Purpose                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `javascript/main.js`           | Entry point; bootstraps data, registers hash router, theme/layout/sidebar init, SW registration  |
| `javascript/data.js`           | Shared utilities (fetch, IndexedDB cache, card builder, theme, favorites, layout, sidebar width) |
| `javascript/browse.js`         | Browse view **orchestrator** — wires submodules, handles events                                  |
| `javascript/sidebar.js`        | Category sidebar rendering & click/keyboard events                                                |
| `javascript/panel.js`          | Main panel rendering (categories, favorites, cards, tag filtering)                                |
| `javascript/tag_bar.js`        | Tag filter pills, expand/collapse, active tags state                                              |
| `javascript/search.js`         | Search index building, grouped results rendering                                                  |
| `javascript/keyboard.js`       | Vim-style navigation, help modal, search input handling                                           |
| `javascript/info.js`           | Info view (stats, domain grid, tag cloud, category chart)                           |
| `javascript/random.js`         | Random picker with category/tag filters                                                           |
| `stylesheet/style.css`         | All visual styles (dark theme)                                                                    |
| `stylesheet/themes/light.css`  | Light theme (media query activated)                                                                |
| `sw.js`                        | Service worker (offline cache, cache-first static, network-first bookmarks.json)                  |
| `index.html`                   | Single-page shell (3 views via hash routing)                                                       |

### Cross-module communication

All communication between browse submodules uses `CustomEvent` on `window`:

- `sidebar-fav-click` — user clicked Favorites in sidebar
- `sidebar-category-click` — `{detail: {index}}` user clicked a category
- `tag-filter-change` — active tag set changed
- `tag-bar-toggle` — tag bar expand/collapse toggled
- `search-query-changed` — `{detail: {query}}` search input debounced
- `search-query-empty` — search cleared
- `search-cleared` — explicit clear (button/Escape)
- `cards-rendered` — panel/search finished rendering cards
- `tag-filter-from-search` — `{detail: {tag}}` tag clicked in search results
- `favorites-changed` — from `data.js` when user stars/unstars

---

## License

MIT

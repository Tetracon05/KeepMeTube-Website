# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The marketing/download site for [KeepMeTube](https://github.com/Tetracon05/KeepMeTube), a Tauri desktop app. Plain HTML/CSS/JS — no framework, no npm dependencies. Deployed as-is via GitHub Pages to `keepmetube.t3tracon.com.tr`, in all 10 languages the app itself supports (see "Internationalization" below).

## Commands

Deployment has no build step — GitHub Pages just serves whatever static HTML is committed. Editing content, however, goes through a local generator (see "Internationalization"): don't hand-edit `index.html` or `<lang>/index.html` directly, edit `templates/page.html` and/or `locales/*.json` and re-run it.

```bash
python scripts/build_pages.py   # regenerates every language's index.html + sitemap.xml
python3 -m http.server 4173     # then open http://localhost:4173
```

(`python3` vs `python` depends on the machine — use whichever resolves to a real Python 3 interpreter locally.) `.claude/launch.json` runs the `http.server` command for Claude Code's browser-preview tooling. There are no lint/test/typecheck scripts for the generated markup itself — it's reviewed by hand after each `build_pages.py` run.

## Deployment

Pushing to `main` deploys automatically — GitHub Pages is configured (classic "deploy from branch" mode, not Actions) to serve this repo's root directly. `.nojekyll` is present so GitHub doesn't run the tree through Jekyll first.

The custom domain is wired through two places that must stay in sync if it ever changes:
- `CNAME` file at the repo root (`keepmetube.t3tracon.com.tr`) — this is what GitHub Pages reads to enable the custom domain
- A CNAME **DNS record** at the registrar for `t3tracon.com.tr`, pointing `keepmetube` → `tetracon05.github.io.` (managed outside this repo, not something a push here affects)

HTTPS is auto-provisioned by GitHub (Let's Encrypt) once it detects the DNS record resolving; there's nothing to configure for that in-repo.

## Architecture

One page, generated in 10 languages, sharing three asset files:
- `css/style.css` — design tokens + every component style
- `css/fonts.css` — generated `@font-face` declarations, see "Fonts" below; don't hand-edit
- `js/main.js` — theme switching, mobile nav, the compare sliders, and the GitHub Releases integration

### Internationalization (`templates/`, `locales/`, `scripts/build_pages.py`)

`index.html` (English, at the repo root) and `tr/index.html`, `es/index.html`, `fr/index.html`, `de/index.html`, `pt/index.html`, `ar/index.html`, `ja/index.html`, `ko/index.html`, `zh/index.html` are all **generated** — `scripts/build_pages.py` renders `templates/page.html` once per language, substituting `{{token}}` placeholders with the matching `locales/<lang>.json` strings, and also regenerates `sitemap.xml` (with a full hreflang `<xhtml:link>` set per URL) from the same `LANGUAGES` table. This is a local authoring tool only — nothing about deployment changes; GitHub Pages still serves the committed static HTML with zero server-side or request-time build step. The point is to avoid hand-syncing ~300 lines of identical header/footer/icon-defs/script-tag markup across 10 files every time something shared changes.

**To change shared structure** (a new section, a CSS/animation change that touches markup, a new icon): edit `templates/page.html`, then `python scripts/build_pages.py`. **To change copy in one language**: edit that language's `locales/<lang>.json`, then rebuild. **To add a language**: add an entry to the `LANGUAGES` dict in `scripts/build_pages.py` (URL segment, `og:locale`, display name) and a matching `locales/<lang>.json` with every key the other locale files have, then rebuild — the language list is intentionally hardcoded to match the app's own `src/lib/i18n.ts`, not derived automatically, so if the app adds a language this needs a manual follow-up here too.

The `<lang>` URL segment is a plain subdirectory (`/tr/`, `/es/`, ...) with English kept at the root for URL stability; this is what the sitemap/hreflang/canonical tags all assume. Two runtime pieces stay locale-aware even though `js/main.js` itself is one shared file across all 10 pages: `initReleaseData()`'s download-button labels come from an `ASSET_LABELS` table keyed by `document.documentElement.lang` (these strings are injected after the GitHub Releases fetch resolves, so they can't live in the static per-language HTML the way everything else does), and `css/style.css` uses `text-align: start` (not `left`) so body copy mirrors correctly under `/ar/`'s `dir="rtl"`. The compare-slider and hero/showcase screenshots are **not** re-shot per language (regenerating those means running the desktop app itself in each locale) — every language page reuses the same English-UI hero/showcase shots and the same Turkish-UI compare-slider shots that English already used, with only the surrounding caption text translated.

### Design tokens must match the app

Every color, radius, shadow, and font choice in `css/style.css` (`:root` block) is copied directly from the KeepMeTube app's own `src/index.css` token values — monochrome light/dark surfaces, moss/rust/sky reserved strictly for status meaning, 3–14px radii, Space Grotesk / IBM Plex Sans / IBM Plex Mono. If the app's design system changes, this file's tokens need to be re-synced by hand; nothing here reads from the app repo automatically. The `.logo-mark` treatment (bordered square, transparent fill, not a solid tile) was corrected to match real app screenshots — don't revert it to a filled tile.

### Compare sliders (`.compare`, `initCompareSliders` in main.js)

Each slider needs two screenshots that are pixel-identical except for theme — same window size, same content, captured at the same moment. The technique: both images are absolutely positioned at 100%×100% of a fixed-aspect-ratio frame, and the top (light) image is clipped with `clip-path: inset(0 calc(100% - var(--pos)) 0 0)` to reveal the bottom (dark) image underneath. If you add a new comparison pair, resize both source images to identical dimensions first (`sips --resampleWidth`) — mismatched source aspect ratios will misalign the two layers instead of just showing a scaling difference.

Dragging uses Pointer Events (mouse+touch unified) on the whole frame, not just the handle; the handle itself is a `role="slider"` with arrow-key support (5%, or 20% with Shift) for keyboard/a11y.

### Download button (`initReleaseData` in main.js)

Fetches `https://api.github.com/repos/Tetracon05/KeepMeTube/releases/latest` client-side (public API, no auth, CORS-enabled) and matches assets by filename **pattern**, not exact name, since filenames embed the version (`KeepMeTube_26.1.0_aarch64.dmg`): `.dmg`+`aarch64` → Apple Silicon, `.dmg` without `aarch64` → Intel, `.exe`/`.msi` → Windows, `.appimage`/`.deb`/`.rpm` → Linux. Apple Silicon vs. Intel is guessed client-side via a WebGL renderer-string sniff (`detectAppleSilicon`), defaulting to Apple Silicon since that's the majority of active Macs now. Every button's default `href` (before JS runs, or if the fetch fails) already points at the GitHub releases page, so the page degrades gracefully without JS.

### Fonts

Self-hosted, subset to `latin` + `latin-ext` only (drop cyrillic/vietnamese/greek subsets Google Fonts also serves). Space Grotesk and IBM Plex Sans are variable fonts on Google's end — requesting several weights returns the *same* physical file for each, so `css/fonts.css` intentionally has multiple `@font-face` blocks (one per weight) pointing at one shared `-variable-` file per subset; that's correct, not a mistake. IBM Plex Mono is static per weight (three distinct files). To add a weight or family, re-fetch from `https://fonts.googleapis.com/css2?family=...` with a Chrome-like `User-Agent` header (a bare `curl` UA gets served older/plain formats), then re-derive the local `@font-face` rules the same way — don't hand-write font URLs.

### Screenshots

`assets/screenshots/*.{webp,png}` are the actual site assets (resized to 1600px wide via `sips`, converted with `cwebp -q 82`, PNG kept as `<picture>` fallback). The top-level `screenshots/` folder is raw source material from the app author, gitignored (`/screenshots/` in `.gitignore` — note the leading slash: without it, the pattern would also match and hide `assets/screenshots/`). If new screenshots come in, they need the same resize+webp treatment before use; don't reference the raw folder from HTML.

### Favicon

`favicon.svg` is the hand-authored source (matches `.logo-mark`); `assets/favicon-32.png`, `assets/favicon-512.png`, and `assets/apple-touch-icon.png` are rendered from it. `favicon.ico` at the repo root is newer and derived differently: it bundles 16/32/48px frames as embedded PNG data (the modern "PNG-in-ICO" container, no legacy BMP encoding) downscaled from `favicon-512.png`. It exists because Google Search's favicon crawler doesn't reliably fall back past an SVG `<link rel="icon">` to the PNG alternative even when one is declared — `favicon.ico` is listed first in index.html's icon `<link>`s specifically so a crawler that can't handle SVG still finds a format it can. There's no ImageMagick/Pillow in this toolchain, so it's hand-assembled: a short ICONDIR/ICONDIRENTRY header written directly around the raw PNG bytes, no library. If the logo changes, regenerate it the same way — downscale a high-res PNG to 16/32/48px and re-wrap.

### SEO

`robots.txt` and the `SITE_URL` constant in `scripts/build_pages.py` hardcode `https://keepmetube.t3tracon.com.tr`. `sitemap.xml` and every page's canonical/hreflang/`og:url`/JSON-LD `url` are derived from that one constant at build time — update `SITE_URL` and `CNAME`/DNS (see "Deployment") together if the domain ever changes, then rebuild; don't hand-edit the generated URLs in the HTML or sitemap.

Each language's `<title>`/meta description/JSON-LD `description` isn't just a translation of the English copy — it's deliberately written to name the concrete things people search for (e.g. Turkish targets "mp3 indir" / "mp4 indir" phrasing, English targets "YouTube to MP3/MP4 downloader") rather than just the KeepMeTube brand name, since that's real content addressing real search intent, not meta-keyword stuffing. Keep that framing when editing a locale's title/description strings.

## Two CSS gotchas already fixed here — don't reintroduce them

- **`position: fixed` + ancestor `backdrop-filter`**: `.site-header` uses `backdrop-filter: blur(...)`, which (per spec) makes it the containing block for any `position: fixed` descendant. `.mobile-nav` used to be nested inside `<header>` and its `fixed` sizing broke (collapsed to the header's own height) as a result. It now lives as a sibling right after `</header>` in `index.html`. Keep it there.
- **Images need explicit `height: auto`**: the global `img` rule sets `max-width: 100%; height: auto;`. Without the explicit `height: auto`, an `<img>` with `width`/`height` HTML attributes (used everywhere here to prevent layout shift) renders at a CSS-computed fixed pixel height from the attribute while width correctly shrinks — producing a squished/oversized box instead of a proportionally scaled one.

Both were caught by inspecting `getBoundingClientRect()`/computed styles directly rather than trusting screenshots alone — the in-session browser preview tool is not always reliably rendered/painted when its pane isn't visibly focused, so don't treat a blank or stale-looking screenshot as proof of a bug without corroborating it against the DOM.

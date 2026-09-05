# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The marketing/download site for [KeepMeTube](https://github.com/Tetracon05/KeepMeTube), a Tauri desktop app. Plain HTML/CSS/JS — no framework, no build step, no npm dependencies. Deployed as-is via GitHub Pages to `keepmetube.t3tracon.com.tr`.

## Commands

There is no build step. Preview by serving the directory over HTTP (opening `index.html` directly via `file://` will break the download-button JS due to CORS on the `fetch()` call to the GitHub API):

```bash
python3 -m http.server 4173   # then open http://localhost:4173
```

`.claude/launch.json` runs the same command for Claude Code's browser-preview tooling. There are no lint/test/typecheck scripts — this is static markup, reviewed by hand.

## Deployment

Pushing to `main` deploys automatically — GitHub Pages is configured (classic "deploy from branch" mode, not Actions) to serve this repo's root directly. `.nojekyll` is present so GitHub doesn't run the tree through Jekyll first.

The custom domain is wired through two places that must stay in sync if it ever changes:
- `CNAME` file at the repo root (`keepmetube.t3tracon.com.tr`) — this is what GitHub Pages reads to enable the custom domain
- A CNAME **DNS record** at the registrar for `t3tracon.com.tr`, pointing `keepmetube` → `tetracon05.github.io.` (managed outside this repo, not something a push here affects)

HTTPS is auto-provisioned by GitHub (Let's Encrypt) once it detects the DNS record resolving; there's nothing to configure for that in-repo.

## Architecture

Everything is one page (`index.html`) with three asset files:
- `css/style.css` — design tokens + every component style
- `css/fonts.css` — generated `@font-face` declarations, see "Fonts" below; don't hand-edit
- `js/main.js` — theme switching, mobile nav, the compare sliders, and the GitHub Releases integration

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

### SEO

`robots.txt`, `sitemap.xml`, the JSON-LD `SoftwareApplication` block, and the `og:url`/canonical tags in `index.html` all hardcode `https://keepmetube.t3tracon.com.tr/`. Update all of them together if the domain ever changes — nothing derives this from a single source of truth.

## Two CSS gotchas already fixed here — don't reintroduce them

- **`position: fixed` + ancestor `backdrop-filter`**: `.site-header` uses `backdrop-filter: blur(...)`, which (per spec) makes it the containing block for any `position: fixed` descendant. `.mobile-nav` used to be nested inside `<header>` and its `fixed` sizing broke (collapsed to the header's own height) as a result. It now lives as a sibling right after `</header>` in `index.html`. Keep it there.
- **Images need explicit `height: auto`**: the global `img` rule sets `max-width: 100%; height: auto;`. Without the explicit `height: auto`, an `<img>` with `width`/`height` HTML attributes (used everywhere here to prevent layout shift) renders at a CSS-computed fixed pixel height from the attribute while width correctly shrinks — producing a squished/oversized box instead of a proportionally scaled one.

Both were caught by inspecting `getBoundingClientRect()`/computed styles directly rather than trusting screenshots alone — the in-session browser preview tool is not always reliably rendered/painted when its pane isn't visibly focused, so don't treat a blank or stale-looking screenshot as proof of a bug without corroborating it against the DOM.

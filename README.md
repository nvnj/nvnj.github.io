# nvnj.github.io

Personal site for Naveen John. Plain HTML, CSS and JavaScript — no framework, no
bundler, no build step. Push to `main` and GitHub Pages serves it.

## How content gets here

| Source   | Mode   | Mechanism |
|----------|--------|-----------|
| GitHub   | auto   | Nightly Action reads repos tagged with the topic `portfolio` → `data/github.json` |
| Devpost  | auto   | Nightly Action reads `devpost.com/nvnj` → enriches `data/hackathons.json` |
| LinkedIn | manual | No public API exists for profile data. Roles live in `data/profile.json` |

`index.html` ships complete, correct content. `main.js` only *replaces* what it
successfully loads, so a failed sync leaves the page intact — never blank, never
a spinner, always indexable.

## Publishing a project

Add the topic `portfolio` to the repo on GitHub (repo → ⚙ beside *About* →
Topics). It appears after the next nightly run, or run the workflow by hand.
Remove the tag to unpublish. Two optional topics: `pinned` puts a repo in the
featured slot, `wip` marks it in progress.

Copy and ordering are controlled in `data/overrides.json`, keyed by repo name.
Anything without an entry falls back to the repo's GitHub description.

## Layout

```
index.html          the page (complete static content)
styles.css          design tokens + components
main.js             Fig. 1 canvas, scroll spy, JSON hydration
data/profile.json   MANUAL — identity, roles, education, skills
data/overrides.json MANUAL — per-repo copy, order, featured slot
data/github.json    generated nightly
data/hackathons.json seeded by hand, enriched nightly
data/meta.json      generated — sync timestamps and status
scripts/            the two sync scripts + a shared meta helper
```

## Running the syncs locally

```bash
node scripts/fetch-github.mjs      # 60 req/hr unauthenticated; set GH_TOKEN to raise it
node scripts/fetch-devpost.mjs
python3 -m http.server 8000        # then open http://localhost:8000
```

Both scripts exit 0 even on failure, by design: the last good data still ships
and the outcome is recorded in `data/meta.json`. Flip `process.exit(0)` to
`exit(1)` if you want the Action to go red and email you instead.

## Design

Paper and ink, framed as a printed technical report. One spot colour
(cyanotype petrol `#1B4353`) carries every accent; a second plate
(oxide `#8C3B20`) is reserved for award badges and used nowhere else.
Literata for text, Azeret Mono for data and labels. Light is the primary
state; dark is a full redefinition of the same tokens.

All colours are CSS custom properties declared in the bare `:root` block and
redefined for dark twice — once under `prefers-color-scheme`, once under
`[data-theme="dark"]`. Never style a component inside a media or theme block.

## Still to fill in

`data/profile.json` bullets carry `metricHint` fields naming numbers that are
not yet recorded. Each bullet reads correctly without its number; supplying one
appends it as a complete clause. See `metric` / `metricHint` in that file.

# Architecture

The Call Beyond's digital edition is built as two clearly separated layers:

1. **An open-source reading framework** — the code that renders editions,
   recommends articles, and searches them. It is fully inspectable, dependency-
   free, and reusable.
2. **Gated content** — the magazine itself, which remains the intellectual
   property of Sri Aurobindo Ashram, Delhi and is access-controlled at publish
   time.

Keeping these apart is the central design decision. *How the magazine works* is
open to anyone to read, audit, and improve; *what the magazine contains* stays
under the Ashram's control. The two layers meet only at build time.

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  Open framework (src/)   │        │  Gated content           │
│  • reader UI             │        │  • edition manifests     │
│  • personalize.js        │  ──▶   │    (JSON, not in repo)   │
│  • search.js             │ build  │  • only a sample lives   │
│  • build pipeline        │        │    here for development  │
└─────────────────────────┘        └──────────────────────────┘
              │                                  │
              └──────────────┬───────────────────┘
                             ▼
              scripts/build.mjs  →  dist/<issue>.html
                             │
                             ▼
              (optional) StaticCrypt  →  gated, published edition
```

## Repository layout

| Path | Layer | What it is |
|------|-------|-----------|
| `src/personalize.js` | framework | On-device recommender. Transparent scoring, explainable results, no backend. |
| `src/search.js` | framework | Client-side full-text search (inverted index + TF-IDF). |
| `src/journey.js` | framework | The editorial-arc engine — the year as one journey in three movements. |
| `src/reader/` | framework | The reader UI: `reader.html`, `reader.css`, `reader.js`. |
| `scripts/build.mjs` | framework | Assembles one edition into a self-contained page; prints the gating command. |
| `content/sample-edition.json` | content | Synthetic placeholder content for development only. |
| `content/2026-arc.json` | content | The 2026 editorial arc (months, themes, anchors); drives the journey view. |
| `content/` (real editions) | content | Gated — supplied at build time, **not** committed. |
| `index.html` (root) | published | The currently published, gated edition (a StaticCrypt artifact). |
| `dist/` | generated | Build output; not committed. |

## Design principles

- **On-device by default.** Personalization and search run in the reader's
  browser. There is no tracking, no profile sent to a server, and the reader can
  clear everything with one button. For a contemplative audience this is a
  feature, not a limitation.
- **Legible over clever.** The recommender's every score can be explained in a
  sentence, and it surfaces those reasons in the UI ("matches your interest in
  Vedanta"). This is deliberate: readers should understand why something was
  suggested.
- **No dependencies.** The framework and the build use only the platform —
  standard browser APIs and the Node standard library. Nothing to install,
  nothing to audit transitively, fast on any connection.
- **Accessible from the start.** Semantic landmarks, keyboard-operable controls,
  visible focus, a skip link, live regions for status, reduced-motion and dark-
  mode support. See issue tracker item on accessibility.

## The build pipeline

`scripts/build.mjs` takes one edition manifest and inlines the open framework
plus that edition's JSON into a single `dist/<issue>.html` with no network
dependencies. That output is then publishable as-is, or encrypted with
[StaticCrypt](https://github.com/robinmoisson/staticrypt) for gated access:

```bash
node scripts/build.mjs content/sample-edition.json
npx staticrypt dist/<issue>.html --short -d dist/
```

Because the source is always inlined from `src/`, every published edition is
reproducible from open code — the encryption protects the *content*, never the
*mechanism*.

> The repository's root `index.html` predates this pipeline (it was encrypted
> manually). New editions should be built through `build.mjs` so the source of
> truth stays in `src/`.

## Edition data shape

A single JSON manifest per edition; see [`content/README.md`](../content/README.md)
for the full schema. The minimal contract the framework relies on is: each
article has a stable `id`, a `title`, and a list of `themes`. Themes are the
spine of the system — they drive both recommendations and search facets.

## Roadmap

The open items in the [issue tracker](https://github.com/ashishbhateja/callbeyond/issues)
map onto this architecture:

- **Personalization** (`src/personalize.js`) — extend scoring with reading-time
  fit and series awareness.
- **Search** (`src/search.js`) — add cross-edition (archive-wide) indexing.
- **Responsive design** — `reader.css` is mobile-first; continue hardening for
  tablet/print.
- **Accessibility** — ongoing; aim for documented WCAG 2.2 AA conformance.
- **Encryption / data protection** — formalize the gating step in `build.mjs`
  and document the threat model.

# The Call Beyond — Digital Edition

[![CI](https://github.com/ashishbhateja/callbeyond/actions/workflows/ci.yml/badge.svg)](https://github.com/ashishbhateja/callbeyond/actions/workflows/ci.yml)

*The Call Beyond* is the monthly magazine of [Sri Aurobindo Ashram, Delhi](https://www.sriaurobindoashram.net/),
devoted to the integral philosophy of Sri Aurobindo and the Mother. This
repository is the **open-source reading framework** behind the magazine's digital
edition — a small, dependency-free, accessible reader with on-device
personalization and search.

**Live edition:** https://ashishbhateja.github.io/callbeyond/

> **Open framework, gated content.** The *code* that powers the reading
> experience is open source and fully inspectable. The *magazine content* is the
> intellectual property of the Ashram and stays access-controlled — it is
> supplied at build time, not stored here. See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why it's built this way.

## Why

The goal isn't only to *publish* the magazine, but to help a new generation
*engage* with it — to turn time-tested philosophy and Indian scriptures from
something you read into something you can actively work with and question. The
framework below is the foundation — including a first **thematic journey**, the 2026
editorial arc, already in the reader. [`VISION.md`](VISION.md) describes where it's
headed next (guided reflections, grounded "ask the texts" Q&A, and a wider, younger,
multilingual audience).

## What's in the framework

- **On-device personalization** ([`src/personalize.js`](src/personalize.js)) — a
  transparent recommender that ranks articles by the themes a reader engages with.
  Every suggestion comes with a plain-language reason, and nothing leaves the
  browser. No backend, no tracking.
- **Client-side full-text search** ([`src/search.js`](src/search.js)) — an
  inverted index with TF-IDF ranking over a whole edition, with zero
  dependencies.
- **The year as a journey** ([`src/journey.js`](src/journey.js), [`content/2026-arc.json`](content/2026-arc.json))
  — the editorial arc rendered as an interactive path: three movements, twelve
  themed months, festival anchors, and the January⇄December mirror, with the
  current month highlighted and linked to its readings.
- **An accessible reader** ([`src/reader/`](src/reader)) — semantic, keyboard-
  operable, mobile-first, with dark-mode and reduced-motion support.
- **A reproducible build** ([`scripts/build.mjs`](scripts/build.mjs)) — inlines
  the framework with one edition into a single self-contained page, ready to gate
  with [StaticCrypt](https://github.com/robinmoisson/staticrypt) on publish.

No runtime dependencies. The framework uses only standard browser APIs; the build
and tests use only the Node standard library.

## Reusing the framework

The engines are dependency-free and content-agnostic: the recommender, search, and
journey modules operate on any themed JSON corpus. The framework can therefore power
other gated or contemplative content sites — not only this magazine — and the modules
can be lifted out and used on their own.

## Try it locally

```bash
# 1. Serve the repo (the reader loads its edition over fetch)
python3 -m http.server 8000
# open http://localhost:8000/src/reader/reader.html

# 2. Build a single self-contained edition page
node scripts/build.mjs content/sample-edition.json   # -> dist/

# 3. Run the engine tests (no install needed)
node scripts/smoke.mjs
```

The reader loads [`content/sample-edition.json`](content/sample-edition.json) —
synthetic placeholder content used only for development. Real editions are gated.

## Project structure

| Path | What it is |
|------|-----------|
| `src/personalize.js` | On-device recommendation engine |
| `src/search.js` | Client-side full-text search |
| `src/journey.js` | The editorial-arc engine (the year's "thematic journey") |
| `src/reader/` | Reader UI — `reader.html`, `reader.css`, `reader.js` |
| `scripts/build.mjs` | Edition build pipeline |
| `scripts/smoke.mjs` | Dependency-free tests for the engines |
| `content/` | Edition manifests (only a sample is committed) |
| `docs/ARCHITECTURE.md` | Design and rationale |
| `index.html` | The currently published, gated edition (built artifact) |

## Status & roadmap

Early but real. The engines are tested and the architecture is in place; the next
work is tracked in the
[issue tracker](https://github.com/ashishbhateja/callbeyond/issues) — archive-wide
search, richer personalization, WCAG 2.2 AA conformance, and formalizing the
gated-publish step.

## Contributing

Contributions to the framework are welcome — see
[`CONTRIBUTING.md`](CONTRIBUTING.md). Please don't commit magazine content; develop
against the sample edition.

## Security

The framework is static, dependency-free, and keeps all reader data on-device.
See [`SECURITY.md`](SECURITY.md) for the threat model and how to report issues.

## License

The framework code is released under the [MIT License](LICENSE). Magazine content
is © Sri Aurobindo Ashram, Delhi, all rights reserved, and is not covered by that
license.

## Acknowledgments

*The Call Beyond* is published by Sri Aurobindo Ashram, Delhi. This digital edition
is an independent open-source effort to make the reading experience fast,
accessible, and personal.

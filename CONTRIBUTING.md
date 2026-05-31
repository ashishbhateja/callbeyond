# Contributing to The Call Beyond

Thanks for your interest. This repository is the **open-source reading
framework** behind the digital edition of *The Call Beyond*. Contributions to the
framework — the reader, the recommender, search, accessibility, and the build —
are welcome. The magazine's content itself is gated and lives outside the repo
(see [`content/README.md`](content/README.md)), so contributions are about *how*
the magazine works, not *what* it publishes.

## Project shape

```
src/personalize.js   on-device recommender (no backend)
src/search.js        client-side full-text search
src/reader/          the reader UI (html, css, js)
scripts/build.mjs    assembles an edition into one self-contained page
content/             edition manifests (only a sample is committed)
docs/ARCHITECTURE.md why it's built this way — read this first
```

## Running it locally

No build step and no dependencies are required to develop. Because the reader
loads an edition over `fetch`, serve the folder over HTTP rather than opening the
file directly:

```bash
# from the repository root
python3 -m http.server 8000
# then open http://localhost:8000/src/reader/reader.html
```

To produce a single self-contained edition page:

```bash
node scripts/build.mjs content/sample-edition.json
# writes dist/<issue>.html
```

## Checks before a pull request

The engines ship with a lightweight smoke test that needs only Node (no install):

```bash
node scripts/smoke.mjs
```

If you change `personalize.js` or `search.js`, please add or update an assertion
so the behaviour you rely on is covered.

## Conventions

- **No runtime dependencies.** The framework uses only browser and Node standard
  APIs. Please keep it that way unless there's a strong reason discussed first in
  an issue.
- **Accessibility is not optional.** New UI must be keyboard-operable, have
  visible focus, and use semantic markup. Test with a screen reader where you can.
- **Legibility over cleverness.** Especially in the recommender — if a score
  can't be explained to a reader in a sentence, reconsider it.
- **Small, documented modules.** Match the existing JSDoc style.

## Working with content

Never commit real edition content. Develop against
[`content/sample-edition.json`](content/sample-edition.json), which is synthetic
placeholder text. Real editions are supplied at build time and gated on publish.

## Filing issues

Bug reports and proposals are welcome via the
[issue tracker](https://github.com/ashishbhateja/callbeyond/issues). For a change
of any size, opening an issue first to discuss the approach saves everyone time.

By contributing, you agree that your contributions to the framework are licensed
under the repository's [MIT License](LICENSE).

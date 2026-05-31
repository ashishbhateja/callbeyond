# Content

Editions of *The Call Beyond* are **gated** — the magazine is the intellectual
property of Sri Aurobindo Ashram, Delhi, and access is controlled at publish
time. For that reason, **real edition content is not stored in this repository.**

What lives here instead:

| File | Purpose |
|------|---------|
| `sample-edition.json` | Synthetic, clearly-labelled placeholder content used only to develop and demonstrate the reader framework. It is not magazine content. |

## Edition format

The reader framework ([`src/`](../src)) consumes a single JSON manifest per
edition. The shape is intentionally small:

```jsonc
{
  "edition": "April 2026",
  "issue": "2026-04",
  "articles": [
    {
      "id": "unique-slug",          // stable id, used by the reader's history
      "title": "Article title",
      "author": "Author name",
      "themes": ["Integral Yoga"],  // drives recommendations + search facets
      "readingTime": 7,              // minutes, optional
      "summary": "One- or two-line abstract.",
      "body": "Full article text or HTML."
    }
  ]
}
```

## How gating and openness coexist

The **framework** (reader, recommender, search, build pipeline) is open source
and fully inspectable. The **content** is supplied at build time and then
protected: [`scripts/build.mjs`](../scripts/build.mjs) renders an edition with
the open framework and can encrypt the result with
[StaticCrypt](https://github.com/robinmoisson/staticrypt) for gated publishing.

In other words, anyone can read, audit, and improve *how the magazine works*,
while *what the magazine contains* stays under the Ashram's control. See
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full rationale.

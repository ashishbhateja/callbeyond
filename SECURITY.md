# Security

This document describes the security posture of the **reader framework** in this
repository. It is written to be honest about what the design does and does not
protect, rather than to claim more than it delivers.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** via GitHub's “Report a
vulnerability” (the repository **Security** tab → Security Advisories), not in a
public issue. For non-sensitive concerns, a regular issue is fine.

## What the framework handles

The framework is a static, client-side reading experience. Its security surface
is deliberately small:

- **No backend.** There is no server, database, or API the framework calls at
  runtime. There is nothing to breach server-side because there is no server.
- **No third-party runtime dependencies.** The reader, recommender, search, and
  journey modules use only standard browser APIs; the build and tests use only
  the Node standard library. There is no transitive dependency tree to audit or
  to be compromised via supply chain.
- **Reader data stays on the device.** Interests, reading history, and the
  high-contrast preference are stored in the browser's `localStorage` and never
  transmitted anywhere. There is no analytics, tracking, or telemetry. A reader
  can clear everything with the “Clear my profile” control.

## Design choices that reduce risk

- **XSS-safe by construction.** The reader writes all content and user-derived
  values through `textContent` / DOM text nodes, never `innerHTML`. The build
  (`scripts/build.mjs`) HTML-escapes the few values it interpolates into the page
  template. If rich-HTML article bodies are introduced later, they must be passed
  through a sanitizer before rendering — see *Future work*.
- **No secrets in the repository.** No API keys, tokens, or credentials are
  stored here. Gated editions are encrypted at publish time; the password is
  never committed.
- **Transport security.** The site is served over HTTPS via GitHub Pages.

## Threat model for gated content

Editions are gated with [StaticCrypt](https://github.com/robinmoisson/staticrypt),
which encrypts the page with a password and decrypts it in the browser. Be clear
about what this provides:

- It is **access control**, not high-assurance secrecy. The encrypted payload is
  publicly downloadable; its confidentiality rests entirely on the strength of
  the password and StaticCrypt's key derivation.
- **Implication:** use a strong, unique edition password, and do not place
  anything in an edition that would be damaging if the password were shared or
  guessed. The gate deters casual access; it is not a guarantee against a
  determined party who obtains or brute-forces the password.

## Out of scope

- The security of GitHub Pages, GitHub Actions, and the StaticCrypt tool itself.
- The contents of individual editions (the Ashram's editorial responsibility).

## Future work

Tracked in the issue list:

- A documented OWASP-style review and a Lighthouse/automated pass as the reader
  gains interactive surface.
- A content sanitization step if/when article bodies carry HTML rather than text.

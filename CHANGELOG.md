# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[semantic versioning](https://semver.org/).

## [0.1.0] — 2026-05-31

First public version of the open-source reading framework. Content stays gated;
the framework is open and MIT-licensed.

### Added
- On-device, explainable recommendation engine (`src/personalize.js`).
- Dependency-free client-side full-text search (`src/search.js`).
- Editorial-arc "journey" engine and 2026 data (`src/journey.js`, `content/2026-arc.json`).
- Accessible reader UI with a manual high-contrast mode (`src/reader/`).
- Reproducible single-file edition build (`scripts/build.mjs`).
- Dependency-free test suite (`scripts/smoke.mjs`, 12 checks) and GitHub Actions CI.
- Documentation: README, ARCHITECTURE, VISION, CONTRIBUTING, SECURITY, and content guides.

[0.1.0]: https://github.com/ashishbhateja/callbeyond/releases/tag/v0.1.0

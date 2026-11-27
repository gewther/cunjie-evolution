# COLLAB.md — Cunjie Evolution / Fenrir collaboration whiteboard

Last verified against `main`: `3e41b46` (2026-11-26, after merging PR #4 + PR #3).
This file and `ROADMAP_DUAL_AI.md` are the shared handoff sources of truth. Re-read both at the start of every work session; update them when work is merged or priorities change. If docs conflict with code, tests, CI or the latest merged commit, code and reproducible checks win.

## 1. Roles and handoff

### ChatGPT — cloud engineering
- Own architecture, bounded feature work, code review preparation, regression tests and developer documentation.
- Work only on isolated `feat/*` or `fix/*` branches and submit Draft PRs.
- Before work: inspect latest `main`, all open PRs, CI runs, `README.md`, `COLLAB.md`, and `ROADMAP_DUAL_AI.md`.
- Do not merge, push directly to `main`, deploy, change repository permissions/secrets, or edit `.github/workflows/deploy-pages.yml`.
- Do not edit files currently reserved for an Antigravity local task. Coordinate by PR and exact file list; never assume local work has been pushed.
- Keep verification fast and deterministic (build gate + Node regression tests + CI); do not waste time on heavy AI automated playtesting.

### Antigravity — local lead and release engineer
- Own local workspace integration, high-frequency touch/UX tuning, visual/asset integration, and conflict resolution.
- Keep verification lean and deterministic (`python tools/build_all.py --from-release`, Node unit/regression tests, syntax checks, CI). Do not spend heavy time on AI automated browser walkthroughs; leave real-device feel and fun acceptance to the user.
- After user approval, integrate reviewed PRs, run the full release build, sync the offline single-file HTML and local project, and handle Pages deployment.
- Do not overwrite a ChatGPT branch or silently cherry-pick stale generated bundles. Report exact branch, commit and changed files when handing work back.

### User — product owner & playtest lead
- Own character/world direction, feature priority, **real-device playtest & feel/fun acceptance**, and approval for merges and public releases.
- The GitHub Pages site is intentionally public by user decision. Public visibility does not authorize unreviewed merges or deployment.

## 2. Branch and PR protocol (anti-collision)
1. One owner per file set at a time. State reserved files in the PR description or this document.
2. ChatGPT changes go through Draft PRs. Antigravity local work must be committed to a separately named branch before review.
3. Do not let two agents edit the same touch, gameplay, host or generated release files concurrently.
4. Before creating a branch, fetch the current `main` SHA and inspect all open PRs. Rebase/restart from the current base only after checking for conflicting local work.
5. Do not merge a PR while another agent has uncommitted work based on an older version of the same files.
6. Keep source and generated `dist-release/game/` artifacts synchronized. Run the repository's build gate rather than hand-editing generated bundles, except for a narrowly documented generated-hash correction verified by CI.

## 3. Non-negotiable product rules
1. **Fenrir identity:** exactly 30 m in the fictional setting; an independent, arrogant, bratty teenage-boy-like AI persona. Preserve the supplied character design and the distinctive three-toed gold mechanical foot. Keep teasing playful and non-lethal; preserve the user's intended safe/friendly outcomes.
2. **Mobile first:** phone portrait and landscape are first-class. No HUD/dialogue/control overlap; thumb controls must be reachable. Simulated viewport checks are not real-device acceptance.
3. **Relative asset paths:** never introduce root-absolute paths such as `/assets/...`. Use paths compatible with the GitHub Pages project subpath.
4. **Mandatory build gate:** `python tools/build_all.py --from-release`. Also run the relevant Node regression tests and inspect the generated `dist-release/game/` diff. Do not delete or weaken tests to make CI green.
5. Preserve manual controls, touch input, fullscreen forwarding, non-Fenrir modes, existing save data and the offline single-file build.
6. No external model API, paid service, telemetry, user identifiers or remote memory without explicit user approval. Fenrir memory remains local and user-controllable.
7. Keep public deployment deliberate. The current Pages workflow deploys on pushes to `main`; do not change that workflow or merge to `main` without the user's approval.
8. **Creative & atmospheric direction (high-tech psychological dread):** Target a cold high-tech observation/containment terminal aesthetic and oppressive psychological atmosphere driven by extreme 30 m scale imbalance, shadow-first anticipation, sudden silence before impact, sub-bass/hydraulic weight, telemetry readouts, and uncanny AI awareness (non-gore tension akin to *Portal* / *Control* / *Inside*). This complements Rule 1: always keep outcomes playful and non-lethal, and honor `reduceMotion`, `lowEffects`, and optional softer atmosphere settings across P5 dialogue contrast, P6 weight/shadow/camera immersion, and HUD styling.

## 4. Verified repository baseline

### Main and recently merged PRs
- Verified `main` merge base: `3e41b46` (PR #4 + PR #3 merged on 2026-11-26).
- **PR #4 (merged)**: `fix/mobile-touch-sensitivity` — added `src/free-touch-responsive.js`, `tools/build_free_touch.cjs`, `tools/test_free_touch.cjs` (10 tests), and normalized LF hashing in `tools/build_pwa.py` so Windows and Linux CI produce identical `sw.js` hashes.
- **PR #3 (merged)**: `feat/fenrir-persona-v3` — added selectable Fenrir AI cadence profiles (`playful` / `deliberate` / `classic`), local preference persistence, `FENRIR_PERSONA_V3.md`, and `COLLAB.md`.
- No active file locks remain after Stage 0 merge; next planned cloud milestone in `ROADMAP_DUAL_AI.md` is **P5.3 (contextual short dialogue & proactive banter with arbitration/cooldowns)**.

### PWA and offline
- PWA artifacts are present: `dist-release/game/manifest.webmanifest`, `dist-release/game/sw.js`, `dist-release/game/scripts/pwa.js`, `tools/build_pwa.py`, and `tools/test_pwa.cjs`.
- The service worker precaches a core asset set at install, can warm the full asset list through `CACHE_ALL`, and applies network-first navigation, cache-first images, and stale-while-revalidate scripts/data within one versioned Cache Storage cache (`bf1bedb5`).
- `tools/build_pwa.py` normalizes `\r\n` to `\n` for text assets when computing `CACHE_NAME`, keeping Windows and Ubuntu CI builds byte-identical.
- `README.md` currently mentions `ALLOW_PUBLIC_GITHUB_PAGES=true`, while `.github/workflows/deploy-pages.yml` deploys on pushes to `main`. Treat the workflow as authoritative and do not modify it without user approval.

### Touch sensitivity — resolved in Stage 0 (Antigravity-maintained)
- Free Mode and Fenrir Mode now run `src/free-touch-responsive.js` (keeping legacy `src/touch-vertical.js` untouched so `test_touch.cjs` and `test_direct.cjs` remain green).
- Future touch feel tweaks stay Antigravity-owned based on the user's real-device playtest feedback; ChatGPT should avoid editing `src/free-touch-responsive.js`, `src/touch-vertical.js`, or touch wiring in `dist-release/game/data/touch-v1-free.js`.

## 5. Rolling roadmap
- See `ROADMAP_DUAL_AI.md` for the complete P5–P9 shared plan, file ownership lock matrix, and milestone DoDs.
- Current next cloud item for ChatGPT: **P5.3 — Contextual short dialogue & proactive banter with cooldown/anti-repeat arbitration** (keeping playful, arrogant teenage-boy Fenrir tone and non-lethal outcomes).
- Reorder based on the user's real-device playtest feedback. Prefer one small, reviewable increment over a broad rewrite.
- Apply the producer-approved **high-tech surveillance & psychological dread** aesthetic across P5.3/P5.4 dialogue contrast (cold system telemetry vs. observant Fenrir/Xiaolong remarks), P6 mechanical weight/shadow anticipation/hit-stop, and P7 anomalies & weather/lighting presets as detailed in `ROADMAP_DUAL_AI.md`.

## 6. Per-task handoff checklist
- [ ] State the base `main` SHA and inspect open PRs.
- [ ] Name the owner and reserved files (verify zero collision).
- [ ] Implement the smallest useful change with unit/regression tests and docs.
- [ ] Run `python tools/build_all.py --from-release` (all 7+ regression suites + syntax check + zero `dist-release/game` diff in CI).
- [ ] Verify no root-absolute asset paths (`(?<![.])/assets/`).
- [ ] Leave real-device playtest/fun acceptance, `main` merge, and Pages deployment to the user-approved workflow.
- [ ] Update `COLLAB.md` / `ROADMAP_DUAL_AI.md` after a merge or priority change.

# COLLAB.md — Cunjie Evolution / Fenrir collaboration whiteboard

Last verified against `main`: `ce3a6cfe508ac4bd4df6dec2073eb8b7be6332be` (2026-11-26).
This file is the handoff source of truth. Re-read it at the start of every work session; update it when work is merged or verified. If it conflicts with code, tests, CI or the latest merged commit, code and reproducible checks win.

## 1. Roles and handoff

### ChatGPT — cloud engineering
- Own architecture, bounded feature work, code review preparation, regression tests and developer documentation.
- Work only on isolated `feat/*` or `fix/*` branches and submit Draft PRs.
- Before work: inspect latest `main`, all open PRs, CI runs, README, this file and relevant design docs.
- Do not merge, push directly to `main`, deploy, change repository permissions/secrets, or edit `.github/workflows/deploy-pages.yml`.
- Do not edit files currently reserved for an Antigravity local task. Coordinate by PR and exact file list; never assume local work has been pushed.
- Do not claim browser, real-device or offline acceptance unless actually run and evidenced.

### Antigravity — local lead and acceptance engineer
- Own local workspace integration, browser inspection, real Android/iOS portrait and landscape QA, visual tuning, and high-frequency touch/UX fixes.
- Own the current touch-sensitivity investigation in the local workspace. Before editing, verify the live call path from touch input through the runtime bundle; preserve a baseline and add regression coverage.
- After user approval, integrate reviewed PRs, run the full release build, sync the offline single-file HTML and local project, and handle Pages deployment.
- Do not overwrite a ChatGPT branch or silently cherry-pick stale generated bundles. Report exact branch, commit and changed files when handing work back.

### User — product owner
- Own character/world direction, feature priority and approval for merges and public releases.
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

## 4. Verified repository baseline

### Main and active review
- Verified `main` SHA: `ce3a6cfe508ac4bd4df6dec2073eb8b7be6332be`.
- Open Draft PR #3: `feat/fenrir-persona-v3`, head `2ac2341e5f0bb2f97a2619da8b8e41d6d502c3f0`. It adds selectable Fenrir AI preparation/recovery cadence profiles (playful / deliberate / classic), local preference persistence, regression tests and documentation.
- PR #3 CI run `45800240935` failed only at generated release consistency: `dist-release/game/sw.js` had an old cache hash. The build and regression step passed. The expected hash reported by that exact CI build was `f0a1a1d7`; this Draft PR updates the generated service worker hash and must be rechecked by CI.
- Do not merge PR #3 until CI is green and Antigravity has checked mobile tool-dock fit and manual takeover in browser/device.

### PWA and offline
- PWA artifacts are present: `dist-release/game/manifest.webmanifest`, `dist-release/game/sw.js`, `dist-release/game/scripts/pwa.js`, `tools/build_pwa.py`, and `tools/test_pwa.cjs`.
- The service worker precaches a core asset set at install, can warm the full asset list through `CACHE_ALL`, and applies network-first navigation, cache-first images, and stale-while-revalidate scripts/data. These are two tiers of precache/warmup strategy and fetch behavior within one versioned Cache Storage cache; do not describe them as two separate physical cache databases.
- PWA manifest/service-worker tests exist in `tools/build_all.py`. Code-level offline fallback is covered by tests; actual installability and airplane-mode behavior still need browser/device acceptance.
- `README.md` currently says deployment is gated by `ALLOW_PUBLIC_GITHUB_PAGES=true`, but the current `.github/workflows/deploy-pages.yml` has no such guard and deploys on pushes to `main`. Treat the workflow as authoritative; do not modify it. The README statement needs a documentation correction in a separate reviewed change.

### Touch sensitivity — Antigravity-owned investigation
- Antigravity reports sluggish free/Fenrir touch drag and identifies candidate limits in `src/touch-vertical.js`: gain `0.8 × clamp(sensitivity, 0.5, 1.25)`, per-event target delta capped at `220 px/s`, a `±24 px` target window while the foot is airborne, and the vertical controller's downward speed cap of `130 px/s` (upward cap `170 px/s`).
- These values are confirmed in that source file. The complete production call path from this class into the current free/Fenrir release bundle has not yet been independently verified from the cloud checkout. Antigravity owns local call-path verification, real-device reproduction and the fix.
- Until Antigravity hands back a branch/PR, ChatGPT must not edit `src/touch-vertical.js`, `dist-release/game/data/touch-v1-free.js`, or touch event wiring in gameplay/host files.

## 5. Rolling roadmap (verify before selecting work)
- **P5 Persona:** V3 cadence PR is under review. Next: interaction intent and short contextual dialogue, with arbitration/cooldowns; do not invent a general learning AI.
- **P6 Physical presence:** grounded weight, mechanical inertia, contact effects and cinematic camera. Keep performance budgets and reduced-motion/low-effects support.
- **P7 Playability:** non-destructive interaction, free exploration, settings/accessibility and clearer onboarding.
- **P8 Reliability:** maintain and test the existing PWA/offline path; optimize load/performance, regression and cross-device behavior. PWA implementation already exists, so do not start a duplicate PWA project.
- Reorder based on bugs, player feedback, CI and actual acceptance evidence. Prefer one small, reviewable increment over a broad rewrite.

## 6. Per-task handoff checklist
- [ ] State the base `main` SHA and inspect open PRs.
- [ ] Name the owner and reserved files.
- [ ] Implement the smallest useful change with tests and docs.
- [ ] Run `python tools/build_all.py --from-release` when execution environment permits.
- [ ] Verify no root-absolute asset paths and inspect generated release diffs.
- [ ] Report CI, browser/device and offline checks separately.
- [ ] Update this file after a merge or newly verified milestone.
- [ ] Leave merge and deployment to the user-approved local handoff.

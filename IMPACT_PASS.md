# AJ6 Impact Feel v1

Candidate: `/impact.html`. Baseline: `/`. Asset gallery: `/impact-art.html`.

Scope: AJ6 / Act I only. The candidate uses its own save key. AJ5 and later acts keep the legacy control and feedback path. The original deployed baseline files remain unchanged.

- Generated one transparent 16-cell raster atlas: four ground contact/scuff states, four outsole transfer patches, four adhesion/separation states, four clothed non-graphic NPC states. The actual output is 1254×1254; source rectangles are measured from alpha rather than assuming the requested 1024 dimensions.
- New events record actual hit world position, foot-local position and cycle. Persistent ground marks remain in world coordinates. Sole transfer is clipped using the existing AJ6 F1/F2 masks; F2 uses the retained affine mapping. Three latest current-cycle contacts may form short distance-limited connections.
- Down trajectory: 0.23 seconds. Actual-hit lift: 0.43 seconds; empty lift: 0.32 seconds. Contact pressure starts near 0.12, pauses for 65 ms, then rises at 2.45 units/second while held. These are tuning values, not a claim that every user action lasts the same time.
- Existing engine ground collision sounds retained. Target crush/pop/squishy accents are coalesced through one actual-hit bus; extra accents at increasing pressure, plus one rate-limited separation sound. Reuses original samples; no new sound recording. Parent synthesized foot accents and neon halo disabled for the AJ6 candidate only.
- Replaced the candidate's legacy stain/strand/sticker drawing while retaining underlying collision and attachment state. Existing shoe atlas, masks, scenery, dialogue and scoring implementation remain intact.

Build: `python3 tools/build_impact.py`. Controller verification: `node tools/test_impact.cjs`.

Controller tests cover actual descent/lift duration, progressive pressure, no target accent on an empty press, duplicate-hit suppression, stationary ground anchors, release counting, and scope isolation. They do not replace browser or Android acceptance.

Known limits: contact axis uses the existing 2D F1/F2 registration, not a physical 3D sole model; art style and phone sound balance still require user assessment. Human body-state art is a clothed stylization. Baseline mobile control size and other-act visual issues are outside this pass.

New raster generated with the built-in image tool. Full prompt is retained in `src/impact-art-prompt.txt`; runtime atlas is `dist/assets/impact/impact-atlas-v1.png`.

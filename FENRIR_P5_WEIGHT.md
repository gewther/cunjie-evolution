# Fenrir P5.1 — Mechanical weight pass

## Scope
- Fenrir city mode only. The 30 m fictional height and existing city scale remain unchanged.
- Grounded leg rendering uses a bounded, critically-damped-style suspension envelope with a maximum 5.8% visual compression, preserving the sole contact anchor and sprite width.
- A firm landing leaves a world-anchored wet contact imprint, fading over 3.2 seconds, plus two staggered water fronts. Soft landings have one front.
- At most six imprints; clears when low-effects or reduced-motion mode is selected, or the simulation clock resets.
- Existing impact sounds, haptics, particles, controls, collisions, AI and HUD are not replaced.

## Calibration
These are art-direction parameters in the existing logical coordinate system, not a physical mass/force calculation. A wet road imprint is a visual cue, not simulated asphalt deformation. The current camera scrolls decorative scenery, not the gameplay coordinate system.

## Verification
Run `python3 tools/build_all.py --from-release`. The scene regression checks contact anchoring, force-dependent settling, lifetime, secondary wave timing, six-mark budget, support contact exclusion, reset and accessibility settings.

Before merging, visually compare soft/firm landings, repeated landings, horizontal movement, low-effects/reduced-motion modes, and mobile portrait/landscape. Check that the HUD and input behavior stay intact. CI is not a substitute for actual browser/device QA.

## P5 persona preview
The existing autonomous movement controller is retained. A session-local director tracks AI handoffs, manual interruptions, active autonomous time, and charge/overdrive transitions. It emits context-specific lines through the existing speech arbitration state, with a five-second minimum interval and a twelve-second idle interval. Existing gameplay lines have priority. The director respects the auto-dialogue preference and resets when the simulation clock restarts. It adds no new combat or physics commands and does not persist data across reloads. Inspect the state with `window.__fenrirPersona()` in the game iframe.

The build normalizes CRLF/LF in embedded controls and bridge sources before serializing them, to keep Windows and Linux release builds identical.

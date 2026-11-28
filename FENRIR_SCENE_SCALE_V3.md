# Fenrir City Scale v3 — Towering Urban Cues

## Visual objective

The current Fenrir camera remains a 25 m × 15 m ground-contact close-up. This pass keeps that gameplay framing and the existing 16 px/m street reference scale, while making the city read as a much taller built environment.

The far skyline now contains five high-rise facade groups whose upper edges intentionally continue beyond the top of the 15 m viewport. Repeating window grids, vertical mullions, service-light rails and sparse red obstruction lights communicate that the structures continue above the camera crop. The existing mid- and near-layer street work remains independently owned by the city-art PR.

The 30 m Fenrir silhouette is still outside this gameplay camera. This is a ground-level composition upgrade, not a claim that the entire mech is now visible.

## Impact response

A confirmed Fenrir landing produces a short damped vertical vibration in the distant architecture:

- Far skyline: 0.45 response gain.
- Mid buildings: 1.00 response gain.
- Near road: 0.00 response gain; road markings and contact effects remain world-locked.
- Oscillation envelope: 0.46 s maximum lifetime with an 0.18 s exponential decay.
- Strength scales with the landing force and is bounded by the source effect.

The vibration is cleared immediately when reduced-motion or low-effects preferences are enabled. It does not alter collision geometry, the foot contact plane, camera tracking, NPCs, hunt waves, save data, or custom skin packs.

## Validation

Run:

```sh
python tools/build_all.py --from-release
```

The Fenrir scene regression checks verify the tower-scale SVG cue, layer order, camera continuity, distinct far/mid/near landing response, fixed near-road position, reduced-motion and low-effects suppression, decay, sole anchoring, wet-road marks, and graceful texture fallback.

Real-device visual feel remains a producer acceptance task. The added effect is intentionally subtle so it layers beneath the existing global impact zoom and screen shake rather than competing with them.

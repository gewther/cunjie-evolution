# Fenrir City Scale v2

## World scale

- Scene width: **2,400 px = 150 m** at the horizontal reference scale of **16 px/m**.
- Scene height: **240 px = 15 m** in the ground-level game viewport.
- Logical viewport: **400 × 240 px = 25 m × 15 m**.
- A 4.5 m passenger car is represented by about 72 px; a 6 m street lamp by about 96 px.
- The near-layer road surface occupies y=194..240. Lane markings stay at y=228 to align with the existing floor_y=228 contact plane.

The Fenrir character's stated height is 30 m, equivalent to 480 px at this horizontal reference scale. The current 240 px viewport is deliberately a ground-contact / lower-leg close-up, so the full 30 m silhouette is outside this camera framing. The street furniture and vehicles provide visible scale references around the foot. Showing the entire machine silhouette would require a separate camera composition or a taller logical viewport, not stretching these ground-plane assets.

## Parallax and camera

| Layer | Source width | Parallax | Purpose |
|---|---:|---:|---|
| Far skyline | 2,400 px | 0.12× | Distant skyline and atmospheric depth |
| Mid buildings | 2,400 px | 0.36× | Building fronts, shops and block silhouettes |
| Near street | 2,400 px | 1.00× | Road, markings, vehicles, lamps and barriers |

The 400 px viewport can travel across a 2,000 px scroll range. The camera uses a 16%-of-viewport half-width dead zone around the center. It begins tracking when the paw leaves that zone, adds a small 55 ms directional look-ahead capped at 120 px, and eases toward the target at 7 s⁻¹. Reduced-motion mode returns the camera to the world center and removes look-ahead.

The near road uses 1.0× source movement so road markings and street props remain locked to the ground plane. Far and mid layers move more slowly to create depth.

## Scope and compatibility

This pass changes only the Fenrir city SVG layers and the Fenrir background adapter. It does not change:

- Collision masks, paw movement or contact physics
- NPC movement, runner logic or evacuation-wave logic
- Save data, skin packs or other Free Mode backgrounds
- The existing fallback path when a city texture fails to load

The existing src/free-impact-v6.js and src/immersion-v1.js continue to own wet-asphalt contact effects, paw squash, impact rings, splash particles, looming shadow, rain-lens effects and mobile haptics. This scene pass does not duplicate those systems.

## Validation

Run:

```sh
node tools/test_fenrir_scene.cjs
```

The regression test covers SVG dimensions, ground-line alignment, isolated build integration, byte-identical asset copying, GitHub Pages subpath URLs, async texture loading, three-layer order, dead-zone camera behavior, directional look-ahead, reduced motion, non-Fenrir passthrough and graceful asset-load fallback.

A passing CI run validates code and mocked runtime behavior. Browser visual review and Android/iOS device testing remain separate acceptance steps.

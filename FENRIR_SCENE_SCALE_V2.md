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

The 400 px viewport can travel across a 2,000 px scroll range. Inside the 64 px half-width dead zone, the camera holds the current crop. On exit the target moves from that crop toward the corresponding street edge, with filtered 55 ms look-ahead capped at 120 px and tapered at both ends of the transition. Reduced-motion mode returns the camera to the world center, clears prediction, and suppresses the Fenrir iframe's CSS impact motion.

The near road uses 1.0× source movement. Its static pools, moving water marks, street furniture, and lane markings share the same crop offset. New water marks are capped at three and drawn for up to 0.85 simulated seconds. The center crop includes a car, a lamp and a pool near the contact band.

## Mechanical foot contact

The built-in Fenrir front foot uses the motion atlas sole geometry at the grounded draw call. With no NPC supporting the foot, the visible sole sits at the existing `floor_y=228` plane while the upper leg compresses and recovers around that contact point. The rear foot retains its deeper ground reference. The wet-road pass reads the existing landing event and converts its contact point to a street coordinate. Reduced-motion and low-effects modes skip this additional road pass.

## Scope and compatibility

This pass changes only the Fenrir city SVG layers and the Fenrir background adapter. It does not change:

- Collision masks, paw movement or contact physics
- NPC movement, runner logic or evacuation-wave logic
- Save data, skin packs or other Free Mode backgrounds
- The existing fallback path when a city texture fails to load

The existing src/free-impact-v6.js and src/immersion-v1.js continue to own wet-asphalt contact effects, paw squash, impact rings, splash particles, looming shadow, rain-lens effects and mobile haptics. This scene pass does not duplicate those systems.

## Validation

Build the Fenrir release and standalone offline HTML from a clean checkout:

```sh
python3 tools/build_all.py --from-release
```

This regenerates the Fenrir adapter, host bridge, and assets in `dist-release/game` and writes `dist/cunjie-offline.html`. The browser build loads the named files. The offline HTML embeds the same adapter and SVGs. The original full legacy build uses the original `dist/` workspace as its input.

CI verifies the actual embedded host and engine source, the regenerated release files, syntax, and the contact, impact, touch and Fenrir regressions. The Fenrir tests cover directional lead, dead-zone transition continuity, grounded sole geometry, world-space water marks, and fallback after a missing or oversized texture.

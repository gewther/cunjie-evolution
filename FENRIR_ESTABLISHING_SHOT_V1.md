# Fenrir Establishing Shot v1

## Purpose

Add a short, skippable low-angle full-body establishing shot before the Fenrir simulation begins. The shot gives the player one stable frame of reference for the 30 m unit before gameplay returns to the existing foot-level camera.

## Scale and framing

The composition reuses the existing Fenrir city far, mid, and near SVG layers. The near layer supplies the established street furniture and vehicle artwork; the establishing shot preserves the intended scale relationships:

| Reference | World height / length | Intended relation to Fenrir |
|---|---:|---:|
| Fenrir | 30.0 m tall | 1.00 |
| Service block | 18.0 m tall | 0.60 |
| Streetlight | 6.0 m tall | 0.20 |
| Vehicle | 4.5 m long | 0.15 |
| Human silhouette | 1.8 m tall | 0.06 |

- Landscape composition: 1600 × 900 viewBox. Fenrir occupies approximately 720 px vertically; the 6 m lamp is approximately 144 px.
- Portrait composition: 900 × 1600 viewBox. Fenrir occupies approximately 950 px vertically; the 6 m lamp is approximately 190 px.
- The low camera angle, road perspective, rain, wet-surface reflections, and cyan reactor/eye glow establish mass and height.
- The body illustration is an isolated inline SVG group (`#fenrir-unit-body`). It can later be replaced by a higher-fidelity render without changing the pause, skip, timing, or responsive-layout code.

## Interaction

1. The Fenrir scene bridge records the existing pause state and pauses simulation before the first active frame.
2. The overlay appears inside the Fenrir iframe, so it does not modify host navigation or the shared game UI.
3. The player can skip with the visible touch-sized button, Escape, Enter, or Space.
4. The shot auto-dismisses after 5.2 seconds.
5. The finish handler is idempotent and restores the pause state that existed before the shot.

When reduced motion or low-effects mode is active, the shot uses a static composition and a 3.0 second duration. The progress indicator remains available.

## Scope boundaries

- No changes to gameplay hitboxes, collision geometry, physics, camera tracking, damage, or combat timing.
- No changes to the public deployment workflow or GitHub Pages settings.
- No new external image or network dependency.
- Existing city layers are resolved through `window.__cunjieFenrirSceneLayers` when the offline builder provides data URIs, with relative asset URLs as the online fallback.

## Validation

`tools/test_fenrir_scene.cjs` covers:

- 30 m, 18 m, 6 m, and 4.5 m scale markers;
- landscape and portrait viewBox selection;
- reduced-effects timing;
- skip idempotence and timer cleanup;
- safe fallback when the document body or timer API is unavailable.

The CI build generated PWA cache key `0366ebf4`. The release scene script, generated host bridge, and service-worker cache key were synchronized to that build output.

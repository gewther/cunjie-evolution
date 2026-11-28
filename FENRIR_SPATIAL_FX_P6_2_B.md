# Fenrir Spatial FX — P6.2-B

## Scope

This increment is deliberately Fenrir-first. The existing 150 m city already has three world-locked/parallax layers (0.12 / 0.36 / 1.0); this pass reuses that camera and adds the missing ground-space cues without changing the city renderer, collision, NPC behavior, hunt waves, save data, touch controls or host UI.

## Implemented effects

- **Height-aware directional shadow:** derive the foot's lift from the existing `paw_y` / `floor_y` coordinates. The ground shadow broadens and shifts away from the blue-hour key light as the foot rises, then tightens on contact.
- **Civilian shadowing:** small characters close to the ground receive a restrained cool tint on their sprite only while they are inside the projected shadow. A hard cap of 28 shaded civilians per frame prevents unbounded overlay work.
- **Rain-road reflection proxy:** reuse the existing floor graphics primitives for two narrow cyan specular bands. The highlight follows the same world-space shadow anchor and fades as the foot rises. This is a lightweight wet-surface reflection cue, not a second full-resolution mirrored render of the foot.
- **Accessibility and performance:** no new textures, image loads, particles, timers or network calls. `lowEffects` keeps one reflection band; `reduceMotion` centers a static soft shadow and disables the animated sheen. If the city textures fail, the new effects fail closed.

## Integration

- `src/fenrir-spatial-fx-v1.js` is injected into the Fenrir iframe after the art runtime and before `src/fenrir-scene-bridge.js`.
- `tools/build_fenrir_scene.cjs` includes the module in the generated legacy iframe bridge.
- `tools/test_fenrir_spatial_fx.cjs` covers projection direction, height response, NPC shadow coverage, effect budgets and fallback behavior.

## Acceptance

Run:

```sh
python tools/build_all.py --from-release
```

Then visually inspect a low-angle rain-city scene on desktop and phone:

1. Raise and lower the foot: shadow width/offset should follow height smoothly.
2. Move civilians across the shadow boundary: only nearby figures should darken.
3. Land on wet asphalt: the specular bands should sit under the foot and remain fixed to the road as the camera moves.
4. Enable Low Effects and Reduce Motion: the visual budget should drop without breaking the base floor pass.

Real-device visual feel and performance remain producer acceptance items.

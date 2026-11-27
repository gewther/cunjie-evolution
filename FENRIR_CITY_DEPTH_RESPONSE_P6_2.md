# Fenrir City Depth Response — P6.2

## Intent

The existing three-layer Fenrir city remains a 25 m × 15 m ground-contact view. This increment adds a restrained environmental response to heavy landings so the impact is transmitted into the surrounding architecture.

## Layer response

- Far skyline: 0.45 response gain.
- Mid buildings: 1.00 response gain.
- Near road: 0.00 response gain; road markings and contact effects remain world-locked.
- Oscillation: damped sine wave with a 0.18 s exponential decay and a 0.46 s hard lifetime.
- Strength: scales with the confirmed landing force and is bounded.

The response is triggered by the existing Fenrir landing event. It does not add a second impact detector or alter the collision/contact pipeline.

## Accessibility and compatibility

- `reduceMotion` clears the response immediately.
- `lowEffects` clears the response immediately.
- No changes to collision geometry, foot contact plane, camera tracking, NPCs, hunt waves, save data, touch controls, or custom skin packs.
- The near road stays fixed so lane markings and wet-road contact effects do not slide under the foot.
- The effect is deliberately subtle and sits beneath the existing global impact zoom and screen shake.

## Validation

Run:

```sh
python tools/build_all.py --from-release
```

The Fenrir scene regression suite checks the distinct far/mid/near response, reduced-motion and low-effects suppression, decay, camera continuity, sole anchoring, world-space water marks, and graceful texture fallback.

Real-device visual feel remains a producer acceptance task.

# Fenrir Persona V3 — autonomous choreography

## Scope
Fenrir-only optional timing layer on the existing autonomous controller. It changes the preparation (raise) and recovery phase speed factor, without changing aim, descent, pressure, collision, target selection, manual controls or game scoring. The existing controller's timing clamps remain authoritative.

| Mode | Raise factor | Recover factor |
|---|---|---|
| Playful / 灵动 (default) | 0.92, 0.78, 1.02 cycling by sequence | 1.02, 0.90, 0.80 |
| Deliberate / 从容 | 0.76 | 0.82 |
| Classic / 原版 | 1 | 1 |

These are multipliers on the existing controller speed factor, not physical movement speeds. The dock button cycles the mode and saves the preference under cunjie-fenrir-cadence-v3 locally. The setting is independent of the optional memory counters. No network calls or save schema changes.

## Acceptance
- Run python3 tools/build_all.py --from-release and verify dist-release/game is unchanged after build.
- Tests cover modes, bounded phase multipliers, integration with the actual existing controller, and interruption of AI commands on manual handoff.
- Browser QA pending: compare three modes with identical base settings; ensure manual and touch inputs immediately override AI; check collapsed dock scrolling on short mobile landscape; reload and verify preference.
- This is authored choreography, not a trained AI or autonomous learning system.

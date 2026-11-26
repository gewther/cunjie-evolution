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

## P5.3 — Contextual reactions

- During manual play, the Fenrir persona can comment once per hover when the foot stays above the street and within a small movement window for 1.4 simulation seconds.
- Three distinct landings within four simulation seconds can prompt a short reaction. A single landing counts once even if its gameplay marker spans several frames. Toggling control, pausing, restarting, or muting dialogue clears the current sequence.
- Taking over from the autopilot by touching the stage or using a manual action gets a different response from switching AI off through the tool menu.
- All reactions use the existing dialogue preference and bubble. Gameplay speech holds priority. The persona keeps a shared five-second cooldown, expires queued lines after eight seconds, and rotates the lines in each reaction.
- On a phone, check that the first press takes control immediately and that the bubble and upper-right tool menu remain clear of the play area.

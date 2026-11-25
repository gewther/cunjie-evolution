# Absolute touch + stronger sole residue

Baseline commit 224f94981c46215d1bd6a34c121b0140a693f988 (Site v7). User explicitly requested the foot follow the finger's actual location, replacing relative controlled descent in the experimental story/practice engine.

Pointer X/Y now maps to world position without the previous chase filter; vertical contact clamps at the floor, the last floor-to-bottom segment maps to pressure. Finger release keeps the current position. Manual motion no longer uses old downstroke speed/acceleration caps; this is an intentional behavior change, not an accidental regression. Existing automatic motion remains separate.

Sole marks start at .80 opacity strength instead of .48 and render at 30–35 units width instead of 18–22. Loaded shoes dragged across the floor while grounded and pressing leave fixed scuff marks at bounded intervals. Up to 24 ground marks; sole strength gradually wears down during scuffing. No new damage system.

Built embedded JavaScript syntax checked. Five direct-controller behaviors checked (exact height, upstroke, floor clamp, pressure, release hover). Prior relative-gesture replay page expectations no longer describe the new manual mode and were not claimed as passing. Subjective alignment and Android feel left to user. To rebuild: build_experience.cjs, build_residue.cjs, build_direct.cjs in that order. Restore Site v7 to revert.

# Default helical gear import test

Generated from converter fix commit `bddb6eba0e2ebe526a44eb0c48bafcbd386cdd64` in [PR #3](https://github.com/tscircuit/jscad-to-parasolid/pull/3), using JSCAD Electronics 0.0.190 and the `helicalgear` model string with no overrides. Coplanar merging is enabled. The body-region chain starts with the exterior void, and nominal geometry state is 1.

Defaults: 24 teeth, module 1 mm, face width 5 mm, pressure angle 20°, helix angle 20°, right handed, 12 segments per tooth, 32 segments per turn. Bore, hub, backlash and phase are zero; clearance is 0.25 mm. Parasolid stores coordinates in metres.

Import `default-helicalgear-fixed.x_t` as a new body in Shapr3D, then repeat the circular hole cut on the flat cap. This test file is supplied to confirm native Parasolid editing behavior; validation through OpenCascade is a separate check.

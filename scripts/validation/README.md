# Native X_T validation and visual snapshots

These tests read the actual exported `.x_t` through the independent
[parasolid-kit](https://github.com/monozukuri-ai/parasolid-kit) parser, reconstruct
an OpenCascade B-Rep, check topology/volume/bounds without healing, and tessellate
that B-Rep to GLB. PoppyGL renders the GLB to a PNG snapshot. They do not render
the source JSCAD mesh as a substitute for testing the exported file.

OpenCascade does not read Parasolid directly; parasolid-kit supplies the X_T
reader and conversion. Its supported format subset is sufficient for the planar
solids this package writes. This is useful independent validation, but it does
not certify native Siemens Parasolid or Shapr3D compatibility.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/validation/requirements.txt
bun test tests/visual
```

Set `PARASOLID_PYTHON` to use another Python environment containing the pinned
requirements. CI must install these requirements and run the visual tests; a
missing native dependency is a failure, not a skipped success.

```sh
# Deliberate snapshot updates; inspect every changed PNG before committing.
BUN_UPDATE_SNAPSHOTS=1 bun test tests/visual

# Convert an exported model for inspection outside the test runner.
.venv/bin/python scripts/validation/parasolid-to-glb.py model.x_t model.glb \
  --report report.json
```

The script assumes native X_T coordinates are meters, as written by
`parasolidts`, and reports OCCT measurements in millimeters (area in mm² and
volume in mm³). GLB coordinates follow glTF's meter convention.

Test artifacts (`model.x_t`, `model.glb`, `report.json`, `model.png`, and a
`diff.png` on mismatch) are kept under `tests/visual/.artifacts/`. Tracked PNG
baselines are in `tests/visual/__snapshots__/`. The suite compares source JSCAD
volume and dimensions with independently reconstructed OCCT solids, and covers
reflected/translated boxes (including class-based canonical reserialization),
boolean holes, assemblies, SOIC8, and modelprinter sheet-metal channel and NEMA8
models.

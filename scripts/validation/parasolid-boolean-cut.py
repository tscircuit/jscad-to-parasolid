"""Check circular cuts after independently reading X_T into OpenCascade.

This exercises the reconstructed B-Rep, not the Siemens Parasolid kernel.
Native XT region ordering is checked separately by the TypeScript regression.
"""

import json
import math
import sys
from pathlib import Path

from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepClass3d import BRepClass3d_SolidClassifier
from OCP.BRepGProp import BRepGProp
from OCP.BRepPrimAPI import BRepPrimAPI_MakeCylinder
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_IN, TopAbs_OUT
from OCP.gp import gp_Ax2, gp_Dir, gp_Pnt
from parasolid_kit import read_brep
from parasolid_kit.interop.occt import to_occt


def volume(shape):
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    return props.Mass()


def check(path):
    parsed = read_brep(path)
    if not parsed.complete:
        raise ValueError("Incomplete native X_T")
    converted = to_occt(
        parsed.brep, source_unit="m", target_unit="mm",
        require_complete=True, heal=False,
    )
    shape = converted.shape
    if not BRepCheck_Analyzer(shape).IsValid():
        raise ValueError("Invalid imported solid")
    box = converted.report.to_dict()["metrics"]["bounding_box"]
    bottom, top = box[2], box[5]
    height = top - bottom
    cuts = []
    for x, radius in [(0, 3), (4, 1)]:
        tool = BRepPrimAPI_MakeCylinder(
            gp_Ax2(gp_Pnt(x, 0, bottom - 1), gp_Dir(0, 0, 1)),
            radius, height + 2,
        ).Shape()
        operation = BRepAlgoAPI_Cut(shape, tool)
        operation.Build()
        if not operation.IsDone():
            raise ValueError("Cylinder subtraction did not finish")
        result = operation.Shape()
        if not BRepCheck_Analyzer(result).IsValid():
            raise ValueError("Cylinder subtraction produced invalid topology")
        midpoint = (bottom + top) / 2
        hole = BRepClass3d_SolidClassifier(result, gp_Pnt(x, 0, midpoint), 1e-7)
        material = BRepClass3d_SolidClassifier(result, gp_Pnt(6, 0, midpoint), 1e-7)
        if hole.State() != TopAbs_OUT or material.State() != TopAbs_IN:
            raise ValueError("Cut did not remove the hole interior and retain surrounding material")
        removed = volume(shape) - volume(result)
        # The offset cylinder is disjoint from the pre-existing bore.
        # Reported OCCT bounds include a tolerance margin around the true height.
        if x == 4 and not math.isclose(removed, math.pi * radius**2 * height, abs_tol=1e-5):
            raise ValueError("Wrong removed volume")
        cuts.append({"x": x, "radius": radius, "volume": volume(result), "removed": removed})
    return {"source": str(path), "cuts": cuts}


if __name__ == "__main__":
    print(json.dumps([check(Path(path)) for path in sys.argv[1:]]))

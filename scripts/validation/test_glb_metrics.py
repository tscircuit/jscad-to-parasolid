"""Small corruption regressions; no native CAD dependencies are needed."""

import json
import math
import struct
import unittest

from glb_metrics import audit_glb_mesh


POINTS = [(0, 0, 0), (0.001, 0, 0), (0, 0.001, 0), (0, 0, 0.001)]
FACES = [(0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3)]


def fixture(body_count=1, corruption=None):
    binary = bytearray()
    accessors, views, primitives, metadata = [], [], [], []

    def accessor(values, kind, fmt, component):
        offset = len(binary)
        binary.extend(struct.pack("<" + fmt * len(values), *values))
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(binary) - offset})
        accessors.append({"bufferView": len(views) - 1, "componentType": component,
                          "count": len(values) // (3 if kind == "VEC3" else 1), "type": kind})
        return len(accessors) - 1

    for body in range(body_count):
        for face, indices in enumerate(FACES):
            target = f"face:{body}:{face}"
            metadata.append({"kind": "face", "target_key": target, "body_ids": [body]})
            if corruption == "missing" and body == face == 0:
                continue
            points = [POINTS[i] for i in indices]
            a = [points[1][i] - points[0][i] for i in range(3)]
            b = [points[2][i] - points[0][i] for i in range(3)]
            normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                      a[0] * b[1] - a[1] * b[0]]
            size = math.sqrt(sum(x * x for x in normal))
            normal = [x / size for x in normal]
            triangle = [0, 1, 2]
            if body == face == 0:
                if corruption == "normal":
                    normal = [-x for x in normal]
                elif corruption == "degenerate":
                    triangle = [0, 0, 2]
                elif corruption == "nonmanifold":
                    triangle = [0, 1, 2, 0, 1, 2]
                elif corruption == "winding":
                    triangle = [0, 2, 1]
                    normal = [-x for x in normal]
            if corruption == "inward":
                triangle = [0, 2, 1]
                normal = [-x for x in normal]
            positions = accessor([x for point in points for x in point], "VEC3", "f", 5126)
            normals = accessor(normal * 3, "VEC3", "f", 5126)
            index = accessor(triangle, "SCALAR", "I", 5125)
            primitives.append({"attributes": {"POSITION": positions, "NORMAL": normals},
                               "indices": index, "extras": {"targetKey": target}})
    document = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": [0]}],
                "nodes": [{"mesh": 0}], "meshes": [{"primitives": primitives}],
                "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(binary)}]}
    payload = json.dumps(document).encode()
    payload += b" " * (-len(payload) % 4)
    glb = (struct.pack("<4sII", b"glTF", 2, 28 + len(payload) + len(binary))
           + struct.pack("<I4s", len(payload), b"JSON") + payload
           + struct.pack("<I4s", len(binary), b"BIN\0") + binary)
    manifest = {"primitives": metadata, "bodies": [{"id": i} for i in range(body_count)]}
    metrics = {"surface_area": body_count * (1.5 + math.sqrt(3) / 2), "volume": body_count / 6}
    return glb, manifest, metrics


class GlbMeshAuditTests(unittest.TestCase):
    def test_closed_tetrahedron_conserves_area_and_volume(self):
        report = audit_glb_mesh(*fixture())
        self.assertEqual(report["triangle_count"], 4)
        self.assertLess(report["volume_relative_error"], 1e-6)

    def test_coincident_independent_bodies_are_not_welded_together(self):
        report = audit_glb_mesh(*fixture(body_count=2))
        self.assertEqual(report["body_count"], 2)

    def test_corrupt_meshes_fail(self):
        for corruption, message in [("normal", "normal"), ("degenerate", "Degenerate"),
                                    ("winding", "winding"), ("missing", "missing"),
                                    ("nonmanifold", "non-manifold"),
                                    ("inward", "signed volume")]:
            with self.subTest(corruption=corruption):
                with self.assertRaisesRegex(ValueError, message):
                    audit_glb_mesh(*fixture(corruption=corruption))

    def test_open_mesh_fails_even_if_manifest_omits_the_same_face(self):
        glb, manifest, metrics = fixture(corruption="missing")
        manifest["primitives"].pop(0)
        with self.assertRaisesRegex(ValueError, "open"):
            audit_glb_mesh(glb, manifest, metrics)

    def test_metric_mismatch_fails(self):
        glb, manifest, metrics = fixture()
        metrics["volume"] *= 2
        with self.assertRaisesRegex(ValueError, "mismatch"):
            audit_glb_mesh(glb, manifest, metrics)


if __name__ == "__main__":
    unittest.main()

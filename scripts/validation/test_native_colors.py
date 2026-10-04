"""Independent-reader regression tests for actual native X_T RGB records."""

import json
import struct
import unittest
from dataclasses import replace
from pathlib import Path

from parasolid_kit import read_brep
from parasolid_kit.interop.occt import to_occt
from parasolid_kit.interop.preview import PreviewOptions, tessellate_preview
from native_colors import apply_native_colors, read_native_colors


FIXTURE = Path(__file__).resolve().parents[2] / "tests/fixtures/parasolid/native-rgb-box.x_t"


def change_field(parsed, node_index, field_index, value_index, value):
    node = next(node for node in parsed.document.nodes if node.index == node_index)
    fields = list(node.fields)
    values = list(fields[field_index].values)
    values[value_index] = replace(values[value_index], value=value)
    fields[field_index] = replace(fields[field_index], values=tuple(values))
    changed = replace(node, fields=tuple(fields))
    document = replace(parsed.document, nodes=tuple(
        changed if current.index == node_index else current for current in parsed.document.nodes
    ))
    return replace(parsed, document=document)


class NativeColorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parsed = read_brep(FIXTURE)

    def first_attribute(self):
        return next(node for node in self.parsed.document.nodes if node.node_type == 81)

    def test_native_face_override_controls_glb_material(self):
        bodies, faces = read_native_colors(self.parsed)
        self.assertEqual(bodies, {0: [0.8, 0.2, 0.1]})
        self.assertEqual(faces[0], [0, 1, 0])
        converted = to_occt(self.parsed.brep, source_unit="m", target_unit="mm")
        preview = tessellate_preview(converted, self.parsed.brep, options=PreviewOptions(include_edges=False))
        colored, report = apply_native_colors(preview.glb, preview.manifest, self.parsed)
        self.assertEqual(report["palette"], [[0, 1, 0], [0.8, 0.2, 0.1]])
        self.assertEqual(report["colored_primitive_count"], 6)
        self.assertEqual(report["uncolored_primitive_count"], 0)
        length = struct.unpack_from("<I", colored, 12)[0]
        document = json.loads(colored[20:20 + length])
        target = next(item["target_key"] for item in preview.manifest["primitives"]
                      if item["parasolid_face_ids"] == [0])
        face = next(primitive for mesh in document["meshes"] for primitive in mesh["primitives"]
                    if primitive["extras"]["targetKey"] == target)
        material = document["materials"][face["material"]]
        self.assertEqual(material["pbrMetallicRoughness"]["baseColorFactor"], [0, 1, 0, 1])
        # Appearance changes only JSON; native OCCT vertex/index buffers are intact.
        original_length = struct.unpack_from("<I", preview.glb, 12)[0]
        self.assertEqual(colored[20 + length:], preview.glb[20 + original_length:])

    def test_missing_color_value_reference_is_rejected(self):
        changed = change_field(self.parsed, self.first_attribute().index, 7, 0, 999999)
        with self.assertRaisesRegex(ValueError, "requires record 83"):
            read_native_colors(changed)

    def test_wrong_color_owner_is_rejected(self):
        changed = change_field(self.parsed, self.first_attribute().index, 2, 0, 999999)
        with self.assertRaisesRegex(ValueError, "wrong owner"):
            read_native_colors(changed)

    def test_invalid_rgb_component_is_rejected(self):
        values = next(node for node in self.parsed.document.nodes if node.node_type == 83)
        changed = change_field(self.parsed, values.index, 0, 0, 1.1)
        with self.assertRaisesRegex(ValueError, "unit-interval"):
            read_native_colors(changed)


if __name__ == "__main__":
    unittest.main()

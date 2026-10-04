import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid } from "../../lib"

test("typed matrices and legacy vertex position wrappers preserve geometry", () => {
  const geom = jscad.transforms.translate([2, 3, 4], jscad.primitives.cube())
  const expected = jscadToParasolid(geom)
  for (const key of ["pos", "position"] as const) {
    const converted = {
      transforms: new Float64Array(geom.transforms),
      polygons: geom.polygons.map((polygon) => ({
        vertices: polygon.vertices.map((vertex) =>
          key === "pos"
            ? { pos: new Float64Array(vertex) }
            : { position: new Float64Array(vertex) },
        ),
      })),
    }
    expect(jscadToParasolid(converted)).toBe(expected)
  }
})

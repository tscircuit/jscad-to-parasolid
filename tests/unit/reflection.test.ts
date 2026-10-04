import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("a mirrored solid retains outward face winding and positive volume", () => {
  const geom = jscad.transforms.scale(
    [2, 3, 4],
    jscad.transforms.mirrorX(jscad.primitives.cube({ size: 1 })),
  )
  const [body] = jscadToParasolidBodies(geom)
  const reconstructed = jscad.geometries.geom3.create(
    body!.polygons.map((vertices) => ({
      vertices: vertices.map(([x, y, z]) => [x, y, z]),
    })),
  )
  expect(jscad.measurements.measureVolume(reconstructed)).toBeCloseTo(24, 10)
  expect(jscadToParasolid(geom)).toStartWith("T51 : TRANSMIT FILE")
})

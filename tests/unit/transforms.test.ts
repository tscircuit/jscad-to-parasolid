import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("lazy rotation and translation are applied without mutating the caller", () => {
  const geom = jscad.transforms.translate(
    [10, 20, 30],
    jscad.transforms.rotateZ(
      Math.PI / 2,
      jscad.primitives.cuboid({ size: [2, 4, 6] }),
    ),
  )
  const before = structuredClone(geom)
  const bodies = jscadToParasolidBodies(geom)
  const points = bodies[0]!.polygons.flat()
  for (const [axis, range] of [
    [0, [8, 12]],
    [1, [19, 21]],
    [2, [27, 33]],
  ] as const) {
    expect(Math.min(...points.map((point) => point[axis]))).toBeCloseTo(
      range[0],
      10,
    )
    expect(Math.max(...points.map((point) => point[axis]))).toBeCloseTo(
      range[1],
      10,
    )
  }
  const first = jscadToParasolid(geom)
  expect(jscadToParasolid(geom)).toBe(first)
  expect(geom).toEqual(before)
})

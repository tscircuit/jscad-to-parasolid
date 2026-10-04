import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolidBodies } from "../../lib"

test("face colors stay attached through disconnected shell splitting and reversed winding", () => {
  const first = jscad.primitives.cube({ size: 2 })
  const second = jscad.primitives.cube({ size: 2, center: [4, 0, 0] })
  const polygons = [
    ...first.polygons.map((polygon) => ({ ...polygon, color: "red" })),
    ...second.polygons.map((polygon) => ({ ...polygon, color: "blue" })),
  ]
  const bodies = jscadToParasolidBodies({ polygons })
  expect(bodies).toHaveLength(2)
  expect(bodies[0]?.faceColors).toEqual(Array(6).fill([1, 0, 0]))
  expect(bodies[1]?.faceColors).toEqual(Array(6).fill([0, 0, 1]))
  const reversed = {
    polygons: first.polygons.map((polygon, index) => ({
      vertices: [...polygon.vertices].reverse(),
      ...(index === 0 ? { color: "green" } : {}),
    })),
  }
  expect(jscadToParasolidBodies(reversed)[0]?.faceColors?.[0]).toEqual([
    0,
    128 / 255,
    0,
  ])
})

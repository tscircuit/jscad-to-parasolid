import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid } from "../../lib"

test("a globally reversed single shell is oriented outward without filling cavities", () => {
  const cube = jscad.primitives.cube({ size: 2 })
  const reversed = {
    polygons: cube.polygons.map(({ vertices }) => ({
      vertices: [...vertices].reverse(),
    })),
  }
  const before = structuredClone(reversed)
  expect(jscadToParasolid(reversed)).toBe(jscadToParasolid(cube))
  expect(reversed).toEqual(before)
  expect(() =>
    jscadToParasolid({
      polygons: [
        ...jscad.primitives.cube({ size: 4 }).polygons,
        ...reversed.polygons,
      ],
    }),
  ).toThrow("enclosed cavity shells")
})

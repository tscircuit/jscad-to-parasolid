import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid } from "../../lib"

test("empty models and boolean results cannot export a misleading empty file", () => {
  for (const empty of [[], { geometries: [] }, { polygons: [] }]) {
    expect(() => jscadToParasolid(empty)).toThrow("empty model")
  }
  const cube = jscad.primitives.cube()
  expect(() => jscadToParasolid(jscad.booleans.subtract(cube, cube))).toThrow(
    "empty model",
  )
})

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadPlanner, type JscadOperation } from "jscad-planner"
import { jscadToParasolid } from "../../lib"

test("planned transforms around pre-rendered Custom geometry preserve lazy transforms", () => {
  const custom = jscad.transforms.translate([1, 2, 3], jscad.primitives.cube())
  // Vanilla Custom components can return geom3 even when the surrounding
  // renderer records transforms with jscad-planner.
  const operation = jscadPlanner.transforms.translate(
    [4, 5, 6],
    custom as unknown as JscadOperation,
  )
  const before = structuredClone(operation)
  expect(jscadToParasolid(operation)).toBe(
    jscadToParasolid(jscad.transforms.translate([4, 5, 6], custom)),
  )
  expect(operation).toEqual(before)
})

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadPlanner } from "jscad-planner"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("planner operations export the same solid as evaluated JSCAD geometry", () => {
  const operation = jscadPlanner.transforms.translate(
    [2, 3, 4],
    jscadPlanner.primitives.cuboid({ size: [2, 4, 6] }),
  )
  const geom = jscad.transforms.translate(
    [2, 3, 4],
    jscad.primitives.cuboid({ size: [2, 4, 6] }),
  )
  expect(jscadToParasolid(operation)).toBe(jscadToParasolid(geom))
  expect(jscadToParasolidBodies(operation)).toHaveLength(1)
})

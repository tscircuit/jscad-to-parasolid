import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadPlanner } from "jscad-planner"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, type RenderedModel } from "../../lib"

test("operation arrays and mixed rendered entries preserve separate bodies", () => {
  const first = jscadPlanner.primitives.cube({ size: 2 })
  const second = jscadPlanner.transforms.translate([4, 0, 0], first)
  const third = jscad.transforms.translate(
    [8, 0, 0],
    jscad.primitives.cube({ size: 2 }),
  )
  const model: RenderedModel = {
    geometries: [{ geom: first }, { geom: second }, { geom: third }],
  }
  const source = jscadToParasolid([first, second, third])
  expect(source).toBe(jscadToParasolid(model))
  const repository = parseRepository(source)
  expect(repository.fullyParsed).toBe(true)
  expect(repository.bodies).toHaveLength(3)
})

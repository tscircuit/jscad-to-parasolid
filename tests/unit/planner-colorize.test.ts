import { expect, test } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { getEntityColor, parseRepository } from "parasolidts"
import { jscadToParasolid } from "../../lib"

test("planner colorize writes native body RGB attributes", () => {
  const operation = jscadPlanner.colors.colorize(
    [0.2, 0.4, 0.6],
    jscadPlanner.primitives.cube({ size: 2 }),
  )
  const repository = parseRepository(jscadToParasolid(operation))
  expect(repository.fullyParsed).toBe(true)
  expect(getEntityColor(repository, repository.bodies[0]!)).toEqual([
    0.2, 0.4, 0.6,
  ])
})

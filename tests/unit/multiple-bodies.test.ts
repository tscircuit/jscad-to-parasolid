import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("arrays and disconnected boolean results retain separate solid bodies", () => {
  const first = jscad.primitives.cube({ size: 2 })
  const second = jscad.transforms.translate(
    [4, 0, 0],
    jscad.primitives.cube({ size: 2 }),
  )
  expect(jscadToParasolidBodies([first, second])).toHaveLength(2)
  const disconnected = jscad.booleans.union(first, second)
  const bodies = jscadToParasolidBodies(disconnected)
  expect(bodies).toHaveLength(2)
  expect(bodies.map((body) => body.polygons.length)).toEqual([6, 6])
  const repository = parseRepository(jscadToParasolid(disconnected))
  expect(repository.fullyParsed).toBe(true)
  expect(repository.bodies).toHaveLength(2)
})

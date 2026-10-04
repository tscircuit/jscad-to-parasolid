import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("solids that touch at only a vertex remain independent closed bodies", () => {
  const first = jscad.primitives.cube({ size: 2 })
  const second = jscad.primitives.cube({ size: 2, center: [2, 2, 2] })
  const joined = jscad.geometries.geom3.create([
    ...first.polygons,
    ...second.polygons,
  ])
  expect(jscadToParasolidBodies(joined)).toHaveLength(2)
  const repository = parseRepository(jscadToParasolid(joined))
  expect(repository.fullyParsed).toBe(true)
  expect(repository.bodies).toHaveLength(2)
})

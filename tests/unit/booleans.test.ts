import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { parseRepository } from "parasolidts"
import { jscadToParasolid } from "../../lib"

test("union, intersection, and subtraction repair boolean T-junctions", () => {
  const base = jscad.primitives.cuboid({ size: [4, 4, 2] })
  const shifted = jscad.transforms.translate(
    [1, 1, 0],
    jscad.primitives.cube({ size: 3 }),
  )
  const cutter = jscad.primitives.cylinder({
    radius: 0.7,
    height: 4,
    segments: 16,
  })
  for (const geom of [
    jscad.booleans.union(base, shifted),
    jscad.booleans.intersect(base, shifted),
    jscad.booleans.subtract(base, cutter),
  ]) {
    const repository = parseRepository(jscadToParasolid(geom))
    expect(repository.fullyParsed).toBe(true)
    expect(repository.bodies).toHaveLength(1)
  }
})

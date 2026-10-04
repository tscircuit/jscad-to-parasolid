import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("a modelprinter SOIC8 model retains its case and pins without mutation", () => {
  const model = getJscadModelForFootprint("soic8", jscad)
  const before = structuredClone(model)
  const bodies = jscadToParasolidBodies(model)
  expect(bodies.length).toBeGreaterThanOrEqual(9)
  const repository = parseRepository(jscadToParasolid(model))
  expect(repository.fullyParsed).toBe(true)
  expect(repository.bodies).toHaveLength(bodies.length)
  expect(model).toEqual(before)
})

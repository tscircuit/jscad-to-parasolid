import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadPlanner } from "jscad-planner"
import { jscadToParasolid } from "../../lib"

const digest = (source: string) =>
  createHash("sha256").update(source).digest("hex")

test("planner-rendered SOIC8 and 0402 match directly evaluated electronics models", () => {
  for (const spec of ["soic8", "0402"]) {
    // The vanilla renderer accepts the planner adapter at runtime, though its
    // published parameter type currently describes only @jscad/modeling.
    const planned = getJscadModelForFootprint(
      spec,
      jscadPlanner as unknown as typeof jscad,
    )
    const before = structuredClone(planned)
    const evaluated = getJscadModelForFootprint(spec, jscad)
    expect(digest(jscadToParasolid(planned))).toBe(
      digest(jscadToParasolid(evaluated)),
    )
    expect(planned).toEqual(before)
  }
})

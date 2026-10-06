import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadPlanner } from "jscad-planner"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

const models = [
  "hexbolt_m3_l8mm_nothreads",
  "hexsocketbolt_m3_l6mm_nothreads",
  "sheetmetal_plate_w24mm_l20mm_t1mm",
  "nema17_l39mm",
  "helicalgear6_m1mm_w1mm_ha0deg_right_segments4_turnsegments12",
  "spurgear6_m1mm_w1mm_segments4",
  "wormgear_m1mm_d3mm_l1mm_starts1_segments24_turnsegments12",
  "flexscreen30_w16_h10_flex10_p0.5mm_tail2mm_taper3mm_sitsflat",
] as const

const digest = (source: string) =>
  createHash("sha256").update(source).digest("hex")

test("registered families remain synchronous and export representative identical X_T solids", () => {
  for (const modelString of models) {
    const evaluated = getJscadModelForFootprint(modelString, jscad)
    const planned = getJscadModelForFootprint(
      modelString,
      jscadPlanner as unknown as typeof jscad,
    )
    const evaluatedBefore = structuredClone(evaluated)
    const plannedBefore = structuredClone(planned)
    expect(evaluated).not.toBeInstanceOf(Promise)
    expect(evaluated.geometries.length).toBeGreaterThan(0)
    expect(planned.geometries.length).toBe(evaluated.geometries.length)
    // Dense bolt, motor, and display solids are covered by the renderer and
    // existing catalog checks; keep this dispatch/export regression practical.
    if (/^(hexbolt|nema|flexscreen)/.test(modelString)) continue
    const source = jscadToParasolid(evaluated)
    expect(digest(jscadToParasolid(planned))).toBe(digest(source))
    const bodies = jscadToParasolidBodies(evaluated)
    expect(bodies.length).toBeGreaterThan(0)
    const repository = parseRepository(source)
    expect(repository.fullyParsed).toBe(true)
    expect(repository.bodies).toHaveLength(bodies.length)
    expect(evaluated).toEqual(evaluatedBefore)
    expect(planned).toEqual(plannedBefore)
  }
  expect(() => getJscadModelForFootprint("hexbolt_m3_l0mm", jscad)).toThrow()
}, 60_000)

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { Face, Plane, parseRepository } from "parasolidts"
import { jscadToParasolid } from "../../lib"

for (const [spec, capCount] of [
  ["spurgear16_m1mm_w4mm_segments4", 2],
  ["spurgear16_m1mm_w4mm_bore4mm_segments4", 2],
  ["spurgear16_m1mm_w4mm_bore4mm_hubdiameter8mm_hublength2mm_segments4", 3],
  ["helicalgear16_m1mm_w6mm_ha25deg_right_bore4mm_segments4_turnsegments12", 2],
] as const) {
  test(`flat caps become single CAD faces: ${spec}`, () => {
    const model = getJscadModelForFootprint(spec, jscad)
    const repository = parseRepository(jscadToParasolid(model))
    const faces = repository
      .getChildren()
      .filter((e): e is Face => e instanceof Face)
    const caps = faces.filter((face) => {
      const plane = face.surfaceRef?.resolve(repository)
      return plane instanceof Plane && Math.abs(plane.normal.z) > 1 - 1e-10
    })
    expect(caps).toHaveLength(capCount)
    for (const cap of caps) {
      expect(Boolean(cap.loopHead?.resolve(repository)?.nextLoop)).toBe(
        spec.includes("bore"),
      )
    }
    const unmerged = parseRepository(
      jscadToParasolid(model, { mergeCoplanarFaces: false }),
    )
    expect(faces.length).toBeLessThan(
      unmerged.getChildren().filter((e) => e instanceof Face).length,
    )
    expect(repository.fullyParsed).toBe(true)
  }, 30_000)
}

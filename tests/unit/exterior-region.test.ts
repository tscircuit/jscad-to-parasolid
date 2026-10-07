import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { Face, Region, parseRepository } from "parasolidts"
import { jscadToParasolid } from "../../lib"

test("native body region chains start with the infinite exterior void", () => {
  for (const spec of [
    "spurgear16_m1mm_w4mm_segments4",
    "spurgear16_m1mm_w4mm_bore4mm_segments4",
    "helicalgear16_m1mm_w4mm_ha25deg_right_bore4mm_segments4_turnsegments12",
    "soic8",
  ]) {
    const model = getJscadModelForFootprint(spec, jscad)
    for (const mergeCoplanarFaces of [false, true]) {
      const repo = parseRepository(
        jscadToParasolid(model, { mergeCoplanarFaces }),
      )
      for (const body of repo.bodies) {
        const exterior = body.regionHead!.resolve(repo)
        expect(exterior).toBeInstanceOf(Region)
        expect(exterior.regionKind).toBe("V")
        expect(exterior.previousRegion).toBeNull()
        expect(exterior.bodyRef!.id).toBe(body.id)
        const solid = exterior.nextRegion!.resolve(repo)
        expect(solid.regionKind).toBe("S")
        expect(solid.previousRegion!.id).toBe(exterior.id)
        expect(solid.nextRegion).toBeNull()
        expect(solid.bodyRef!.id).toBe(body.id)
        const front = exterior.shellHead!.resolve(repo)
        const back = solid.shellHead!.resolve(repo)
        expect(front.regionRef!.id).toBe(exterior.id)
        expect(back.regionRef!.id).toBe(solid.id)
        expect(body.legacyShell!.id).toBe(back.id)
        expect(front.legacyBody).toBeNull()
        expect(back.legacyBody!.id).toBe(body.id)
        let face: Face | null = front.frontFaces!.resolve(repo)
        while (face) {
          expect(face.frontShell!.id).toBe(front.id)
          expect(face.backShell!.id).toBe(back.id)
          face = face.nextFront?.resolve(repo) ?? null
        }
        expect(body.geometryState).toBe(1)
      }
    }
  }
}, 90_000)

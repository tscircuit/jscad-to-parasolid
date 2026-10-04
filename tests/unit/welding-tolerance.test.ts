import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { parseRepository } from "parasolidts"
import { jscadToParasolid, jscadToParasolidBodies } from "../../lib"

test("shell splitting uses the writer's physical welding tolerance in either unit", () => {
  const cube = jscad.primitives.cube({ size: 2 })
  for (const units of ["mm", "m"] as const) {
    const scale = units === "mm" ? 1 : 0.001
    const noisy = {
      polygons: cube.polygons.map((polygon, face) => ({
        vertices: polygon.vertices.map(([x, y, z]) => [
          (x + face * 3e-8) * scale,
          y * scale,
          z * scale,
        ]),
      })),
    }
    expect(jscadToParasolidBodies(noisy, { units })).toHaveLength(1)
    const repository = parseRepository(jscadToParasolid(noisy, { units }))
    expect(repository.fullyParsed).toBe(true)
    expect(repository.bodies).toHaveLength(1)
  }
})

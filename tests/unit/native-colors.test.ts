import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { Face, getEntityColor, parseRepository } from "parasolidts"
import { jscadToParasolid } from "../../lib"

test("native body and face color attributes survive canonical X_T round trips", () => {
  const geom = jscad.primitives.cube()
  const source = jscadToParasolid({
    geometries: [
      {
        color: "red",
        geom: {
          ...geom,
          color: "blue",
          polygons: geom.polygons.map((polygon, index) => ({
            ...polygon,
            ...(index === 0 ? { color: [0, 1, 0, 0.5] } : {}),
          })),
        },
      },
    ],
  })
  const repository = parseRepository(source)
  for (const document of [
    repository,
    parseRepository(repository.getString({ canonical: true })),
  ]) {
    expect(document.fullyParsed).toBe(true)
    expect(getEntityColor(document, document.bodies[0]!)).toEqual([0, 0, 1])
    const faces = document
      .getChildren()
      .filter((entity): entity is Face => entity instanceof Face)
    expect(faces).toHaveLength(6)
    expect(getEntityColor(document, faces[0]!)).toEqual([0, 1, 0])
    for (const face of faces.slice(1)) {
      expect(getEntityColor(document, face)).toEqual([0, 0, 1])
    }
  }
})

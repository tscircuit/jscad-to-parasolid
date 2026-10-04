import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolidBodies } from "../../lib"

test("polygon colors override geom color, which overrides the rendered entry", () => {
  const geom = jscad.primitives.cube()
  const model = {
    geometries: [
      {
        color: "red",
        geom: {
          ...geom,
          color: [0, 0, 1],
          polygons: geom.polygons.map((polygon, index) => ({
            ...polygon,
            ...(index === 0 ? { color: "#0f0" } : {}),
          })),
        },
      },
    ],
  }
  const before = structuredClone(model)
  const [body] = jscadToParasolidBodies(model)
  expect(body?.color).toEqual([0, 0, 1])
  expect(body?.faceColors).toEqual([
    [0, 1, 0],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  expect(model).toEqual(before)
})

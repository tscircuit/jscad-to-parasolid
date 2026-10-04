import { expect, test } from "bun:test"
import { jscadToParasolid } from "../../lib"

test("open surfaces and two-dimensional operations cannot export as solids", () => {
  expect(() =>
    jscadToParasolid({
      polygons: [
        {
          vertices: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
      ],
    }),
  ).toThrow()
  expect(() =>
    jscadToParasolid({
      type: "polygon",
      points: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
    }),
  ).toThrow("must be a JSCAD geom3 solid")
})

import { expect, test } from "bun:test"
import { jscadToParasolid, type Geom3Like } from "../../lib"

test("malformed or non-finite vertices fail instead of silently becoming zero", () => {
  for (const vertex of [
    [NaN, 0, 0],
    [Infinity, 0, 0],
    [0, 0],
    ["1", 0, 0],
    null,
  ]) {
    const geom = { polygons: [{ vertices: [vertex, [1, 0, 0], [0, 1, 0]] }] }
    expect(() => jscadToParasolid(geom as unknown as Geom3Like)).toThrow(
      "must contain three finite coordinates",
    )
  }
})

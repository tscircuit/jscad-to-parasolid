import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadToParasolid } from "../../lib"

test("DIP8 overlapping pin surfaces fail instead of exporting invalid solids", () => {
  // jscad-electronics 0.0.186 includes overlapping internal faces in the
  // horizontal pin sections. Several edges have four incident polygons.
  const model = getJscadModelForFootprint("dip8", jscad)
  expect(() => jscadToParasolid(model)).toThrow(
    "Mesh is open or non-manifold: an edge has 4 incident faces",
  )
})

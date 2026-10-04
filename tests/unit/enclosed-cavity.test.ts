import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid } from "../../lib"

test("an enclosed cavity fails explicitly instead of becoming a filled body", () => {
  const hollow = jscad.booleans.subtract(
    jscad.primitives.cube({ size: 4 }),
    jscad.primitives.cube({ size: 2 }),
  )
  expect(() => jscadToParasolid(hollow)).toThrow("enclosed cavity shells")
})

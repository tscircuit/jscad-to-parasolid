import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid, type JscadToParasolidOptions } from "../../lib"

test("millimetre and metre input produce identical physical coordinates", () => {
  const millimetres = jscad.primitives.cube({ size: 2 })
  const metres = jscad.primitives.cube({ size: 0.002 })
  expect(jscadToParasolid(millimetres)).toBe(
    jscadToParasolid(metres, { units: "m" }),
  )
  expect(() =>
    jscadToParasolid(millimetres, {
      units: "inches",
    } as unknown as JscadToParasolidOptions),
  ).toThrow('Input units must be "mm" or "m"')
})

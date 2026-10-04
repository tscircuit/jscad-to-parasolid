import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolidBodies } from "../../lib"

test("invalid colors fail instead of being silently dropped or changed", () => {
  for (const color of [
    "not-a-color",
    "#zzzzzz",
    [1, 0],
    [NaN, 0, 0],
    [-1, 0, 0],
    [256, 0, 0],
  ]) {
    expect(() =>
      jscadToParasolidBodies({
        ...jscad.primitives.cube(),
        color,
      }),
    ).toThrow(/color/i)
  }
})

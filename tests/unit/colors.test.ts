import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import {
  jscadToParasolidBodies,
  type ParasolidColorInput,
  type ParasolidRgbColor,
} from "../../lib"

test("body RGB survives normalized, byte, named, and hexadecimal colors", () => {
  const cases: [ParasolidColorInput, ParasolidRgbColor][] = [
    [
      [0.2, 0.4, 0.6],
      [0.2, 0.4, 0.6],
    ],
    [
      [0.2, 0.4, 0.6, 0.3],
      [0.2, 0.4, 0.6],
    ],
    [
      [51, 102, 153],
      [0.2, 0.4, 0.6],
    ],
    ["#369", [0.2, 0.4, 0.6]],
    ["#3698", [0.2, 0.4, 0.6]],
    ["#336699", [0.2, 0.4, 0.6]],
    ["#33669980", [0.2, 0.4, 0.6]],
    ["red", [1, 0, 0]],
  ]
  for (const [color, expected] of cases) {
    const [body] = jscadToParasolidBodies({
      geometries: [{ geom: jscad.primitives.cube(), color }],
    })
    expect(body?.color).toEqual(expected)
  }
})

import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { jscadToParasolid } from "../../lib"

test("invalid, perspective, and collapsed transforms are rejected", () => {
  const geom = jscad.primitives.cube()
  expect(() => jscadToParasolid({ ...geom, transforms: [1, 2, 3] })).toThrow(
    "16 finite",
  )
  const nonFinite = [...geom.transforms]
  nonFinite[0] = Infinity
  expect(() => jscadToParasolid({ ...geom, transforms: nonFinite })).toThrow(
    "16 finite",
  )
  const perspective = [...geom.transforms]
  perspective[3] = 1
  expect(() => jscadToParasolid({ ...geom, transforms: perspective })).toThrow(
    "affine",
  )
  const collapsed = [...geom.transforms]
  collapsed[0] = 0
  expect(() => jscadToParasolid({ ...geom, transforms: collapsed })).toThrow(
    "invertible",
  )
})

import {
  createParasolidFromBodies,
  createParasolidFromPolygons,
} from "../helpers/build-parasolid"
import { expect, test } from "bun:test"
import { Body, Face, Point, parseRepository } from "parasolidts"

const cube = [
  [
    [0, 0, 0],
    [0, 3, 0],
    [4, 3, 0],
    [4, 0, 0],
  ],
  [
    [0, 0, 2],
    [4, 0, 2],
    [4, 3, 2],
    [0, 3, 2],
  ],
  [
    [0, 0, 0],
    [4, 0, 0],
    [4, 0, 2],
    [0, 0, 2],
  ],
  [
    [0, 3, 0],
    [0, 3, 2],
    [4, 3, 2],
    [4, 3, 0],
  ],
  [
    [0, 0, 0],
    [0, 0, 2],
    [0, 3, 2],
    [0, 3, 0],
  ],
  [
    [4, 0, 0],
    [4, 3, 0],
    [4, 3, 2],
    [4, 0, 2],
  ],
] as const

test("converter constructs editable typed V30 topology and metre coordinates", () => {
  const source = createParasolidFromPolygons(cube)
  const repository = parseRepository(source)
  expect(repository.fullyParsed).toBe(true)
  expect(repository.bodies).toHaveLength(1)
  expect(
    repository.getChildren().filter((item) => item instanceof Face),
  ).toHaveLength(6)
  const points = repository
    .getChildren()
    .filter((item): item is Point => item instanceof Point)
  expect(Math.max(...points.map((point) => point.position.x))).toBeCloseTo(
    0.004,
    12,
  )
  expect(repository.getString()).toBe(source)
  const canonical = repository.getString({ canonical: true })
  expect(parseRepository(canonical).fullyParsed).toBe(true)
})

test("multiple bodies share an ID namespace and retain distinct solid topology", () => {
  const source = createParasolidFromBodies([
    { polygons: cube },
    { polygons: cube },
  ])
  const repository = parseRepository(source)
  expect(repository.bodies).toHaveLength(2)
  const body = repository.bodies[0]
  expect(body?.nextBody?.resolve(repository)).toBeInstanceOf(Body)
  expect(new Set([...repository.entries()].map(([id]) => id)).size).toBe(
    repository.getChildren().length,
  )
})

test("converter rejects incomplete boundaries and invalid coordinates", () => {
  expect(() => createParasolidFromPolygons(cube.slice(1))).toThrow()
  expect(() => createParasolidFromPolygons([...cube, cube[0]])).toThrow()
  expect(() =>
    createParasolidFromPolygons([
      [
        [0, 0, Number.NaN],
        [1, 0, 0],
        [0, 1, 0],
      ],
    ]),
  ).toThrow()
  expect(() => createParasolidFromPolygons([])).toThrow()
})

test("T-junction splitting preserves the face count and creates shared vertices", () => {
  const polygons = cube.map((face) =>
    face.map((point) => [...point] as [number, number, number]),
  )
  polygons[0]?.splice(1, 0, [0, 1.5, 0])
  const repository = parseRepository(createParasolidFromPolygons(polygons))
  expect(
    repository.getChildren().filter((item) => item instanceof Point),
  ).toHaveLength(9)
  expect(
    repository.getChildren().filter((item) => item instanceof Face),
  ).toHaveLength(6)
})

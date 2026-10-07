import {
  createParasolidFromBodies,
  createParasolidFromPolygons,
} from "../helpers/build-parasolid"
import { expect, test } from "bun:test"
import {
  Attribute,
  AttributeDefinition,
  AttributeIdentifier,
  Face,
  RealArray,
  getEntityColor,
  parseRepository,
} from "parasolidts"

const tetrahedron = [
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
] as const

test("native body RGB and face overrides survive parsing and canonical serialization", () => {
  const source = createParasolidFromPolygons(tetrahedron, {
    color: [0.1, 0.2, 0.8],
    faceColors: [[1, 0, 0], undefined, undefined, undefined],
  })
  const repository = parseRepository(source)
  expect(repository.fullyParsed).toBe(true)
  expect(getEntityColor(repository, repository.bodies[0]!)).toEqual([
    0.1, 0.2, 0.8,
  ])
  const faces = repository
    .getChildren()
    .filter((entity): entity is Face => entity instanceof Face)
  expect(faces.map((face) => getEntityColor(repository, face))).toEqual([
    [1, 0, 0],
    [0.1, 0.2, 0.8],
    [0.1, 0.2, 0.8],
    [0.1, 0.2, 0.8],
  ])
  expect(repository.getString()).toBe(source)
  const canonical = parseRepository(repository.getString({ canonical: true }))
  expect(canonical.fullyParsed).toBe(true)
  expect(getEntityColor(canonical, canonical.bodies[0]!)).toEqual([
    0.1, 0.2, 0.8,
  ])
})

test("editing a native color value updates the serialized RGB", () => {
  const repository = parseRepository(
    createParasolidFromPolygons(tetrahedron, { color: [0.25, 0.5, 0.75] }),
  )
  const face = repository
    .getChildren()
    .find((entity): entity is Face => entity instanceof Face)!
  const attribute = face.annotations?.resolve(repository)
  expect(attribute).toBeInstanceOf(Attribute)
  const values = (attribute as Attribute).valueArrays[0]?.resolve(repository)
  expect(values).toBeInstanceOf(RealArray)
  ;(values as RealArray).values = [0, 0, 0]
  const parsed = parseRepository(repository.getString())
  expect(getEntityColor(parsed, parsed.get<Face>(face.id)!)).toEqual([0, 0, 0])
})

test("standard color definitions are shared across bodies and use documented identifiers", () => {
  const repository = parseRepository(
    createParasolidFromBodies([
      { polygons: tetrahedron, color: [1, 0, 0] },
      { polygons: tetrahedron, color: [0, 0, 1] },
    ]),
  )
  const definitions = repository
    .getChildren()
    .filter(
      (entity): entity is AttributeDefinition =>
        entity instanceof AttributeDefinition,
    )
  expect(definitions).toHaveLength(2)
  expect(definitions.map((definition) => definition.kindId).sort()).toEqual([
    8001, 8040,
  ])
  const identifiers = repository
    .getChildren()
    .filter(
      (entity): entity is AttributeIdentifier =>
        entity instanceof AttributeIdentifier,
    )
  expect(identifiers.map((identifier) => identifier.value).sort()).toEqual([
    "SDL/TYSA_COLOUR",
    "SDL/TYSA_COLOUR_2",
  ])
  expect(
    repository.bodies.map((body) => getEntityColor(repository, body)),
  ).toEqual([
    [1, 0, 0],
    [0, 0, 1],
  ])
})

test("face-only colors do not invent body defaults or color unspecified faces", () => {
  const repository = parseRepository(
    createParasolidFromPolygons(tetrahedron, {
      faceColors: [undefined, [0, 1, 0], undefined, undefined],
    }),
  )
  expect(getEntityColor(repository, repository.bodies[0]!)).toBeUndefined()
  const faces = repository
    .getChildren()
    .filter((entity): entity is Face => entity instanceof Face)
  expect(faces.map((face) => getEntityColor(repository, face))).toEqual([
    undefined,
    [0, 1, 0],
    undefined,
    undefined,
  ])
})

test("invalid native RGB and mismatched face-color arrays fail clearly", () => {
  expect(() =>
    createParasolidFromPolygons(tetrahedron, { color: [1.1, 0, 0] }),
  ).toThrow()
  expect(() =>
    createParasolidFromPolygons(tetrahedron, { color: [0, Number.NaN, 0] }),
  ).toThrow()
  expect(() =>
    createParasolidFromPolygons(tetrahedron, { faceColors: [[1, 0, 0]] }),
  ).toThrow()
})

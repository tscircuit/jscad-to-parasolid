import {
  createParasolidFromBodies,
  createParasolidFromPolygons,
} from "../helpers/build-parasolid"
import { expect, test } from "bun:test"
import { Face, Loop, parseRepository, getEntityColor } from "parasolidts"
import type {
  ParasolidPoint,
  ParasolidBodyInput,
  ParasolidPlanarFace,
} from "../../lib/parasolid/types"

const outer: ParasolidPoint[] = [
  [0, 0, 0],
  [4, 0, 0],
  [4, 4, 0],
  [0, 4, 0],
]
const top: ParasolidPoint[] = outer.map(([x, y]) => [x, y, 2])
const inner: ParasolidPoint[] = [
  [1, 1, 0],
  [3, 1, 0],
  [3, 3, 0],
  [1, 3, 0],
]
const innerTop: ParasolidPoint[] = inner.map(([x, y]) => [x, y, 2])
const sides = outer.map((a, i) => [
  a,
  outer[(i + 1) % 4]!,
  top[(i + 1) % 4]!,
  top[i]!,
])
const innerSides = inner.map((a, i) => [
  a,
  innerTop[i]!,
  innerTop[(i + 1) % 4]!,
  inner[(i + 1) % 4]!,
])
const faces: ParasolidPlanarFace[] = [
  { loops: [[...outer].reverse(), inner] },
  { loops: [top, innerTop] },
  ...[...sides, ...innerSides].map((loop) => ({ loops: [loop] })),
]

test("serializes supplied planar faces with holes without changing face boundaries", () => {
  const before = structuredClone(faces)
  const source = createParasolidFromBodies([{ faces }])
  const repo = parseRepository(source)
  expect(repo.fullyParsed).toBe(true)
  const writtenFaces = repo
    .getChildren()
    .filter((e): e is Face => e instanceof Face)
  expect(writtenFaces).toHaveLength(10)
  expect(repo.getChildren().filter((e) => e instanceof Loop)).toHaveLength(12)
  const annular = writtenFaces.filter(
    (face) => face.loopHead?.resolve(repo)?.nextLoop,
  )
  expect(annular).toHaveLength(2)
  for (const face of annular) {
    const hole = face.loopHead!.resolve(repo)!.nextLoop!.resolve(repo)!
    expect(hole.faceRef!.id).toBe(face.id)
    expect(hole.nextLoop).toBeNull()
  }
  expect(faces).toEqual(before)
  expect(parseRepository(repo.getString({ canonical: true })).fullyParsed).toBe(
    true,
  )
})

test("unmerged polygon topology preserves coplanar subdivisions", () => {
  const polygons = [
    ...outer.map((a, i) => [
      [2, 2, 0] as ParasolidPoint,
      outer[(i + 1) % 4]!,
      a,
    ]),
    ...top.map((a, i) => [[2, 2, 2] as ParasolidPoint, a, top[(i + 1) % 4]!]),
    ...sides,
  ]
  const repo = parseRepository(createParasolidFromPolygons(polygons))
  expect(repo.getChildren().filter((e) => e instanceof Face)).toHaveLength(
    polygons.length,
  )
})

test("colors are indexed by explicit face, not by boundary loop", () => {
  const repo = parseRepository(
    createParasolidFromBodies([
      {
        faces,
        color: [1, 0, 0],
        faceColors: faces.map((_, i) => (i === 1 ? [0, 0, 1] : undefined)),
      },
    ]),
  )
  const writtenFaces = repo
    .getChildren()
    .filter((e): e is Face => e instanceof Face)
  expect(getEntityColor(repo, writtenFaces[0]!)).toEqual([1, 0, 0])
  expect(getEntityColor(repo, writtenFaces[1]!)).toEqual([0, 0, 1])
})

test("rejects mixed inputs, empty face loops, and holes outside the face plane", () => {
  expect(() =>
    createParasolidFromBodies([
      { faces, polygons: sides } as unknown as ParasolidBodyInput,
    ]),
  ).toThrow("either polygons or explicit faces")
  expect(() =>
    createParasolidFromBodies([{ faces: [{ loops: [] }, ...faces.slice(1)] }]),
  ).toThrow("outer boundary")
  const invalid = structuredClone(faces)
  invalid[0]!.loops = [outer, inner.map(([x, y]) => [x, y, 1])]
  expect(() => createParasolidFromBodies([{ faces: invalid }])).toThrow(
    "same plane",
  )
})

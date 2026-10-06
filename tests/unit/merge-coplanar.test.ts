import { expect, test } from "bun:test"
import { Face, Loop, Point, parseRepository, getEntityColor } from "parasolidts"
import type { ParasolidPoint, ParasolidColor } from "../../lib/build-parasolid"
import { jscadToParasolid } from "../../lib"
import { mergeCoplanarRegions } from "../../lib/merge-coplanar"
import type { JscadToParasolidOptions } from "../../lib"

function createParasolidFromPolygons(
  polygons: readonly (readonly ParasolidPoint[])[],
  options: JscadToParasolidOptions & {
    color?: ParasolidColor
    faceColors?: readonly (ParasolidColor | undefined)[]
  } = {},
) {
  return jscadToParasolid(
    {
      polygons: polygons.map((vertices, i) => ({
        vertices,
        color: options.faceColors?.[i],
      })),
      color: options.color,
    },
    options,
  )
}

test("near-touching trimming boundaries retain the original polygons", () => {
  const gap = 5e-10
  const points: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 2, 0],
    [0, 2, 0],
    [1 + gap, 0, 0],
    [1 + gap, 1, 0],
    [1 + gap, 2, 0],
    [2, 0, 0],
    [2, 2, 0],
  ]
  const cycles = [
    [0, 1, 2, 3, 4],
    [1, 5, 6, 2],
    [5, 8, 9, 7, 6],
  ]
  const regions = mergeCoplanarRegions(points, cycles, [
    undefined,
    undefined,
    undefined,
  ])
  expect(regions).toHaveLength(3)
  expect(regions.map((region) => region.loops[0])).toEqual(cycles)
})

const bottom: ParasolidPoint[] = [
  [0, 0, 0],
  [4, 0, 0],
  [4, 4, 0],
  [0, 4, 0],
]
const top: ParasolidPoint[] = bottom.map(([x, y]) => [x, y, 2])
const sides = bottom.map((a, i) => [
  a,
  bottom[(i + 1) % 4]!,
  top[(i + 1) % 4]!,
  top[i]!,
])
const polygons = [
  ...bottom.map((a, i) => [
    [2, 2, 0] as ParasolidPoint,
    bottom[(i + 1) % 4]!,
    a,
  ]),
  ...top.map((a, i) => [[2, 2, 2] as ParasolidPoint, a, top[(i + 1) % 4]!]),
  ...sides,
]
const faces = (source: string) =>
  parseRepository(source)
    .getChildren()
    .filter((e): e is Face => e instanceof Face)

test("merges cap fans and removes interior vertices, with an opt-out", () => {
  const source = createParasolidFromPolygons(polygons)
  const repo = parseRepository(source)
  expect(repo.fullyParsed).toBe(true)
  expect(faces(source)).toHaveLength(6)
  expect(repo.getChildren().filter((e) => e instanceof Point)).toHaveLength(8)
  expect(
    faces(createParasolidFromPolygons(polygons, { mergeCoplanarFaces: false })),
  ).toHaveLength(12)
  expect(parseRepository(repo.getString({ canonical: true })).fullyParsed).toBe(
    true,
  )
})

test("preserves effective face color boundaries", () => {
  const source = createParasolidFromPolygons(polygons, {
    color: [1, 0, 0],
    faceColors: polygons.map((_, i) => (i === 4 ? [0, 0, 1] : undefined)),
  })
  const repo = parseRepository(source)
  expect(faces(source)).toHaveLength(7)
  expect(
    faces(source).filter((face) => getEntityColor(repo, face)?.[2] === 1),
  ).toHaveLength(1)
})

test("merges annular caps into faces with outer and inner loops", () => {
  const inner: ParasolidPoint[] = [
    [1, 1, 0],
    [3, 1, 0],
    [3, 3, 0],
    [1, 3, 0],
  ]
  const innerTop: ParasolidPoint[] = inner.map(([x, y]) => [x, y, 2])
  const ring = bottom.flatMap((a, i) => {
    const j = (i + 1) % 4
    return [
      [a, bottom[j]!, inner[j]!],
      [a, inner[j]!, inner[i]!],
    ]
  })
  const caps = [
    ...ring.map((face) => [...face].reverse()),
    ...ring.map((face) => face.map(([x, y]) => [x, y, 2] as ParasolidPoint)),
  ]
  const innerSides = inner.map((a, i) => [
    a,
    innerTop[i]!,
    innerTop[(i + 1) % 4]!,
    inner[(i + 1) % 4]!,
  ])
  const source = createParasolidFromPolygons([...caps, ...sides, ...innerSides])
  const repo = parseRepository(source)
  expect(repo.fullyParsed).toBe(true)
  expect(faces(source)).toHaveLength(10)
  expect(repo.getChildren().filter((e) => e instanceof Loop)).toHaveLength(12)
  const annular = faces(source).filter(
    (face) => face.loopHead?.resolve(repo)?.nextLoop,
  )
  expect(annular).toHaveLength(2)
  for (const face of annular) {
    const first = face.loopHead!.resolve(repo)!
    expect(first.nextLoop!.resolve(repo)!.faceRef!.id).toBe(face.id)
  }
})

import {
  Repository,
  Entity,
  EntityReference,
  Vector3,
  Body,
  Region,
  Shell,
  Vertex,
  Point as NativePoint,
  Face,
  Loop,
  Plane,
  Edge,
  Line,
  Fin,
  AttributeIdentifier,
  AttributeDefinition,
  Attribute,
  RealArray,
  PointerList,
  PointerListBlock,
} from "parasolidts"

/** Coordinates in the input unit (millimetres by default). */
export type ParasolidPoint = readonly [number, number, number]
export type ParasolidPolygon = readonly ParasolidPoint[]
export type ParasolidPolygons = readonly ParasolidPolygon[]
/** Native Parasolid RGB values, each in [0, 1]. Alpha is not supported. */
export type ParasolidColor = readonly [number, number, number]

export interface ParasolidWriteOptions {
  /** Input units. Parasolid stores geometry in metres. */
  units?: "mm" | "m"
  /** Reserved for future name attributes; names are not transmitted yet. */
  name?: string
  /** Default RGB color, attached to the body and inherited by its faces. */
  color?: ParasolidColor
  /** Optional face overrides in polygon order; undefined inherits body color. */
  faceColors?: readonly (ParasolidColor | undefined)[]
}

/** A trimmed planar face: outer boundary first, followed by hole boundaries. */
export interface ParasolidPlanarFace {
  loops: ParasolidPolygons
}

interface ParasolidBodyAttributes {
  /** Reserved for future name attributes; names are not transmitted yet. */
  name?: string
  color?: ParasolidColor
  /** One entry per supplied polygon or explicit face; undefined inherits body color. */
  faceColors?: readonly (ParasolidColor | undefined)[]
}

/** Supply polygon faces or explicit multi-loop faces, never both. */
export type ParasolidBodyInput = ParasolidBodyAttributes &
  (
    | { polygons: ParasolidPolygons; faces?: never }
    | { faces: readonly ParasolidPlanarFace[]; polygons?: never }
  )

type Point = [number, number, number]
interface MeshEdge {
  start: number
  end: number
  fins: number[]
  node: Edge
  curve: Line
}
interface MeshFin {
  start: number
  end: number
  edge: MeshEdge
  node: Fin
}

// Below Parasolid's usual 1e-8 m linear resolution. Used only to weld matching
// vertices and split polygon edges at existing vertices (CSG T-junctions).
const tolerance = 1e-9
const sub = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const length = (a: Point) => Math.hypot(...a)
const unit = (a: Point): Point => {
  const magnitude = length(a)
  return [a[0] / magnitude, a[1] / magnitude, a[2] / magnitude]
}
const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)

function normalOf(cycle: number[], points: Point[]): Point {
  const origin = points[cycle[0]!]!
  const sum: Point = [0, 0, 0]
  for (let i = 1; i < cycle.length - 1; i++) {
    const area = cross(
      sub(points[cycle[i]!]!, origin),
      sub(points[cycle[i + 1]!]!, origin),
    )
    for (let axis = 0; axis < 3; axis++) sum[axis]! += area[axis]!
  }
  if (length(sum) <= tolerance * tolerance)
    throw new Error("Polygon has zero area")
  return unit(sum)
}

function preparePolygons(polygons: ParasolidPolygons, scale: number) {
  if (polygons.length < 4)
    throw new Error("A closed solid requires at least four polygons")
  const points: Point[] = []
  const inputPoints: Point[] = []
  const bins = new Map<string, number[]>()
  const vertex = (input: ParasolidPoint): number => {
    if (input.length !== 3 || !input.every(Number.isFinite)) {
      throw new Error("Every vertex must contain three finite coordinates")
    }
    const p = input.map((value) => value * scale) as Point
    if (!p.every(Number.isFinite))
      throw new Error("Vertex coordinate is out of range")
    const cell = p.map((value) => Math.floor(value / tolerance)) as Point
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const nearby = bins.get(
            `${cell[0] + x},${cell[1] + y},${cell[2] + z}`,
          )
          for (const index of nearby ?? []) {
            if (length(sub(points[index]!, p)) <= tolerance) return index
          }
        }
      }
    }
    const index = points.length
    points.push(p)
    inputPoints.push([...input])
    const key = cell.join(",")
    const bucket = bins.get(key) ?? []
    bucket.push(index)
    bins.set(key, bucket)
    return index
  }
  let cycles = polygons.map((polygon) => {
    const ids = polygon.map(vertex)
    if (ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop()
    if (ids.length < 3 || new Set(ids).size !== ids.length) {
      throw new Error(
        "Polygon must have at least three distinct vertices without repeated edges",
      )
    }
    const normal = normalOf(ids, points)
    const origin = points[ids[0]!]!
    if (
      ids.some(
        (id) => Math.abs(dot(sub(points[id]!, origin), normal)) > tolerance,
      )
    ) {
      throw new Error("Only planar polygons can be written to Parasolid")
    }
    return ids
  })

  // JSCAD boolean operations can leave a vertex on the middle of a neighbour's
  // edge. Both faces must use the same set of topological edges in a B-rep.
  cycles = cycles.map((cycle) =>
    cycle.flatMap((start, i) => {
      const end = cycle[(i + 1) % cycle.length]!
      const a = points[start]!
      const delta = sub(points[end]!, a)
      const squared = dot(delta, delta)
      const edgeLength = Math.sqrt(squared)
      const splits: { index: number; fraction: number }[] = [
        { index: start, fraction: 0 },
      ]
      points.forEach((p, index) => {
        if (index === start || index === end) return
        const relative = sub(p, a)
        const fraction = dot(relative, delta) / squared
        if (
          fraction <= tolerance / edgeLength ||
          fraction >= 1 - tolerance / edgeLength
        )
          return
        const distance = length(cross(relative, delta)) / edgeLength
        if (distance <= tolerance) splits.push({ index, fraction })
      })
      return splits
        .sort((a, b) => a.fraction - b.fraction)
        .map((split) => split.index)
    }),
  )

  return { points, inputPoints, cycles }
}

function inputScale(options: Pick<ParasolidWriteOptions, "units">) {
  if (
    options.units !== undefined &&
    options.units !== "mm" &&
    options.units !== "m"
  ) {
    throw new Error("Input units must be 'mm' or 'm'")
  }
  return options.units === "m" ? 1 : 0.001
}

/**
 * Weld matching vertices and split CSG T-junctions before dividing a mesh into
 * edge-connected shells. Returns fresh coordinates in the original input unit.
 * The welding tolerance is 1e-9 metres (1e-6 millimetres). This checks polygon
 * planarity and degeneracy; full closed-manifold validation happens on write.
 */
export function normalizePolygons(
  polygons: ParasolidPolygons,
  options: Pick<ParasolidWriteOptions, "units"> = {},
): ParasolidPoint[][] {
  const scale = inputScale(options)
  const { inputPoints, cycles } = preparePolygons(polygons, scale)
  return cycles.map((cycle) =>
    cycle.map((index) => [...inputPoints[index]!] as Point),
  )
}

function prepareMesh(faces: readonly ParasolidPlanarFace[], scale: number) {
  if (faces.length < 4)
    throw new Error("A closed solid requires at least four faces")
  if (
    faces.some((face) => !Array.isArray(face.loops) || face.loops.length === 0)
  ) {
    throw new Error("Every planar face requires an outer boundary loop")
  }
  const { points, cycles } = preparePolygons(
    faces.flatMap((face) => [...face.loops]),
    scale,
  )
  let offset = 0
  const boundaries = faces.map((face) => {
    const rings = cycles.slice(offset, offset + face.loops.length)
    offset += face.loops.length
    const outer = rings[0]!
    const normal = normalOf(outer, points)
    const origin = points[outer[0]!]!
    for (const hole of rings.slice(1)) {
      if (
        hole.some(
          (id) => Math.abs(dot(sub(points[id]!, origin), normal)) > tolerance,
        )
      ) {
        throw new Error("All loops of a planar face must lie on the same plane")
      }
      // Inner boundaries traverse the face in the opposite direction.
      if (dot(normalOf(hole, points), normal) > 0) hole.reverse()
    }
    return rings
  })

  const uses = new Map<string, { face: number; start: number; end: number }[]>()
  boundaries.forEach((rings, face) => {
    for (const cycle of rings)
      cycle.forEach((start, i) => {
        const end = cycle[(i + 1) % cycle.length]!
        const key = edgeKey(start, end)
        const entries = uses.get(key) ?? []
        entries.push({ face, start, end })
        uses.set(key, entries)
      })
  })
  for (const entries of uses.values()) {
    if (entries.length !== 2 || entries[0]!.face === entries[1]!.face) {
      throw new Error(
        `Mesh is open or non-manifold: an edge has ${entries.length} incident faces (expected two)`,
      )
    }
  }

  // Edge incidence alone misses pinched vertices, where two otherwise closed
  // surface patches touch at a point. The incident faces must form one fan.
  const vertexFaces = points.map(() => new Set<number>())
  const vertexNeighbours = points.map(() => new Map<number, Set<number>>())
  boundaries.forEach((rings, face) => {
    for (const cycle of rings)
      for (const vertex of cycle) vertexFaces[vertex]!.add(face)
  })
  for (const entries of uses.values()) {
    const [a, b] = entries
    for (const vertex of [a!.start, a!.end]) {
      const neighbours = vertexNeighbours[vertex]!
      for (const [face, other] of [
        [a!.face, b!.face],
        [b!.face, a!.face],
      ]) {
        const adjacent = neighbours.get(face!) ?? new Set<number>()
        adjacent.add(other!)
        neighbours.set(face!, adjacent)
      }
    }
  }
  vertexFaces.forEach((faces, vertex) => {
    const first = faces.values().next().value!
    const visited = new Set([first])
    const queue = [first]
    for (let i = 0; i < queue.length; i++) {
      for (const neighbour of vertexNeighbours[vertex]!.get(queue[i]!) ?? []) {
        if (visited.has(neighbour)) continue
        visited.add(neighbour)
        queue.push(neighbour)
      }
    }
    if (visited.size !== faces.size) {
      throw new Error(
        "Mesh is non-manifold: a vertex has disconnected incident face fans",
      )
    }
  })

  // Propagate a consistent orientation. Each shared edge must be traversed in
  // opposite directions by its two faces, regardless of input winding.
  const flips = new Map<number, boolean>([[0, false]])
  const queue = [0]
  for (let q = 0; q < queue.length; q++) {
    const face = queue[q]!
    for (const cycle of boundaries[face]!)
      cycle.forEach((start, i) => {
        const entries = uses.get(
          edgeKey(start, cycle[(i + 1) % cycle.length]!),
        )!
        const own = entries.find((entry) => entry.face === face)!
        const other = entries.find((entry) => entry.face !== face)!
        const flip = flips.get(face)! !== (own.start === other.start)
        if (!flips.has(other.face)) {
          flips.set(other.face, flip)
          queue.push(other.face)
        } else if (flips.get(other.face) !== flip) {
          throw new Error("Mesh is not orientable")
        }
      })
  }
  if (flips.size !== boundaries.length) {
    throw new Error(
      "Disconnected shells are not supported in one body; use one connected shell per body",
    )
  }
  boundaries.forEach((rings, face) => {
    if (flips.get(face)) for (const cycle of rings) cycle.reverse()
  })
  const origin = points[cycles[0]![0]!]!
  let volume6 = 0
  for (const cycle of cycles) {
    const a = sub(points[cycle[0]!]!, origin)
    for (let i = 1; i < cycle.length - 1; i++) {
      volume6 += dot(
        a,
        cross(
          sub(points[cycle[i]!]!, origin),
          sub(points[cycle[i + 1]!]!, origin),
        ),
      )
    }
  }
  if (Math.abs(volume6) <= tolerance ** 3)
    throw new Error("Mesh encloses zero volume")
  if (volume6 < 0) cycles.forEach((cycle) => cycle.reverse())
  return { points, boundaries }
}

/** Converter-owned topology construction; the parser only serializes entities. */
export function buildParasolidRepository(
  bodies: readonly ParasolidBodyInput[],
  options: Pick<ParasolidWriteOptions, "units"> = {},
): Repository {
  if (bodies.length === 0)
    throw new Error("At least one solid body is required")
  const scale = inputScale(options)
  const configure = <T extends Entity>(entity: T, properties: Partial<T>) =>
    Object.assign(entity, properties)
  // Assign IDs while building the graph so references can precede their targets.
  const entities: Entity[] = []
  const add = <T extends Entity>(entity: T): T => {
    entity.id = entities.length + 1
    entities.push(entity)
    return entity
  }
  const ref = <T extends Entity>(
    entity: T | undefined,
  ): EntityReference<T> | null =>
    entity ? new EntityReference<T>(entity.id) : null
  const definitions = new Map<8001 | 8040, AttributeDefinition>()
  const colorDefinition = (kind: 8001 | 8040): AttributeDefinition => {
    const existing = definitions.get(kind)
    if (existing) return existing
    const identifier = add(
      new AttributeIdentifier({
        value: kind === 8001 ? "SDL/TYSA_COLOUR" : "SDL/TYSA_COLOUR_2",
      }),
    )
    const definition = add(
      new AttributeDefinition({
        identifierRef: ref(identifier),
        kindId: kind,
        valueKinds: [2],
        allowedOwners: Array.from({ length: 14 }, (_, index) =>
          kind === 8001 ? index === 4 || index === 6 : index <= 2,
        ),
      }),
    )
    const previous = [...definitions.values()].at(-1)
    if (previous) previous.nextDefinition = ref(definition)
    definitions.set(kind, definition)
    return definition
  }
  const validateColor = (color: ParasolidColor | undefined) => {
    if (color === undefined) return
    if (
      !Array.isArray(color) ||
      color.length !== 3 ||
      ![...color].every(
        (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1,
      )
    )
      throw new Error(
        "Color must contain exactly three finite RGB channels in [0, 1]; alpha is not supported",
      )
  }
  const bodyNodes = bodies.map(() => add(new Body()))
  bodies.forEach((input, bodyIndex) => {
    validateColor(input.color)
    if ((input.polygons === undefined) === (input.faces === undefined))
      throw new Error(
        "A body must supply either polygons or explicit faces, not both",
      )
    const inputFaces =
      input.faces ?? input.polygons!.map((polygon) => ({ loops: [polygon] }))
    if (input.faceColors !== undefined) {
      if (
        !Array.isArray(input.faceColors) ||
        input.faceColors.length !== inputFaces.length
      )
        throw new Error(
          "faceColors must have one entry per input polygon or face",
        )
      input.faceColors.forEach(validateColor)
    }
    const { points, boundaries } = prepareMesh(inputFaces, scale)
    const cycles = boundaries.map((rings) => rings[0]!)
    const body = bodyNodes[bodyIndex]!
    const solid = add(new Region({ regionKind: "S", bodyRef: ref(body) }))
    const exterior = add(
      new Region({
        regionKind: "V",
        bodyRef: ref(body),
        previousRegion: ref(solid),
      }),
    )
    solid.nextRegion = ref(exterior)
    const backShell = add(
      new Shell({ legacyBody: ref(body), regionRef: ref(solid) }),
    )
    const frontShell = add(new Shell({ regionRef: ref(exterior) }))
    solid.shellHead = ref(backShell)
    exterior.shellHead = ref(frontShell)
    for (const entity of [solid, exterior, backShell, frontShell])
      entity.localId = entity.id
    const vertices = points.map(() =>
      add(new Vertex({ precision: null, ownerRef: ref(body) })),
    )
    const pointNodes = points.map((position) =>
      add(new NativePoint({ position: new Vector3(position) })),
    )
    const faces = cycles.map(() =>
      add(
        new Face({
          precision: null,
          backShell: ref(backShell),
          frontShell: ref(frontShell),
        }),
      ),
    )
    const loops = boundaries.map((rings, i) =>
      rings.map(() => add(new Loop({ faceRef: ref(faces[i]) }))),
    )
    const planes = cycles.map(() => add(new Plane()))
    const edges: MeshEdge[] = []
    const edgeMap = new Map<string, MeshEdge>()
    const fins: MeshFin[] = []
    const vertexFins = points.map(() => [] as number[])
    const faceFins = boundaries.map((rings) =>
      rings.map((cycle) =>
        cycle.map((start, i) => {
          const end = cycle[(i + 1) % cycle.length]!
          const key = edgeKey(start, end)
          let edge = edgeMap.get(key)
          if (!edge) {
            edge = {
              start,
              end,
              fins: [],
              node: add(new Edge({ precision: null, ownerRef: ref(body) })),
              curve: add(new Line()),
            }
            edgeMap.set(key, edge)
            edges.push(edge)
          }
          const fin = { start, end, edge, node: add(new Fin()) }
          const index = fins.length
          fins.push(fin)
          edge.fins.push(index)
          vertexFins[end]!.push(index)
          return index
        }),
      ),
    )
    configure(body, {
      minLocalId: body.id,
      maxLocalId: entities.length,
      sizePrecision: 1e3,
      linearPrecision: 1e-8,
      storageState: 1,
      bodyKind: 1,
      nextBody: ref(bodyNodes[bodyIndex + 1]),
      previousBody: ref(bodyNodes[bodyIndex - 1]),
      legacyShell: ref(backShell),
      boundarySurfaces: ref(planes[0]),
      boundaryCurves: ref(edges[0]!.curve),
      boundaryPoints: ref(pointNodes[0]),
      regionHead: ref(solid),
      edgeHead: ref(edges[0]!.node),
      vertexHead: ref(vertices[0]),
    })
    backShell.backFaces = ref(faces[0])
    frontShell.frontFaces = ref(faces[0])
    points.forEach((_, i) => {
      const vertex = vertices[i]!
      const point = pointNodes[i]!
      configure(vertex, {
        localId: vertex.id,
        finHead: ref(fins[vertexFins[i]![0]!]!.node),
        previousVertex: ref(vertices[i - 1]),
        nextVertex: ref(vertices[i + 1]),
        pointRef: ref(point),
      })
      configure(point, {
        localId: point.id,
        ownerRef: ref(vertex),
        nextPoint: ref(pointNodes[i + 1]),
        previousPoint: ref(pointNodes[i - 1]),
      })
    })
    cycles.forEach((cycle, i) => {
      const face = faces[i]!
      const faceLoops = loops[i]!
      const plane = planes[i]!
      const next = ref(faces[i + 1])
      const previous = ref(faces[i - 1])
      configure(face, {
        localId: face.id,
        nextBack: next,
        previousBack: previous,
        loopHead: ref(faceLoops[0]),
        surfaceRef: ref(plane),
        nextFront: next,
        previousFront: previous,
      })
      const rings = faceFins[i]!
      faceLoops.forEach((loop, j) => {
        loop.localId = loop.id
        loop.finRef = ref(fins[rings[j]![0]!]!.node)
        loop.nextLoop = ref(faceLoops[j + 1])
      })
      const origin = points[cycle[0]!]!
      configure(plane, {
        localId: plane.id,
        ownerRef: ref(face),
        nextSurface: ref(planes[i + 1]),
        previousSurface: ref(planes[i - 1]),
        origin: new Vector3(origin),
        normal: new Vector3(normalOf(cycle, points)),
        xDirection: new Vector3(unit(sub(points[cycle[1]!]!, origin))),
      })
      rings.forEach((ring, loopIndex) => {
        ring.forEach((finIndex, j) => {
          const fin = fins[finIndex]!
          const atVertex = vertexFins[fin.end]!
          const nextAtVertex = atVertex[atVertex.indexOf(finIndex) + 1]
          const other = fin.edge.fins.find((index) => index !== finIndex)!
          configure(fin.node, {
            loopRef: ref(faceLoops[loopIndex]),
            forwardFin: ref(fins[ring[(j + 1) % ring.length]!]!.node),
            backwardFin: ref(
              fins[ring[(j + ring.length - 1) % ring.length]!]!.node,
            ),
            endVertex: ref(vertices[fin.end]),
            radialFin: ref(fins[other]!.node),
            edgeRef: ref(fin.edge.node),
            nextVertexFin: ref(
              nextAtVertex === undefined ? undefined : fins[nextAtVertex]!.node,
            ),
            orientation: fin.start === fin.edge.start ? "+" : "-",
          })
        })
      })
    })
    edges.forEach((edge, i) => {
      configure(edge.node, {
        localId: edge.node.id,
        finRef: ref(fins[edge.fins[0]!]!.node),
        previousEdge: ref(edges[i - 1]?.node),
        nextEdge: ref(edges[i + 1]?.node),
        curveRef: ref(edge.curve),
      })
      configure(edge.curve, {
        localId: edge.curve.id,
        ownerRef: ref(edge.node),
        nextCurve: ref(edges[i + 1]?.curve),
        previousCurve: ref(edges[i - 1]?.curve),
        origin: new Vector3(points[edge.start]!),
        tangent: new Vector3(unit(sub(points[edge.end]!, points[edge.start]!))),
      })
    })
    const chains = new Map<8001 | 8040, Attribute[]>()
    const attachColor = (
      owner: Body | Face,
      kind: 8001 | 8040,
      color: ParasolidColor,
    ) => {
      const definition = colorDefinition(kind)
      const values = add(new RealArray({ values: [...color] }))
      const attribute = add(
        new Attribute({
          definitionRef: ref(definition),
          ownerRef: ref(owner),
          valueArrays: [ref(values)],
        }),
      )
      attribute.localId = attribute.id
      owner.annotations = ref(attribute)
      const chain = chains.get(kind) ?? []
      const previous = chain.at(-1)
      if (previous) {
        previous.nextSameKind = ref(attribute)
        attribute.previousSameKind = ref(previous)
      }
      chain.push(attribute)
      chains.set(kind, chain)
    }
    if (input.color) attachColor(body, 8040, input.color)
    faces.forEach((face, index) => {
      const color = input.faceColors?.[index] ?? input.color
      if (color) attachColor(face, 8001, color)
    })
    if (chains.size > 0) {
      const heads = [...chains.values()].map((chain) => ref(chain[0]))
      const list = add(new PointerList())
      const block = add(
        new PointerListBlock({
          entries: [...heads, ...Array<null>(20 - heads.length).fill(null)],
        }),
      )
      block.usedCount = heads.length
      configure(list, {
        transmissionFlag: false,
        ownerRef: ref(body),
        entryCount: heads.length,
        blockCapacity: 20,
        cursorIndex: 1,
        cursorBlock: ref(block),
        firstBlock: ref(block),
      })
      body.attributeLists = ref(list)
      body.maxLocalId = entities.length
    }
  })
  return new Repository({ entities })
}

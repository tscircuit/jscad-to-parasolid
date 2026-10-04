import { createParasolidFromBodies, normalizePolygons } from "parasolidts"
import { geom3ToPolygons } from "./geom3-to-polygons"
import { resolveGeometries } from "./resolve-geometries"
import { splitConnectedShells } from "./split-connected-shells"
import type {
  JscadToParasolidInput,
  JscadToParasolidOptions,
  ParasolidBodyInput,
} from "./types"

export type {
  Geom3Like,
  Geom3Vertex,
  JscadToParasolidInput,
  JscadToParasolidOptions,
  ParasolidBodyInput,
  Point3,
  RenderedModel,
} from "./types"

/**
 * Resolve JSCAD geometry into world-coordinate polygon bodies, in input units.
 * No caller-owned geometry or matrices are mutated. Colors are not exported.
 * The X_T writer performs planarity and closed-manifold validation afterwards.
 */
export function jscadToParasolidBodies(
  input: JscadToParasolidInput,
  options: JscadToParasolidOptions = {},
): ParasolidBodyInput[] {
  if (
    options.units !== undefined &&
    options.units !== "mm" &&
    options.units !== "m"
  ) {
    throw new Error('Input units must be "mm" or "m"')
  }
  const bodies: ParasolidBodyInput[] = []
  for (const { geom, name } of resolveGeometries(input)) {
    const rawPolygons = geom3ToPolygons(geom)
    if (rawPolygons.length === 0) continue
    const normalized = normalizePolygons(rawPolygons, { units: options.units })
    for (const polygons of splitConnectedShells(normalized)) {
      bodies.push({ polygons, name: name ?? options.name })
    }
  }
  if (bodies.length === 0) {
    throw new Error(
      "Cannot export an empty model: no solid geometry was provided",
    )
  }
  return bodies
}

/**
 * Convert JSCAD/modelprinter geometry to native Parasolid text (.x_t).
 * Curves remain JSCAD's planar facets; this does not reconstruct analytic curves.
 */
export function jscadToParasolid(
  input: JscadToParasolidInput,
  options: JscadToParasolidOptions = {},
): string {
  return createParasolidFromBodies(jscadToParasolidBodies(input, options), {
    units: options.units,
  })
}

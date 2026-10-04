import jscad from "@jscad/modeling"
import {
  executeJscadOperations,
  type JscadImplementation,
  type JscadOperation,
} from "jscad-planner"
import type { Geom3Like, JscadToParasolidInput } from "./types"

export interface NamedGeometry {
  geom: Geom3Like
  name?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

function asGeom3(value: unknown, label: string): Geom3Like {
  if (!isRecord(value) || !Array.isArray(value.polygons)) {
    throw new Error(`${label} must be a JSCAD geom3 solid with polygons`)
  }
  return value as unknown as Geom3Like
}

export function resolveGeometries(
  input: JscadToParasolidInput,
): NamedGeometry[] {
  if (Array.isArray(input)) {
    return input.map((geom, index) => ({
      geom: asGeom3(geom, `Geometry ${index}`),
    }))
  }

  if (!isRecord(input)) {
    throw new Error("Expected a JSCAD operation, geom3, or rendered model")
  }

  if ("geometries" in input) {
    if (!Array.isArray(input.geometries)) {
      throw new Error("Rendered model geometries must be an array")
    }
    return input.geometries.map((entry: unknown, index: number) => {
      if (!isRecord(entry)) {
        throw new Error(`Rendered geometry ${index} must contain a geom3`)
      }
      return {
        geom: asGeom3(entry.geom, `Rendered geometry ${index}`),
        ...(typeof entry.name === "string" ? { name: entry.name } : {}),
      }
    })
  }

  if ("polygons" in input) {
    return [{ geom: asGeom3(input, "Geometry") }]
  }

  if (typeof input.type !== "string") {
    throw new Error("Expected a JSCAD operation, geom3, or rendered model")
  }

  // The planner adapter widens JSCAD's tuple parameters to number[], so the
  // adapter cast is needed at this boundary. Returned values are still checked.
  const result: unknown = executeJscadOperations(
    jscad as unknown as JscadImplementation<Geom3Like>,
    input as unknown as JscadOperation,
  )
  return (Array.isArray(result) ? result : [result]).map((geom, index) => ({
    geom: asGeom3(geom, `Operation result ${index}`),
  }))
}

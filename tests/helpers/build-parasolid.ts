import { buildParasolidRepository } from "../../lib/build-parasolid"
import type {
  ParasolidBodyInput as BuildBody,
  ParasolidPolygons,
  ParasolidWriteOptions,
} from "../../lib/parasolid/types"
export const createParasolidFromBodies = (
  bodies: readonly BuildBody[],
  options: ParasolidWriteOptions = {},
) => buildParasolidRepository(bodies, options).getString()
export const createParasolidFromPolygons = (
  polygons: ParasolidPolygons,
  options: ParasolidWriteOptions = {},
) =>
  createParasolidFromBodies(
    [{ polygons, color: options.color, faceColors: options.faceColors }],
    options,
  )

import type { JscadOperation } from "jscad-planner"

export type Point3 = readonly [number, number, number]

/** Also accepts JSON-exported JSCAD vertices and typed coordinate arrays. */
export type Geom3Vertex =
  | ArrayLike<number>
  | { readonly pos: ArrayLike<number> }
  | { readonly position: ArrayLike<number> }

export interface Geom3Like {
  readonly polygons: readonly {
    readonly vertices: readonly Geom3Vertex[]
  }[]
  /** JSCAD's column-major, lazily applied affine matrix. */
  readonly transforms?: ArrayLike<number>
  readonly color?: readonly number[]
}

/** The vanilla jscad-electronics renderer's modelprinter result. */
export interface RenderedModel {
  readonly geometries: readonly {
    readonly geom: Geom3Like
    readonly color?: string | readonly number[]
    readonly name?: string
  }[]
}

export type JscadToParasolidInput =
  | JscadOperation
  | Geom3Like
  | readonly Geom3Like[]
  | RenderedModel

export interface JscadToParasolidOptions {
  /** Input length unit. X_T coordinates are always written in metres. */
  readonly units?: "mm" | "m"
  /** Reserved for future X_T name attributes; not transmitted yet. */
  readonly name?: string
}

export interface ParasolidBodyInput {
  readonly polygons: readonly (readonly Point3[])[]
  readonly name?: string
}

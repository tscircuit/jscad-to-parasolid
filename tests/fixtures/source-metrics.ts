import jscad from "@jscad/modeling"

type Geometry = ReturnType<typeof jscad.primitives.cuboid>

/**
 * Independent area measurement of source polygons. JSCAD's measureArea derives
 * its normal from three vertices, which loses precision for almost-collinear
 * boolean vertices in the NEMA17 case. Summing area vectors uses the whole face.
 */
export function measureSourcePolygonArea(
  geometries: readonly Geometry[],
): number {
  let area = 0
  for (const geometry of geometries) {
    const copy = jscad.geometries.geom3.clone(geometry)
    for (const polygon of jscad.geometries.geom3.toPolygons(copy)) {
      const vertices = polygon.vertices
      const origin = vertices[0]!
      const normal = [0, 0, 0]
      for (let i = 1; i < vertices.length - 1; i++) {
        const a = vertices[i]!.map((value, axis) => value - origin[axis]!)
        const b = vertices[i + 1]!.map((value, axis) => value - origin[axis]!)
        normal[0]! += a[1]! * b[2]! - a[2]! * b[1]!
        normal[1]! += a[2]! * b[0]! - a[0]! * b[2]!
        normal[2]! += a[0]! * b[1]! - a[1]! * b[0]!
      }
      area += Math.hypot(...normal) / 2
    }
  }
  return area
}

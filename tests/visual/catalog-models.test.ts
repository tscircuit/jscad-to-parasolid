import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadPlanner } from "jscad-planner"
import { jscadToParasolid } from "../../lib"
import { catalogModels } from "../fixtures/catalog-models"
import { measureSourcePolygonArea } from "../fixtures/source-metrics"
import { nativePreview } from "./native-preview"

type Geometry = ReturnType<typeof jscad.primitives.cuboid>

for (const fixture of catalogModels) {
  test(`native X_T reconstructs catalog model ${fixture.modelString}`, async () => {
    const planned = getJscadModelForFootprint(
      fixture.modelString,
      jscadPlanner as unknown as typeof jscad,
    )
    const source = jscadToParasolid(planned)
    // Evaluate a separate source model for metrics, independently of export.
    const reference = getJscadModelForFootprint(fixture.modelString, jscad)
    const geometries = reference.geometries
      .map((entry) => entry.geom as Geometry)
      .filter((geom) => geom.polygons.length > 0)
    const expectedVolume = geometries.reduce(
      (sum, geom) => sum + jscad.measurements.measureVolume(geom),
      0,
    )
    const expectedArea = measureSourcePolygonArea(geometries)
    const expectedBounds = jscad.measurements
      .measureAggregateBoundingBox(...geometries)
      .flat()

    const report = await nativePreview(fixture.name, source)
    expect(report.output_topology.solids).toBe(fixture.expectedBodies)
    expect(expectedVolume).toBeGreaterThan(0)
    expect(
      Math.abs(report.metrics.volume - expectedVolume) / expectedVolume,
    ).toBeLessThan(1e-6)
    expect(
      Math.abs(report.metrics.surface_area - expectedArea) / expectedArea,
    ).toBeLessThan(1e-6)
    for (let axis = 0; axis < 6; axis++) {
      expect(
        Math.abs(report.metrics.bounding_box[axis]! - expectedBounds[axis]!),
      ).toBeLessThan(1e-5)
    }
  }, 180_000)
}

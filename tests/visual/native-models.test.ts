import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadPlanner } from "jscad-planner"
import { jscadToParasolid } from "../../lib/index"
import { parseRepository } from "parasolidts"
import { measureSourcePolygonArea } from "../fixtures/source-metrics"
import { nativePreview, type NativeReport } from "./native-preview"

const { cuboid, cylinder } = jscad.primitives
const { subtract } = jscad.booleans
const { translate, mirrorX } = jscad.transforms
const { measureVolume, measureAggregateBoundingBox } = jscad.measurements

type Geometry = ReturnType<typeof cuboid>

function compareMetrics(report: NativeReport, geometries: Geometry[]) {
  const volume = geometries.reduce((sum, geom) => sum + measureVolume(geom), 0)
  const area = measureSourcePolygonArea(geometries)
  // OCCT integrates the reconstructed B-Rep; JSCAD measures source polygons.
  expect(Math.abs(report.metrics.volume - volume) / volume).toBeLessThan(1e-6)
  expect(Math.abs(report.metrics.surface_area - area) / area).toBeLessThan(1e-6)
  const bounds = measureAggregateBoundingBox(...geometries).flat()
  for (let i = 0; i < 6; i++) {
    expect(Math.abs(report.metrics.bounding_box[i]! - bounds[i]!)).toBeLessThan(
      1e-5,
    )
  }
}

test("native X_T preserves box dimensions, volume, and surface area", async () => {
  const box = translate([10, 20, 30], mirrorX(cuboid({ size: [20, 10, 6] })))
  box.color = [1, 0, 0, 1]
  box.polygons[0]!.color = [0, 1, 0, 1]
  const document = parseRepository(jscadToParasolid(box))
  expect(document.fullyParsed).toBe(true)
  const report = await nativePreview(
    "translated-box",
    document.getString({ canonical: true }),
  )
  expect(report.output_topology.solids).toBe(1)
  expect(report.output_topology.faces).toBe(6)
  expect(report.native_colors.body_colors).toEqual([
    { body_id: 0, rgb: [1, 0, 0] },
  ])
  expect(report.native_colors.palette).toEqual([
    [0, 1, 0],
    [1, 0, 0],
  ])
  expect(report.native_colors.face_color_count).toBe(6)
  expect(report.native_colors.colored_primitive_count).toBe(6)
  expect(report.native_colors.uncolored_primitive_count).toBe(0)
  expect(report.metrics.volume).toBeCloseTo(1200, 6)
  expect(report.metrics.surface_area).toBeCloseTo(760, 6)
  compareMetrics(report, [box])
}, 180_000)

test("native X_T retains a boolean through-hole", async () => {
  const shape = subtract(
    cuboid({ size: [20, 16, 6] }),
    cylinder({ radius: 3, height: 10, segments: 24 }),
  )
  const report = await nativePreview("through-hole", jscadToParasolid(shape))
  expect(report.output_topology.solids).toBe(1)
  compareMetrics(report, [shape])
}, 180_000)

test("native X_T retains separate bodies in an assembly", async () => {
  const geometries = [
    translate([-8, 0, 0], cuboid({ size: [8, 10, 5] })),
    translate([8, 0, 0], cylinder({ radius: 4, height: 7, segments: 24 })),
  ]
  const report = await nativePreview(
    "multiple-bodies",
    jscadToParasolid(geometries),
  )
  expect(report.output_topology.solids).toBe(2)
  compareMetrics(report, geometries)
}, 180_000)

for (const [name, modelString] of [
  ["soic8", "soic8"],
  ["modelprinter-sheetmetal", "sheetmetal_channel_w28_l24_h16_t1_r2"],
  ["modelprinter-nema8", "nema8"],
] as const) {
  test(`native X_T reconstructs ${name} from jscad-electronics`, async () => {
    const planned = getJscadModelForFootprint(
      modelString,
      jscadPlanner as unknown as typeof jscad,
    )
    // Evaluate a separate source model for metrics, independently of export.
    const reference = getJscadModelForFootprint(modelString, jscad)
    const geometries = reference.geometries
      .map((entry) => entry.geom as Geometry)
      .filter((geom) => geom.polygons.length > 0)
    const report = await nativePreview(name, jscadToParasolid(planned))
    expect(report.output_topology.solids).toBeGreaterThanOrEqual(
      geometries.length,
    )
    if (name === "soic8") {
      // The released producer uses tinned #c4c7ca leads and one #555 housing.
      const leadRgb = [196 / 255, 199 / 255, 202 / 255]
      expect(report.native_colors.palette).toEqual([
        [1 / 3, 1 / 3, 1 / 3],
        leadRgb,
      ])
      expect(
        report.native_colors.body_colors.filter(({ rgb }) =>
          rgb.every((value, index) => value === leadRgb[index]),
        ),
      ).toHaveLength(8)
      expect(report.native_colors.uncolored_primitive_count).toBe(0)
    }
    compareMetrics(report, geometries)
  }, 180_000)
}

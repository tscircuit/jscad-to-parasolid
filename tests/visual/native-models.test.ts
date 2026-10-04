import { expect, test } from "bun:test"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadToParasolid } from "../../lib/index"
import { parseRepository } from "parasolidts"
import { nativePreview, type NativeReport } from "./native-preview"

const { cuboid, cylinder } = jscad.primitives
const { subtract } = jscad.booleans
const { translate, mirrorX } = jscad.transforms
const { measureVolume, measureAggregateBoundingBox } = jscad.measurements

type Geometry = ReturnType<typeof cuboid>

function compareMetrics(report: NativeReport, geometries: Geometry[]) {
  const volume = geometries.reduce((sum, geom) => sum + measureVolume(geom), 0)
  // OCCT integrates the reconstructed B-Rep; JSCAD measures source polygons.
  expect(Math.abs(report.metrics.volume - volume) / volume).toBeLessThan(1e-6)
  const bounds = measureAggregateBoundingBox(...geometries).flat()
  for (let i = 0; i < 6; i++) {
    expect(Math.abs(report.metrics.bounding_box[i]! - bounds[i]!)).toBeLessThan(
      1e-5,
    )
  }
}

test("native X_T preserves box dimensions, volume, and surface area", async () => {
  const box = translate([10, 20, 30], mirrorX(cuboid({ size: [20, 10, 6] })))
  const document = parseRepository(jscadToParasolid(box))
  expect(document.fullyParsed).toBe(true)
  const report = await nativePreview(
    "translated-box",
    document.getString({ canonical: true }),
  )
  expect(report.output_topology.solids).toBe(1)
  expect(report.output_topology.faces).toBe(6)
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
    const model = getJscadModelForFootprint(modelString, jscad)
    const geometries = model.geometries
      .map((entry) => entry.geom as Geometry)
      .filter((geom) => geom.polygons.length > 0)
    const report = await nativePreview(name, jscadToParasolid(model))
    expect(report.output_topology.solids).toBeGreaterThanOrEqual(
      geometries.length,
    )
    compareMetrics(report, geometries)
  }, 180_000)
}

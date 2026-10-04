import { expect } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import looksSame from "looks-same"
import { computeWorldAABB, createSceneFromGLTF } from "poppygl"
import { previewViews, renderPreview } from "./render-preview"

const root = fileURLToPath(new URL("../../", import.meta.url))
const outputRoot = join(root, "tests/visual/.artifacts")
const snapshots = join(root, "tests/visual/__snapshots__")

export interface NativeReport {
  source_complete: boolean
  conversion_complete: boolean
  occt_valid: boolean
  output_topology: { solids: number; shells: number; faces: number }
  metrics: {
    volume: number
    surface_area: number
    bounding_box: [number, number, number, number, number, number]
  }
  healing: { requested: boolean; performed: boolean }
  native_colors: {
    source: "native_x_t_attributes"
    body_colors: { body_id: number; rgb: number[] }[]
    face_color_count: number
    palette: number[][]
    colored_primitive_count: number
    uncolored_primitive_count: number
    material_color_space: "linear_srgb"
  }
  mesh_validation: {
    valid: boolean
    body_count: number
    triangle_count: number
  }
  preview: {
    triangle_count: number
    vertex_count: number
    missing_face_count: number
    glb_valid: boolean
  }
}

/** Every pixel comes from independently reparsing the emitted native X_T. */
export async function nativePreview(name: string, source: string) {
  const output = join(outputRoot, name)
  await mkdir(output, { recursive: true })
  const xtPath = join(output, "model.x_t")
  const glbPath = join(output, "model.glb")
  const reportPath = join(output, "report.json")
  await writeFile(xtPath, source)
  const python = process.env.PARASOLID_PYTHON ?? join(root, ".venv/bin/python")
  const converted = spawnSync(
    python,
    [
      join(root, "scripts/validation/parasolid-to-glb.py"),
      xtPath,
      glbPath,
      "--report",
      reportPath,
    ],
    { encoding: "utf8", timeout: 150_000 },
  )
  if (converted.error || converted.status !== 0) {
    throw new Error(
      `Native X_T validation failed for ${name}. Install scripts/validation/requirements.txt into .venv, or set PARASOLID_PYTHON.\n${converted.error?.message ?? ""}\n${converted.stdout}\n${converted.stderr}`,
    )
  }
  const report: NativeReport = JSON.parse(await readFile(reportPath, "utf8"))
  expect(report.source_complete).toBe(true)
  expect(report.conversion_complete).toBe(true)
  expect(report.occt_valid).toBe(true)
  expect(report.output_topology.solids).toBeGreaterThan(0)
  expect(report.output_topology.shells).toBe(report.output_topology.solids)
  expect(report.healing.performed).toBe(false)
  expect(report.preview.glb_valid).toBe(true)
  expect(report.preview.missing_face_count).toBe(0)
  expect(report.preview.triangle_count).toBeGreaterThan(0)
  expect(report.native_colors.source).toBe("native_x_t_attributes")
  expect(report.mesh_validation.valid).toBe(true)
  expect(report.mesh_validation.body_count).toBe(report.output_topology.solids)
  expect(report.mesh_validation.triangle_count).toBe(
    report.preview.triangle_count,
  )

  const glb = await readFile(glbPath)
  const jsonLength = glb.readUInt32LE(12)
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString())
  const binaryStart = 20 + jsonLength + 8
  const scene = createSceneFromGLTF(gltf, {
    buffers: [glb.subarray(binaryStart)],
    images: [],
  })
  const { min, max } = computeWorldAABB(scene.drawCalls)
  const glbBounds = [...min, ...max]
  for (let i = 0; i < 6; i++) {
    // GLB uses meters, while the independent OCCT report uses millimeters.
    expect(
      Math.abs(glbBounds[i]! * 1000 - report.metrics.bounding_box[i]!),
    ).toBeLessThan(1e-4)
  }
  for (const view of previewViews) {
    const suffix = view === "primary" ? "" : "-opposite"
    const pngPath = join(output, `model${suffix}.png`)
    const png = await renderPreview(scene, view)
    await writeFile(pngPath, png)
    const snapshot = join(snapshots, `${name}${suffix}.snap.png`)
    if (process.env.BUN_UPDATE_SNAPSHOTS === "1") {
      await mkdir(snapshots, { recursive: true })
      await writeFile(snapshot, png)
    }
    try {
      await readFile(snapshot)
    } catch {
      throw new Error(
        `Missing visual snapshot ${snapshot}. Generate and inspect it with BUN_UPDATE_SNAPSHOTS=1 bun test tests/visual`,
      )
    }
    const result = await looksSame(pngPath, snapshot, {
      tolerance: 2,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })
    if (!result.equal) {
      const diff = join(output, `diff${suffix}.png`)
      await looksSame.createDiff({
        reference: snapshot,
        current: pngPath,
        diff,
        highlightColor: "#ff00ff",
        tolerance: 2,
        ignoreAntialiasing: false,
        ignoreCaret: false,
      })
      throw new Error(
        `Visual snapshot changed: ${name}. Actual: ${pngPath}. Diff: ${diff}`,
      )
    }
  }
  return report
}

import { expect, test } from "bun:test"
import looksSame from "looks-same"
import type { GLTFScene } from "poppygl"
import {
  assertPreviewFrustum,
  normalizePreviewScene,
  renderPreview,
  previewViews,
} from "./render-preview"

function packageScene(scale: number): GLTFScene {
  return {
    gltf: {},
    drawCalls: [
      {
        // A small, closed 6 x 4 x 1 package in millimeter source coordinates.
        positions: new Float32Array([
          -3, -2, -0.5, 3, -2, -0.5, 3, 2, -0.5, -3, 2, -0.5, -3, -2, 0.5, 3,
          -2, 0.5, 3, 2, 0.5, -3, 2, 0.5,
        ]),
        indices: new Uint32Array([
          0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6,
          5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
        ]),
        normals: null,
        uvs: null,
        model: new Float32Array([
          scale,
          0,
          0,
          0,
          0,
          scale,
          0,
          0,
          0,
          0,
          scale,
          0,
          0,
          0,
          0,
          1,
        ]),
        material: {
          baseColorFactor: [0.4, 0.6, 0.8, 1],
          baseColorTexture: null,
        },
      },
    ],
  }
}

test("camera regression catches clipped millimeter packages in meter-unit GLB", () => {
  const scene = packageScene(0.001)
  for (const view of previewViews) {
    expect(() => assertPreviewFrustum(scene, view)).toThrow(
      "clips model geometry",
    )
    expect(() =>
      assertPreviewFrustum(normalizePreviewScene(scene), view),
    ).not.toThrow()
  }
  const original = Array.from(scene.drawCalls[0]!.model)
  expect(() => assertPreviewFrustum(normalizePreviewScene(scene))).not.toThrow()
  expect(Array.from(scene.drawCalls[0]!.model)).toEqual(original)
})

test("complete preview is invariant across millimeter, meter, and micron scenes", async () => {
  for (const view of previewViews) {
    const reference = Buffer.from(await renderPreview(packageScene(1), view))
    for (const scale of [0.001, 0.000001]) {
      const png = Buffer.from(await renderPreview(packageScene(scale), view))
      const result = await looksSame(reference, png, {
        tolerance: 2,
        ignoreAntialiasing: false,
        ignoreCaret: false,
      })
      expect(result.equal).toBe(true)
    }
  }
})

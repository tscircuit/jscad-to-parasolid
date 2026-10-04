import { expect, test } from "bun:test"
import { buildCamera, SoftwareRenderer, type DrawCall } from "poppygl"

function quad(
  bounds: [number, number, number, number],
  z: number,
  color: [number, number, number],
): DrawCall {
  const [x0, y0, x1, y1] = bounds
  return {
    positions: new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]),
    indices: new Uint32Array([0, 2, 1, 0, 3, 2]),
    normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
    uvs: null,
    model: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -0.005, 1,
    ]),
    material: { baseColorFactor: [...color, 1], baseColorTexture: null },
  }
}

const housing = quad([-3, -2, 3, 2], 0, [0.3, 0.3, 0.3])
const pad = quad([-2.65, 0.335, -1.65, 0.935], 0, [1, 0, 0])
const width = 320
const height = 240
const camera = buildCamera(
  [housing],
  width,
  height,
  50,
  [8, 4, -6],
  [0, 0, 0],
  "z+",
)

function render(draws: DrawCall[]) {
  const renderer = new SoftwareRenderer(width, height)
  renderer.clear([240, 240, 240, 255])
  for (const draw of draws)
    renderer.drawMesh(
      draw,
      camera,
      { dir: [0, 0, 1], ambient: 1 },
      draw.material,
      true,
      false,
    )
  return renderer.buffer
}

function redPixels(bitmap: Uint8Array | Uint8ClampedArray) {
  const indices: number[] = []
  for (let offset = 0; offset < bitmap.length; offset += 4) {
    if (
      bitmap[offset] === 255 &&
      bitmap[offset + 1] === 0 &&
      bitmap[offset + 2] === 0
    )
      indices.push(offset)
  }
  return indices
}

test("coplanar housing and pad have stable later-primitive priority without scanline bands", () => {
  const reference = render([pad])
  const interior = redPixels(reference)
  expect(interior.length).toBeGreaterThan(50)
  const combined = render([housing, pad])
  expect(
    interior.filter(
      (offset) =>
        combined[offset] !== 255 ||
        combined[offset + 1] !== 0 ||
        combined[offset + 2] !== 0,
    ),
  ).toHaveLength(0)
  // Reversing exact depth ties consistently gives the later housing priority.
  expect(redPixels(render([pad, housing]))).toHaveLength(0)
})

test("depth tie tolerance still occludes a genuinely farther pad", () => {
  const farther = quad([-2.65, 0.335, -1.65, 0.935], 0.01, [1, 0, 0])
  expect(redPixels(render([housing, farther]))).toHaveLength(0)
  expect(Buffer.from(render([housing, farther]))).toEqual(
    Buffer.from(render([housing])),
  )
})

const depthTolerance = 2 ** -22
const identity = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
])

function renderDepthStack(
  layers: { depth: number; color: [number, number, number] }[],
) {
  const renderer = new SoftwareRenderer(32, 32)
  renderer.clear([240, 240, 240, 255])
  for (const layer of layers) {
    const face = quad([-0.8, -0.8, 0.8, 0.8], 2 * layer.depth - 1, layer.color)
    face.model = identity
    face.indices = new Uint32Array([0, 1, 2, 0, 2, 3])
    renderer.drawMesh(
      face,
      { view: identity, proj: identity },
      { dir: [0, 0, 1], ambient: 1 },
      face.material,
      true,
      false,
    )
  }
  const pixel = 16 * 32 + 16
  return {
    rgb: Array.from(renderer.buffer.slice(pixel * 4, pixel * 4 + 3)),
    depth: renderer.depth[pixel]!,
  }
}

test("fragments beyond the Float32 error budget remain occluded in either draw order", () => {
  for (const depth of [0.0001, 0.5, 0.9]) {
    const near = { depth, color: [0, 0, 1] as [number, number, number] }
    const far = {
      depth: depth + 2 * depthTolerance,
      color: [1, 0, 0] as [number, number, number],
    }
    expect(renderDepthStack([near, far]).rgb).toEqual([0, 0, 255])
    expect(renderDepthStack([far, near]).rgb).toEqual([0, 0, 255])
  }
})

test("successive depth ties cannot walk the occlusion buffer backward", () => {
  const layers = [{ depth: 0.5, color: [0, 0, 1] as [number, number, number] }]
  for (let step = 1; step <= 10; step++)
    layers.push({
      depth: 0.5 + (step * depthTolerance) / 2,
      color: step <= 2 ? [1, 0, 0] : [0, 1, 0],
    })
  const result = renderDepthStack(layers)
  expect(result.rgb).toEqual([255, 0, 0])
  expect(result.depth).toBe(0.5)
})

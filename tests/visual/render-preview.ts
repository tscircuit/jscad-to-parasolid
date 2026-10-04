import {
  buildCamera,
  computeWorldAABB,
  encodePNG,
  renderSceneFromGLTF,
  type GLTFScene,
} from "poppygl"

export const previewViews = ["primary", "opposite"] as const
export type PreviewView = (typeof previewViews)[number]

const baseOptions = {
  width: 640,
  height: 480,
  supersampling: 2,
  fov: 50,
  ambient: 0.3,
  up: "z+" as const,
  backgroundColor: "#f0f0f0",
}

/** Keep exported GLBs in meters; normalize only the temporary display scene. */
export function normalizePreviewScene(scene: GLTFScene): GLTFScene {
  const { min, max } = computeWorldAABB(scene.drawCalls)
  const diagonal = Math.hypot(...max.map((value, i) => value - min[i]!))
  if (!Number.isFinite(diagonal) || diagonal <= 0) {
    throw new Error("Preview requires nonempty finite geometry")
  }
  const center = min.map((value, i) => (value + max[i]!) / 2)
  const scale = 10 / diagonal
  return {
    ...scene,
    drawCalls: scene.drawCalls.map((drawCall) => {
      const model = new Float32Array(drawCall.model)
      // Pre-multiply by a uniform world-space scale and translation. Vertex
      // buffers, normals, winding, and the original glTF scene stay untouched.
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 3; row++) {
          model[column * 4 + row] =
            scale *
            (drawCall.model[column * 4 + row]! -
              center[row]! * drawCall.model[column * 4 + 3]!)
        }
      }
      return { ...drawCall, model }
    }),
  }
}

function transform(matrix: ArrayLike<number>, point: readonly number[]) {
  return [0, 1, 2, 3].map((row) =>
    [0, 1, 2, 3].reduce(
      (value, column) => value + matrix[column * 4 + row]! * point[column]!,
      0,
    ),
  )
}

function fittedOptions(scene: GLTFScene, view: PreviewView) {
  const { min, max } = computeWorldAABB(scene.drawCalls)
  const center = min.map((value, i) => (value + max[i]!) / 2)
  const sign = view === "primary" ? 1 : -1
  const direction = [sign, sign * 0.5, sign * 0.75]
  const length = Math.hypot(...direction)
  for (let i = 0; i < 3; i++) direction[i] = direction[i]! / length
  const right = [-direction[1]!, direction[0]!, 0]
  const rightLength = Math.hypot(...right)
  for (let i = 0; i < 3; i++) right[i] = right[i]! / rightLength
  const up = [
    -direction[2]! * right[1]!,
    direction[2]! * right[0]!,
    direction[0]! * right[1]! - direction[1]! * right[0]!,
  ]
  const dot = (a: number[], b: number[]) =>
    a.reduce((sum, v, i) => sum + v * b[i]!, 0)
  const tangent = Math.tan((baseOptions.fov * Math.PI) / 360)
  const aspect = baseOptions.width / baseOptions.height
  let distance = 0
  // Fit all eight world bounding-box corners inside 80% of each image axis.
  // This is scale-independent; near/far-plane checks happen separately below.
  for (const x of [min[0]!, max[0]!]) {
    for (const y of [min[1]!, max[1]!]) {
      for (const z of [min[2]!, max[2]!]) {
        const delta = [x - center[0]!, y - center[1]!, z - center[2]!]
        distance = Math.max(
          distance,
          dot(delta, direction) +
            Math.max(
              Math.abs(dot(delta, right)) / (tangent * aspect * 0.8),
              Math.abs(dot(delta, up)) / (tangent * 0.8),
            ),
        )
      }
    }
  }
  return {
    ...baseOptions,
    lightDir: [-0.4 * sign, -0.9 * sign, -0.6 * sign] as [
      number,
      number,
      number,
    ],
    camPos: center.map((value, i) => value + direction[i]! * distance) as [
      number,
      number,
      number,
    ],
    lookAt: center as [number, number, number],
  }
}

/** A pleasing PNG must not hide surfaces cut off by the camera near plane. */
export function assertPreviewFrustum(
  scene: GLTFScene,
  view: PreviewView = "primary",
) {
  const options = fittedOptions(scene, view)
  const camera = buildCamera(
    scene.drawCalls,
    options.width * options.supersampling,
    options.height * options.supersampling,
    options.fov,
    options.camPos,
    options.lookAt,
    options.up,
  )
  for (const drawCall of scene.drawCalls) {
    for (let offset = 0; offset < drawCall.positions.length; offset += 3) {
      const local = [
        drawCall.positions[offset]!,
        drawCall.positions[offset + 1]!,
        drawCall.positions[offset + 2]!,
        1,
      ]
      const clip = transform(
        camera.proj,
        transform(camera.view, transform(drawCall.model, local)),
      )
      const w = clip[3]!
      if (
        !clip.every(Number.isFinite) ||
        w <= 0 ||
        clip.slice(0, 3).some((coordinate) => coordinate < -w || coordinate > w)
      ) {
        throw new Error(
          "Preview camera clips model geometry; refusing incomplete snapshot",
        )
      }
    }
  }
}

export async function renderPreview(
  scene: GLTFScene,
  view: PreviewView = "primary",
) {
  // PoppyGL 0.0.30 clamps near >= 0.01 world units. A valid meter-unit
  // SOIC8 is smaller than that plane. A fixed display extent avoids clipping
  // for both tiny electronics and larger mechanical models.
  const displayScene = normalizePreviewScene(scene)
  assertPreviewFrustum(displayScene, view)
  const { bitmap } = renderSceneFromGLTF(
    displayScene,
    fittedOptions(displayScene, view),
  )
  return encodePNG(bitmap)
}

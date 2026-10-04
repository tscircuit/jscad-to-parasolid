import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))

test("independent GLB audit rejects missing faces, bad winding, normals, and metric drift", () => {
  const result = spawnSync(
    process.env.PARASOLID_PYTHON ?? `${root}.venv/bin/python`,
    ["scripts/validation/test_glb_metrics.py"],
    { cwd: root, encoding: "utf8", timeout: 10_000 },
  )
  if (result.error || result.status !== 0) {
    throw new Error(
      `GLB mesh audit regression failed: ${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`,
    )
  }
  expect(result.status).toBe(0)
})

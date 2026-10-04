import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))

test("native RGB decoder preserves face overrides and rejects corrupt attributes", () => {
  const result = spawnSync(
    process.env.PARASOLID_PYTHON ?? `${root}.venv/bin/python`,
    ["scripts/validation/test_native_colors.py"],
    { cwd: root, encoding: "utf8", timeout: 15_000 },
  )
  if (result.error || result.status !== 0) {
    throw new Error(
      `Native RGB regression failed: ${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`,
    )
  }
  expect(result.status).toBe(0)
})

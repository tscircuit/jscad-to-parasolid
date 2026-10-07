import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import jscad from "@jscad/modeling"
import { getJscadModelForFootprint } from "jscad-electronics/vanilla"
import { jscadToParasolid } from "../../lib"

const root = fileURLToPath(new URL("../../", import.meta.url))

for (const family of ["spur", "helical"] as const) {
  test(`exported ${family} gear B-Reps support centered and offset cylindrical cuts`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "parasolid-cuts-"))
    try {
      const paths: string[] = []
      for (const bore of [false, true]) {
        const model = getJscadModelForFootprint(
          `${family}gear16_m1mm_w4mm_${family === "helical" ? "ha25deg_right_" : ""}${bore ? "bore4mm_" : ""}segments4${family === "helical" ? "_turnsegments12" : ""}`,
          jscad,
        )
        for (const mergeCoplanarFaces of [false, true]) {
          const path = join(directory, `${bore}-${mergeCoplanarFaces}.x_t`)
          await writeFile(path, jscadToParasolid(model, { mergeCoplanarFaces }))
          paths.push(path)
        }
      }
      const result = spawnSync(
        process.env.PARASOLID_PYTHON ?? join(root, ".venv/bin/python"),
        [join(root, "scripts/validation/parasolid-boolean-cut.py"), ...paths],
        { encoding: "utf8", timeout: 120_000 },
      )
      if (result.status !== 0)
        throw new Error(result.stderr || String(result.error))
      const reports = JSON.parse(result.stdout) as {
        cuts: { volume: number; removed: number }[]
      }[]
      expect(reports).toHaveLength(4)
      for (const report of reports) {
        expect(report.cuts).toHaveLength(2)
        expect(report.cuts[1]!.removed).toBeCloseTo(Math.PI * 4, 7)
      }
      for (const pair of [
        [0, 1],
        [2, 3],
      ]) {
        for (let cut = 0; cut < 2; cut++) {
          expect(reports[pair[0]!]!.cuts[cut]!.volume).toBeCloseTo(
            reports[pair[1]!]!.cuts[cut]!.volume,
            7,
          )
        }
      }
      // Enlarging the centered bore reaches the same final solid from either source.
      expect(reports[0]!.cuts[0]!.volume).toBeCloseTo(
        reports[2]!.cuts[0]!.volume,
        7,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 150_000)
}

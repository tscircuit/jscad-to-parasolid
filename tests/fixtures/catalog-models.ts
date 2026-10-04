export interface CatalogModelFixture {
  /** Stable artifact and snapshot filename. */
  name: string
  modelString: string
  expectedBodies: number
  /** Features that should remain visible in the two opposite preview views. */
  inspect: string
}

/**
 * Representative catalog geometry, using explicit subdivision counts for gears
 * so the native reader and software renderer stay practical in CI.
 */
export const catalogModels = [
  {
    name: "catalog-spur-gear",
    modelString:
      "spurgear16_m1mm_w4mm_bore4mm_hubdiameter8mm_hublength2mm_segments4",
    expectedBodies: 1,
    inspect:
      "Sixteen involute teeth, a central through bore, and a raised hub.",
  },
  {
    name: "catalog-helical-gear",
    modelString:
      "helicalgear16_m1mm_w6mm_ha25deg_right_bore4mm_segments4_turnsegments12",
    expectedBodies: 1,
    inspect:
      "Sixteen right-hand twisted teeth and an uninterrupted central bore.",
  },
  {
    name: "catalog-worm-gear",
    modelString:
      "wormgear_m1mm_d8mm_l8mm_starts2_left_bore3mm_segments24_turnsegments12",
    expectedBodies: 1,
    inspect: "Two left-hand thread starts, flat end cuts, and the axial bore.",
  },
  {
    name: "catalog-nema17",
    modelString: "nema17",
    expectedBodies: 16,
    inspect:
      "Square motor case, end caps, mounting holes, boss, shaft, and side connector.",
  },
  {
    name: "catalog-hex-socket-bolt",
    modelString: "hexsocketbolt_m3_l6mm_nothreads",
    expectedBodies: 1,
    inspect:
      "Recessed hexagonal socket, cylindrical head, and smooth M3 shank.",
  },
  {
    name: "catalog-sheetmetal-plate-hole",
    modelString: "sheetmetal_plate_w20_l16_t1_hole1(d4_bottomface)",
    expectedBodies: 1,
    inspect: "Thin rectangular plate with a circular through hole.",
  },
  {
    name: "catalog-sheetmetal-angle-slot",
    modelString: "sheetmetal_angle_w20_l16_h12_t1_r2_slot1(l8_w3_bottomface)",
    expectedBodies: 1,
    inspect: "Bent angle, continuous bend radius, and rounded through slot.",
  },
  {
    name: "catalog-0402",
    modelString: "0402",
    expectedBodies: 3,
    inspect: "Tiny chip body and two separate end terminations, fully framed.",
  },
  {
    name: "catalog-sot223",
    modelString: "sot223",
    expectedBodies: 5,
    inspect: "Molded package, three leads, and the wider rear mounting tab.",
  },
  {
    name: "catalog-dfn8",
    modelString: "dfn8",
    expectedBodies: 9,
    inspect: "Low-profile case and eight separate pads visible from below.",
  },
] as const satisfies readonly CatalogModelFixture[]

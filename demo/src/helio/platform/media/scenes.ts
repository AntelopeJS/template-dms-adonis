import { createRng, type Rng } from "../../shared/seed";
import { drawHouse } from "./house";
import { encodePng } from "./png";
import {
  type Box,
  hex,
  mix,
  type Point,
  type Quad,
  Raster,
  type Rgb,
  subQuad,
} from "./raster";
import {
  drawArray,
  drawLandscape,
  drawShrubs,
  drawSky,
  drawTree,
  PHOTO_HEIGHT,
  PHOTO_WIDTH,
  vertical,
} from "./scenery";

/**
 * The site photos of the media library, drawn rather than downloaded: a house
 * before, during and after its works, a commercial flat roof, rows of panels,
 * a wallbox and a technical room with the inverter and the battery.
 */
export type PhotoKind =
  | "house-before"
  | "house-during"
  | "house-after"
  | "flat-roof"
  | "panel-rows"
  | "wallbox"
  | "technical-room";

const ROOF_TOP: Quad = [
  [260, 220],
  [840, 220],
  [720, 330],
  [140, 330],
];

/** Rows of tilted modules on a flat roof, each with its shadow. */
function drawTiltedRows(r: Raster, roof: Quad, rows: number, cols: number) {
  for (let row = 0; row < rows; row++) {
    const v0 = 0.08 + (row / rows) * 0.86;
    const v1 = v0 + (0.86 / rows) * 0.55;
    r.quad(
      subQuad(roof, 0.05, v1, 0.95, v1 + (v1 - v0) * 0.35),
      hex("#6d7178"),
      0.6,
    );
    drawArray(r, subQuad(roof, 0.05, v0, 0.95, v1), cols, 1);
  }
}

function drawFlatRoof(r: Raster, rng: Rng): void {
  drawSky(r, rng, 300);
  drawLandscape(r, rng, 300);
  r.rect(
    [0, 470, PHOTO_WIDTH, 170],
    vertical(hex("#8d9096"), hex("#6b6e73"), 470, 640),
  );
  for (let x = 40; x < PHOTO_WIDTH; x += 90)
    r.rect([x, 560, 6, 70], hex("#e8e8e8"));
  const cladding = hex(rng.pick(["#c7ccd1", "#b9c2c9", "#d4d0c8"]));
  r.rect([140, 330, 580, 180], cladding);
  for (let x = 146; x < 720; x += 12)
    r.rect([x, 330, 2, 180], mix(cladding, hex("#000000"), 0.12));
  r.polygon(
    [
      [720, 330],
      [840, 220],
      [840, 400],
      [720, 510],
    ],
    mix(cladding, hex("#000000"), 0.2),
  );
  r.rect([140, 344, 580, 16], hex("#ea580c"));
  for (const x of [200, 330, 460]) {
    r.rect([x, 400, 100, 110], hex("#7c8389"));
    for (let y = 408; y < 510; y += 10) r.rect([x, y, 100, 2], hex("#5f666c"));
  }
  r.quad(ROOF_TOP, hex("#9a9ea4"));
  r.quad(subQuad(ROOF_TOP, 0, 0, 1, 0.03), hex("#c3c6ca"));
  drawTiltedRows(r, ROOF_TOP, rng.int(6, 8), rng.int(16, 22));
  drawShrubs(r, rng, 515, 60, 140);
  drawTree(r, 60, 520, 150);
}

function drawPanelRows(r: Raster, rng: Rng): void {
  drawSky(r, rng, 150);
  const roof: Quad = [
    [-120, 130],
    [1080, 130],
    [1260, 640],
    [-300, 640],
  ];
  r.quad(roof, vertical(hex("#a9adb2"), hex("#8b8f95"), 130, 640));
  drawTiltedRows(r, roof, 5, 14);
  r.rect([0, 126, PHOTO_WIDTH, 6], hex("#c3c6ca"));
}

function brickWall(r: Raster, rng: Rng): void {
  const brick = hex(rng.pick(["#9c4f3a", "#a85e43", "#8a4a38"]));
  r.rect([0, 0, PHOTO_WIDTH, 520], hex("#cfc6b8"));
  for (let row = 0; row * 24 < 520; row++) {
    const offset = row % 2 ? 0 : -34;
    for (let x = offset; x < PHOTO_WIDTH; x += 68) {
      const tone = mix(brick, hex("#000000"), rng.next() * 0.18);
      r.rect([x + 2, row * 24 + 2, 64, 20], tone);
    }
  }
}

function roundedBox(r: Raster, [x, y, w, h]: Box, paint: Rgb) {
  const radius = Math.min(w, h) * 0.12;
  r.rect([x + radius, y, w - radius * 2, h], paint);
  r.rect([x, y + radius, w, h - radius * 2], paint);
  for (const [cx, cy] of [
    [x + radius, y + radius],
    [x + w - radius, y + radius],
    [x + radius, y + h - radius],
    [x + w - radius, y + h - radius],
  ] as const) {
    r.ellipse([cx, cy, radius, radius], paint);
  }
}

/** A cable hanging between two points, as a quadratic curve through `control`. */
function drawCurve(
  r: Raster,
  [from, control, to]: readonly [Point, Point, Point],
  width: number,
  paint: Rgb,
) {
  const steps = 16;
  let previous = from;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const k = 1 - t;
    const next: Point = [
      k * k * from[0] + 2 * k * t * control[0] + t * t * to[0],
      k * k * from[1] + 2 * k * t * control[1] + t * t * to[1],
    ];
    r.line(previous, next, width, paint);
    r.ellipse([next[0], next[1], width / 2, width / 2], paint);
    previous = next;
  }
}

function drawCar(r: Raster, color: Rgb): void {
  r.polygon(
    [
      [-40, 470],
      [60, 455],
      [150, 400],
      [270, 395],
      [330, 455],
      [360, 470],
      [365, 560],
      [-40, 565],
    ],
    color,
  );
  r.polygon(
    [
      [90, 455],
      [160, 410],
      [255, 408],
      [300, 455],
    ],
    hex("#2c3640"),
  );
  r.ring(250, 565, 52, 26, hex("#1f1f1f"));
  r.ellipse([250, 565, 26, 26], hex("#a7adb3"));
  r.rect([320, 490, 40, 16], hex("#f2f2f2"));
}

/** A wallbox on a brick wall with its charging cable coiled on a hook beside the box, and a car in front of it. */
function drawWallbox(r: Raster, rng: Rng): void {
  brickWall(r, rng);
  r.rect(
    [0, 520, PHOTO_WIDTH, 120],
    vertical(hex("#a3a29e"), hex("#7c7b77"), 520, 640),
  );
  for (let x = 0; x < PHOTO_WIDTH; x += 80)
    r.rect([x, 520, 2, 120], hex("#6a6965"));
  r.rect([462, 0, 16, 160], hex("#d9d9d9"));
  roundedBox(r, [390, 150, 170, 250], hex("#f4f4f4"));
  roundedBox(r, [408, 170, 134, 150], hex("#262b31"));
  r.ring(475, 245, 30, 24, hex("#34d399"));
  r.rect([408, 340, 134, 8], hex("#ea580c"));
  r.rect([600, 250, 12, 30], hex("#3a3a3a"));
  for (const radius of [74, 66, 58])
    r.ring(640, 330, radius, radius - 6, hex("#1d1d1d"));
  drawCurve(
    r,
    [
      [475, 398],
      [500, 520],
      [610, 392],
    ],
    12,
    hex("#1d1d1d"),
  );
  drawCar(r, hex(rng.pick(["#1e3a5f", "#7f1d1d", "#e5e7eb", "#374151"])));
}

/**
 * A technical room with a hybrid inverter (its display and cooling fins), a
 * battery tower of two or three modules, and a distribution board with its DC
 * isolator.
 */
function drawTechnicalRoom(r: Raster, rng: Rng): void {
  r.rect(
    [0, 0, PHOTO_WIDTH, 500],
    vertical(hex("#e9e7e2"), hex("#d3d0c9"), 0, 500),
  );
  r.rect(
    [0, 500, PHOTO_WIDTH, 140],
    vertical(hex("#a8a6a0"), hex("#8a8882"), 500, 640),
  );
  r.rect([242, 0, 16, 170], hex("#bdbdbd"));
  r.rect([782, 0, 16, 170], hex("#bdbdbd"));
  r.ellipse([250, 505, 120, 14], hex("#000000"), 0.12);
  r.ellipse([520, 505, 120, 14], hex("#000000"), 0.12);
  roundedBox(r, [160, 160, 180, 250], hex("#f7f7f7"));
  r.rect([200, 200, 100, 46], hex("#1f2937"));
  r.rect([212, 214, 60, 6], hex("#34d399"));
  r.ellipse([250, 280, 7, 7], hex("#22c55e"));
  for (let y = 300; y < 395; y += 12) r.rect([180, y, 140, 4], hex("#e1e1e1"));
  const modules = rng.int(2, 3);
  const top = 500 - modules * 105;
  for (let m = 0; m < modules; m++) {
    roundedBox(r, [440, top + m * 105, 160, 100], hex("#fafafa"));
  }
  r.rect([512, 0, 16, top], hex("#bdbdbd"));
  r.rect([440, top - 6, 160, 10], hex("#ea580c"));
  for (let i = 0; i < 5; i++)
    r.rect(
      [470 + i * 22, top + 20, 16, 6],
      i < 4 ? hex("#22c55e") : hex("#d1d5db"),
    );
  r.rect([690, 170, 200, 230], hex("#cfd3d6"));
  r.rect([700, 180, 180, 210], hex("#e4e7ea"));
  r.rect([860, 270, 8, 40], hex("#6b7280"));
  r.rect([720, 410, 60, 60], hex("#facc15"));
  r.rect([738, 428, 24, 24], hex("#dc2626"));
}

const PAINTERS: Record<PhotoKind, (r: Raster, rng: Rng) => void> = {
  "house-before": (r, rng) => drawHouse(r, rng, "before"),
  "house-during": (r, rng) => drawHouse(r, rng, "during"),
  "house-after": (r, rng) => drawHouse(r, rng, "after"),
  "flat-roof": drawFlatRoof,
  "panel-rows": drawPanelRows,
  wallbox: drawWallbox,
  "technical-room": drawTechnicalRoom,
};

/**
 * One site photo as PNG bytes. The same seed draws the same scene: the
 * three stages of one house share their seed so they show the same house.
 */
export function renderPhoto(kind: PhotoKind, seed: number): Buffer {
  const raster = new Raster(PHOTO_WIDTH, PHOTO_HEIGHT);
  PAINTERS[kind](raster, createRng(seed));
  return encodePng(PHOTO_WIDTH, PHOTO_HEIGHT, raster.toRgb());
}

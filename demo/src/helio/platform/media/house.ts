import type { Rng } from "../../shared/seed";
import { hex, mix, type Quad, type Raster, type Rgb, subQuad } from "./raster";
import {
  drawArray,
  drawLandscape,
  drawRails,
  drawShrubs,
  drawSky,
  drawTree,
  drawWindow,
  PHOTO_WIDTH,
  vertical,
} from "./scenery";

export type HouseStage = "before" | "during" | "after";

interface HouseStyle {
  wall: Rgb;
  side: Rgb;
  roof: Rgb;
  isBrick: boolean;
  cols: number;
  rows: number;
}

const WALLS: ReadonlyArray<readonly [string, boolean]> = [
  ["#a0523d", true],
  ["#b5654a", true],
  ["#ece6da", false],
  ["#d9d4cb", false],
];
const ROOFS = ["#3d3f44", "#7a3b2e", "#4a4e57", "#5c3a2e"];

const HORIZON = 360;
const FRONT = { left: 210, right: 690, top: 340, bottom: 530 };
const SIDE_DEPTH = 130;
const SIDE_RISE = 40;
const ROOF: Quad = [
  [240, 190],
  [757, 188],
  [706, 354],
  [186, 354],
];
const ARRAY_AREA = subQuad(ROOF, 0.07, 0.1, 0.9, 0.86);

function houseStyle(rng: Rng): HouseStyle {
  const [wall, isBrick] = rng.pick(WALLS);
  const wallRgb = hex(wall);
  return {
    wall: wallRgb,
    side: mix(wallRgb, hex("#000000"), 0.22),
    roof: hex(rng.pick(ROOFS)),
    isBrick,
    cols: rng.int(7, 10),
    rows: rng.int(2, 3),
  };
}

function drawBricks(r: Raster, style: HouseStyle): void {
  if (!style.isBrick) return;
  const mortar = mix(style.wall, hex("#ffffff"), 0.25);
  for (let y = FRONT.top + 8; y < FRONT.bottom; y += 12) {
    r.rect([FRONT.left, y, FRONT.right - FRONT.left, 1.5], mortar, 0.6);
  }
}

function drawWalls(r: Raster, style: HouseStyle): void {
  const { left, right, top, bottom } = FRONT;
  r.rect([left, top, right - left, bottom - top], style.wall);
  drawBricks(r, style);
  r.polygon(
    [
      [right, top],
      [right + SIDE_DEPTH, top - SIDE_RISE],
      [right + SIDE_DEPTH, bottom - SIDE_RISE],
      [right, bottom],
    ],
    style.side,
  );
  r.polygon(
    [
      [right, top],
      [right + SIDE_DEPTH, top - SIDE_RISE],
      [right + SIDE_DEPTH / 2, 186],
    ],
    mix(style.side, hex("#000000"), 0.08),
  );
  r.polygon(
    [
      [right + 45, top + 30],
      [right + 85, top + 18],
      [right + 85, top + 78],
      [right + 45, top + 90],
    ],
    hex("#4b6070"),
  );
  for (const x of [250, 360, 540, 610]) drawWindow(r, x, 375, 52, 70);
  r.rect([448, 420, 58, 110], hex("#2f3b45"));
  r.rect([452, 424, 50, 50], hex("#56707f"));
  r.rect(
    [left, bottom - 14, right - left, 14],
    mix(style.wall, hex("#000000"), 0.35),
  );
}

function drawRoof(r: Raster, style: HouseStyle): void {
  const [tl, tr, br, bl] = ROOF;
  r.quad(ROOF, (_x, y) =>
    mix(
      mix(style.roof, hex("#ffffff"), 0.1),
      style.roof,
      (y - tl[1]) / (bl[1] - tl[1]),
    ),
  );
  for (let v = 0.06; v < 1; v += 0.06) {
    r.quad(
      subQuad(ROOF, 0, v, 1, v + 0.006),
      mix(style.roof, hex("#000000"), 0.3),
      0.5,
    );
  }
  r.line(tl, tr, 6, mix(style.roof, hex("#000000"), 0.35));
  r.quad(
    [
      [bl[0] - 4, bl[1]],
      [br[0] + 4, br[1]],
      [br[0] + 4, br[1] + 10],
      [bl[0] - 4, bl[1] + 10],
    ],
    hex("#ece9e2"),
  );
  r.rect([320, 150, 42, 78], mix(style.wall, hex("#000000"), 0.1));
  r.rect([314, 146, 54, 10], hex("#5b5b5b"));
}

function drawScaffolding(r: Raster): void {
  const pole = hex("#9aa1a9");
  for (const x of [196, 330, 464, 598, 704]) {
    r.rect([x, 350, 6, 200], pole);
  }
  for (const y of [362, 452, 540]) {
    r.rect([190, y, 522, 8], hex("#c9853a"));
    r.rect([190, y + 8, 522, 3], hex("#7d5427"));
  }
  r.line([150, 560], [214, 330], 6, hex("#c7ccd2"));
  r.line([178, 566], [242, 336], 6, hex("#c7ccd2"));
  for (let t = 0.1; t < 1; t += 0.1) {
    r.line(
      [150 + 64 * t, 560 - 230 * t],
      [178 + 64 * t, 566 - 230 * t],
      4,
      hex("#c7ccd2"),
    );
  }
}

function drawStreetSide(r: Raster, rng: Rng): void {
  r.polygon(
    [
      [460, 530],
      [500, 530],
      [560, 640],
      [400, 640],
    ],
    hex("#b9b3a7"),
  );
  drawShrubs(r, rng, 538, 220, 430);
  drawShrubs(r, rng, 538, 540, 690);
  drawTree(r, 110, 560, rng.int(150, 190));
  if (rng.chance(0.5)) drawTree(r, 890, 540, rng.int(110, 140));
}

/**
 * A Walloon house seen from the street, its south roof facing the camera, at
 * one stage of its solar works: before them, during them (scaffolding, rails,
 * first modules) or once the array is installed.
 */
export function drawHouse(r: Raster, rng: Rng, stage: HouseStage): void {
  const style = houseStyle(rng);
  drawSky(r, rng, HORIZON);
  drawLandscape(r, rng, HORIZON);
  r.rect(
    [0, 600, PHOTO_WIDTH, 40],
    vertical(hex("#8c8c8c"), hex("#6d6d6d"), 600, 640),
  );
  drawWalls(r, style);
  drawRoof(r, style);
  if (stage === "during") {
    drawRails(r, ARRAY_AREA, style.rows);
    drawArray(
      r,
      ARRAY_AREA,
      style.cols,
      style.rows,
      Math.ceil(style.cols * 0.6),
    );
    drawScaffolding(r);
  }
  if (stage === "after") drawArray(r, ARRAY_AREA, style.cols, style.rows);
  drawStreetSide(r, rng);
}

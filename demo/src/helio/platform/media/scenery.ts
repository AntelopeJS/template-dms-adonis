import type { Rng } from "../../shared/seed";
import {
  hex,
  mix,
  type Point,
  type Quad,
  type Raster,
  type Rgb,
  subQuad,
} from "./raster";

/**
 * The width in pixels of the generated site photos, which share the sky,
 * landscape, trees and solar arrays drawn in this module. Every random choice
 * comes from the photo's seeded generator, so a photo is identical on every
 * boot.
 */
export const PHOTO_WIDTH = 960;
export const PHOTO_HEIGHT = 640;

const SKIES: ReadonlyArray<readonly [Rgb, Rgb]> = [
  [hex("#5b9bd5"), hex("#d6e8f5")],
  [hex("#7aa7cf"), hex("#e8eef2")],
  [hex("#8fa9bf"), hex("#dfe3e6")],
  [hex("#4f8fd0"), hex("#cfe4f6")],
];

const PANEL_DARK = hex("#16213e");
const PANEL_LIGHT = hex("#3b5b8c");
const PANEL_FRAME = hex("#c9ced6");
const LEAF = hex("#4c7a3d");
const LEAF_DARK = hex("#335a2a");

/** A vertical gradient paint between two y coordinates. */
export function vertical(top: Rgb, bottom: Rgb, y0: number, y1: number) {
  return (_x: number, y: number): Rgb => mix(top, bottom, (y - y0) / (y1 - y0));
}

export function drawSky(r: Raster, rng: Rng, horizon: number): void {
  const [top, bottom] = rng.pick(SKIES);
  r.rect([0, 0, PHOTO_WIDTH, horizon + 40], vertical(top, bottom, 0, horizon));
  const sunX = rng.int(80, 880);
  for (let i = 5; i >= 1; i--) {
    r.ellipse([sunX, 70, 30 + i * 22, 30 + i * 22], hex("#fff6d8"), 0.08);
  }
  r.ellipse([sunX, 70, 30, 30], hex("#fffbea"));
  for (let c = 0; c < rng.int(2, 4); c++) {
    const cx = rng.int(60, 900);
    const cy = rng.int(50, Math.max(horizon - 160, 60));
    for (let p = 0; p < 4; p++) {
      r.ellipse(
        [cx + p * 34 - 50, cy + (p % 2) * 8, 46, 22],
        hex("#ffffff"),
        0.75,
      );
    }
  }
}

/** Distant hills of the Meuse valley, then the lawn up to the bottom edge. */
export function drawLandscape(r: Raster, rng: Rng, horizon: number): void {
  const far: Point[] = [[0, PHOTO_HEIGHT]];
  for (let x = 0; x <= PHOTO_WIDTH; x += 40) {
    far.push([x, horizon - 30 - Math.sin(x / 140 + rng.next()) * 22]);
  }
  far.push([PHOTO_WIDTH, PHOTO_HEIGHT]);
  r.polygon(far, hex("#8aa58f"));
  const near: Point[] = [[0, PHOTO_HEIGHT]];
  for (let x = 0; x <= PHOTO_WIDTH; x += 40) {
    near.push([x, horizon - Math.sin(x / 90 + rng.next()) * 10]);
  }
  near.push([PHOTO_WIDTH, PHOTO_HEIGHT]);
  r.polygon(near, hex("#6f9a5a"));
  r.rect(
    [0, horizon, PHOTO_WIDTH, PHOTO_HEIGHT - horizon],
    vertical(hex("#7fae5f"), hex("#5d8c43"), horizon, PHOTO_HEIGHT),
  );
}

export function drawTree(r: Raster, x: number, base: number, size: number) {
  r.rect(
    [x - size * 0.08, base - size * 0.9, size * 0.16, size * 0.9],
    hex("#5b4636"),
  );
  r.ellipse([x, base - size * 1.25, size * 0.62, size * 0.55], LEAF_DARK);
  r.ellipse(
    [x - size * 0.25, base - size * 1.05, size * 0.45, size * 0.4],
    LEAF,
  );
  r.ellipse(
    [x + size * 0.28, base - size * 1.1, size * 0.42, size * 0.38],
    LEAF,
  );
  r.ellipse([x, base - size * 1.5, size * 0.4, size * 0.35], LEAF);
}

export function drawShrubs(
  r: Raster,
  rng: Rng,
  y: number,
  x0: number,
  x1: number,
) {
  for (let x = x0; x < x1; x += rng.int(28, 46)) {
    r.ellipse(
      [x, y, rng.int(22, 34), rng.int(14, 20)],
      rng.chance(0.5) ? LEAF : LEAF_DARK,
    );
  }
}

function moduleQuad(
  area: Quad,
  col: number,
  row: number,
  cols: number,
  rows: number,
) {
  const gap = 0.012;
  return subQuad(
    area,
    col / cols + gap / 2,
    row / rows + gap,
    (col + 1) / cols - gap / 2,
    (row + 1) / rows - gap,
  );
}

/** Solar modules laid over a roof area; `placed` limits how many are fitted yet. */
export function drawArray(
  r: Raster,
  area: Quad,
  cols: number,
  rows: number,
  placed = cols * rows,
): void {
  const [tl, , , bl] = area;
  const y0 = tl[1];
  const y1 = bl[1];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row * cols + col >= placed) return;
      const module = moduleQuad(area, col, row, cols, rows);
      r.quad(module, PANEL_FRAME);
      const glass = subQuad(module, 0.04, 0.05, 0.96, 0.95);
      r.quad(glass, (x, y) =>
        mix(
          PANEL_LIGHT,
          PANEL_DARK,
          ((y - y0) / (y1 - y0 || 1)) * 0.85 + Math.sin(x / 45) * 0.08,
        ),
      );
      const mid = subQuad(glass, 0, 0.49, 1, 0.51);
      r.quad(mid, hex("#5a74a0"), 0.5);
    }
  }
}

/** Mounting rails across an area, before (or while) the modules go on. */
export function drawRails(r: Raster, area: Quad, rows: number): void {
  for (let row = 0; row < rows; row++) {
    for (const v of [0.25, 0.75]) {
      const at = (row + v) / rows;
      r.quad(subQuad(area, 0, at - 0.008, 1, at + 0.008), hex("#b8bec7"));
    }
  }
}

/** A window with its frame, glass reflection and glazing bars. */
export function drawWindow(
  r: Raster,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  r.rect([x - 4, y - 4, w + 8, h + 8], hex("#f4f4f2"));
  r.rect([x, y, w, h], vertical(hex("#9fb8cc"), hex("#3e5568"), y, y + h));
  r.polygon(
    [
      [x, y + h * 0.6],
      [x + w * 0.5, y],
      [x + w * 0.75, y],
      [x, y + h],
    ],
    hex("#ffffff"),
    0.15,
  );
  r.rect([x + w / 2 - 2, y, 4, h], hex("#f4f4f2"));
  r.rect([x, y + h / 2 - 2, w, 4], hex("#f4f4f2"));
}

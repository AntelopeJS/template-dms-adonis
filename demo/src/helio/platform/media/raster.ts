export type Rgb = readonly [number, number, number];
export type Point = readonly [number, number];
/** A colour, or one computed from the output coordinates (gradients). */
export type Paint = Rgb | ((x: number, y: number) => Rgb);

/** Whether `paint` is a solid colour rather than a gradient function. */
function isSolid(paint: Paint): paint is Rgb {
  return typeof paint !== "function";
}
/** Corners of a quadrilateral: top-left, top-right, bottom-right, bottom-left. */
export type Quad = readonly [Point, Point, Point, Point];
/** An axis-aligned box: left, top, width, height. */
export type Box = readonly [number, number, number, number];

const SUPERSAMPLING = 2;
const CIRCLE_SEGMENTS = 48;

interface Edge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function contourEdges(contour: readonly Point[], scale: number): Edge[] {
  const edges: Edge[] = [];
  contour.forEach(([x0, y0], index) => {
    const [x1, y1] = contour[(index + 1) % contour.length] ?? [x0, y0];
    if (y0 !== y1)
      edges.push({
        x0: x0 * scale,
        y0: y0 * scale,
        x1: x1 * scale,
        y1: y1 * scale,
      });
  });
  return edges;
}

function crossings(edges: readonly Edge[], y: number): number[] {
  const xs: number[] = [];
  for (const edge of edges) {
    const isInside =
      (edge.y0 <= y && edge.y1 > y) || (edge.y1 <= y && edge.y0 > y);
    if (isInside)
      xs.push(
        edge.x0 + ((y - edge.y0) * (edge.x1 - edge.x0)) / (edge.y1 - edge.y0),
      );
  }
  return xs.sort((a, b) => a - b);
}

/** Linear blend of two colours, `t` from 0 (a) to 1 (b). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(Math.max(t, 0), 1);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

/** `#rrggbb` as a colour. */
export function hex(value: string): Rgb {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** A point of a quad, `u` across and `v` down, both 0-1 (bilinear). */
export function quadPoint(quad: Quad, u: number, v: number): Point {
  const [tl, tr, br, bl] = quad;
  const top: Point = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u];
  const bottom: Point = [
    bl[0] + (br[0] - bl[0]) * u,
    bl[1] + (br[1] - bl[1]) * u,
  ];
  return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
}

/** The part of a quad between `u0..u1` across and `v0..v1` down. */
export function subQuad(
  quad: Quad,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): Quad {
  return [
    quadPoint(quad, u0, v0),
    quadPoint(quad, u1, v0),
    quadPoint(quad, u1, v1),
    quadPoint(quad, u0, v1),
  ];
}

/**
 * A tiny software rasterizer for the generated site photos: filled polygons
 * (even-odd, so a ring is two contours), solid or computed paint, alpha
 * blending, and 2× supersampling so edges come out smooth.
 */
export class Raster {
  private readonly pixels: Float32Array;
  private readonly innerWidth: number;
  private readonly innerHeight: number;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.innerWidth = width * SUPERSAMPLING;
    this.innerHeight = height * SUPERSAMPLING;
    this.pixels = new Float32Array(this.innerWidth * this.innerHeight * 3);
  }

  /** Fills the contours with the even-odd rule. */
  fill(contours: ReadonlyArray<readonly Point[]>, paint: Paint, alpha = 1) {
    const edges = contours.flatMap((c) => contourEdges(c, SUPERSAMPLING));
    if (edges.length === 0) return;
    const ys = edges.flatMap((e) => [e.y0, e.y1]);
    const top = Math.max(Math.floor(Math.min(...ys)), 0);
    const bottom = Math.min(Math.ceil(Math.max(...ys)), this.innerHeight - 1);
    for (let y = top; y <= bottom; y++) {
      const xs = crossings(edges, y + 0.5);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.span(y, xs[i] ?? 0, xs[i + 1] ?? 0, paint, alpha);
      }
    }
  }

  polygon(points: readonly Point[], paint: Paint, alpha = 1): void {
    this.fill([points], paint, alpha);
  }

  quad(quad: Quad, paint: Paint, alpha = 1): void {
    this.fill([quad], paint, alpha);
  }

  rect([x, y, w, h]: Box, paint: Paint, alpha = 1): void {
    this.fill(
      [
        [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ],
      ],
      paint,
      alpha,
    );
  }

  /** An ellipse given as centre and radii: `[cx, cy, rx, ry]`. */
  ellipse([cx, cy, rx, ry]: Box, paint: Paint, alpha = 1): void {
    this.fill([ellipsePoints(cx, cy, rx, ry)], paint, alpha);
  }

  /** A ring between two radii (a tyre, a coiled cable). */
  ring(cx: number, cy: number, outer: number, inner: number, paint: Paint) {
    this.fill(
      [
        ellipsePoints(cx, cy, outer, outer),
        ellipsePoints(cx, cy, inner, inner),
      ],
      paint,
    );
  }

  /** A straight stroke of the given width. */
  line(a: Point, b: Point, width: number, paint: Paint, alpha = 1): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * (width / 2);
    const ny = (dx / length) * (width / 2);
    this.polygon(
      [
        [a[0] + nx, a[1] + ny],
        [b[0] + nx, b[1] + ny],
        [b[0] - nx, b[1] - ny],
        [a[0] - nx, a[1] - ny],
      ],
      paint,
      alpha,
    );
  }

  /** The image at its output size, box-filtered down from the supersampled one. */
  toRgb(): Uint8Array {
    const out = new Uint8Array(this.width * this.height * 3);
    const samples = SUPERSAMPLING * SUPERSAMPLING;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        for (let c = 0; c < 3; c++) {
          out[(y * this.width + x) * 3 + c] = Math.round(
            this.sampleSum(x, y, c) / samples,
          );
        }
      }
    }
    return out;
  }

  /** Sum of one channel over the supersampled pixels of an output pixel. */
  private sampleSum(x: number, y: number, channel: number): number {
    let sum = 0;
    for (let sy = 0; sy < SUPERSAMPLING; sy++) {
      const row = (y * SUPERSAMPLING + sy) * this.innerWidth;
      for (let sx = 0; sx < SUPERSAMPLING; sx++) {
        sum += this.pixels[(row + x * SUPERSAMPLING + sx) * 3 + channel] ?? 0;
      }
    }
    return sum;
  }

  private span(y: number, x0: number, x1: number, paint: Paint, alpha: number) {
    const start = Math.max(Math.ceil(x0 - 0.5), 0);
    const end = Math.min(Math.floor(x1 - 0.5), this.innerWidth - 1);
    for (let x = start; x <= end; x++) {
      const color = isSolid(paint)
        ? paint
        : paint((x + 0.5) / SUPERSAMPLING, (y + 0.5) / SUPERSAMPLING);
      const at = (y * this.innerWidth + x) * 3;
      for (let c = 0; c < 3; c++) {
        const previous = this.pixels[at + c] ?? 0;
        this.pixels[at + c] = previous + ((color[c] ?? 0) - previous) * alpha;
      }
    }
  }
}

function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Point[] {
  return Array.from({ length: CIRCLE_SEGMENTS }, (_, i): Point => {
    const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
  });
}

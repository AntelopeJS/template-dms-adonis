import { deflateSync } from "node:zlib";

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 3;
const BIT_DEPTH = 8;
const COLOR_TYPE_RGB = 2;

/** The CRC-32 (ISO 3309) table, as the PNG chunks need it. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Buffer {
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const out = Buffer.alloc(typed.length + 8);
  out.writeUInt32BE(body.length, 0);
  typed.copy(out, 4);
  out.writeUInt32BE(crc32(typed), typed.length + 4);
  return out;
}

/**
 * Encodes `rgb` (width × height × 3 bytes, row by row) as a PNG file. This is
 * a minimal encoder (8-bit truecolour, no alpha, no filtering): enough to ship
 * the generated site photos as real raster images the media library can
 * resize, without adding an image dependency to the project. The compression,
 * filter and interlace method bytes of the header stay 0, the only defined
 * values, and each row starts with the filter type 0, which is none.
 */
export function encodePng(
  width: number,
  height: number,
  rgb: Uint8Array,
): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH;
  header[9] = COLOR_TYPE_RGB;
  const rowLength = width * BYTES_PER_PIXEL;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowLength + 1)] = 0;
    raw.set(
      rgb.subarray(y * rowLength, (y + 1) * rowLength),
      y * (rowLength + 1) + 1,
    );
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

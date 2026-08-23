// Rebuilds public/favicon.ico from the full-size mark: node scripts/build-ico.mjs [src.png] [out.ico]
// Reads blackbox/ and writes public/ - the one direction the public/private split allows.

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const SOURCE = process.argv[2] ?? "blackbox/working-materials/lanterncert-icon-fullsize.png";
const OUT = process.argv[3] ?? "public/favicon.ico";
const SIZES = [16, 32, 48, 64];

/** Halving while the next step still clears the target, then one final resize. A single big step
    aliases badly; repeated halving does not. */
function downscale(img, size) {
  let canvas = createCanvas(img.width, img.height);
  canvas.getContext("2d").drawImage(img, 0, 0);

  let width = img.width;
  while (Math.floor(width / 2) >= size) {
    width = Math.floor(width / 2);
    const next = createCanvas(width, width);
    const ctx = next.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, width, width);
    canvas = next;
  }

  const final = createCanvas(size, size);
  const ctx = final.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, size, size);
  return final.toBuffer("image/png");
}

// ICO container: a 6-byte header, one 16-byte directory entry per image, then the payloads. PNG
// payloads are stored whole; a 256px image would be declared as 0, which is why 64 is the ceiling.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, data }, i) => {
    const at = i * 16;
    directory.writeUInt8(size % 256, at);
    directory.writeUInt8(size % 256, at + 1);
    directory.writeUInt8(0, at + 2);
    directory.writeUInt8(0, at + 3);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

const img = await loadImage(SOURCE);
if (img.width !== img.height) {
  throw new Error(`source is ${img.width}x${img.height} - the mark must be square`);
}
if (img.width < Math.max(...SIZES)) {
  throw new Error(`source is ${img.width}px, under the largest size asked for - nothing gets upscaled`);
}

const images = SIZES.map((size) => ({ size, data: downscale(img, size) }));
writeFileSync(OUT, buildIco(images));

console.log(`build-ico: ${SOURCE} (${img.width}px) -> ${OUT}`);
for (const { size, data } of images) console.log(`  ${size}x${size}  ${data.length} bytes`);

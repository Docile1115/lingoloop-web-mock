// Shrinks the textures of a .vrm (GLB) in place without touching the glTF/VRM JSON structure,
// so every VRM extension (meta, humanoid, spring bones, MToon, blend shapes) survives untouched.
// Usage: node scripts/room3d/vrm-shrink.mjs <in.vrm> <out.vrm> [colorMax=512] [normalMax=256]
import fs from "node:fs";
import { createRequire } from "node:module";

// sharp ships with the API service; reuse it instead of adding a web dependency.
const sharp = createRequire(new URL("../../backend/package.json", import.meta.url))("sharp");

const [input, output, colorArg, normalArg] = process.argv.slice(2);
const COLOR_MAX = Number(colorArg || 512);
const NORMAL_MAX = Number(normalArg || 256);

async function main() {
  const data = fs.readFileSync(input);
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const bin = data.subarray(binStart, binStart + data.readUInt32LE(20 + jsonLength));

  const replaced = new Map(); // bufferView index -> { bytes, mimeType }
  const report = [];
  for (const image of json.images || []) {
    const view = json.bufferViews[image.bufferView];
    const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const meta = await sharp(bytes).metadata();
    const name = image.name || "";
    const limit = /thumbnail/i.test(name) ? 64 : /_nml|normal/i.test(name) ? NORMAL_MAX : /matcap|_spe|_out/i.test(name) ? 256 : COLOR_MAX;
    const scale = Math.min(1, limit / Math.max(meta.width, meta.height));
    const width = Math.max(1, Math.round(meta.width * scale)),
      height = Math.max(1, Math.round(meta.height * scale));
    let pipeline = sharp(bytes).resize(width, height, { fit: "fill" });
    // Keep PNG where alpha is actually used (hair cards, eyelashes); otherwise JPEG is far smaller.
    let opaque = !meta.hasAlpha;
    if (meta.hasAlpha) {
      const stats = await sharp(bytes).stats();
      opaque = stats.channels[3]?.min === 255;
    }
    const isNormal = /_nml|normal/i.test(name);
    let out, mimeType;
    if (opaque && !isNormal && width > 8) {
      out = await pipeline.removeAlpha().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      mimeType = "image/jpeg";
    } else {
      out = await pipeline.png({ compressionLevel: 9, palette: !isNormal && meta.hasAlpha ? false : false }).toBuffer();
      mimeType = "image/png";
    }
    if (out.length < bytes.length || scale < 1) {
      replaced.set(image.bufferView, { bytes: out });
      image.mimeType = mimeType;
      report.push(`${name}: ${meta.width}x${meta.height} ${(bytes.length / 1024).toFixed(0)}KB -> ${width}x${height} ${mimeType.slice(6)} ${(out.length / 1024).toFixed(0)}KB`);
    }
  }

  // Rebuild the binary chunk with every buffer view re-packed (4-byte aligned).
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((view, index) => {
    const bytes = replaced.get(index)?.bytes ?? bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    offset += pad;
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    parts.push(bytes);
    offset += bytes.length;
  });
  const newBin = Buffer.concat(parts);
  const binPad = (4 - (newBin.length % 4)) % 4;
  json.buffers[0].byteLength = newBin.length;
  let jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
  const total = 12 + 8 + jsonBytes.length + 8 + newBin.length + binPad;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(newBin.length + binPad, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(output, Buffer.concat([header, jsonHeader, jsonBytes, binHeader, newBin, Buffer.alloc(binPad)]));
  console.log(report.join("\n"));
  console.log(`size ${(data.length / 1048576).toFixed(2)}MB -> ${(total / 1048576).toFixed(2)}MB`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

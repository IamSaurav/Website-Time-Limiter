// Renders the extension's PNG icons from one SVG.
//   node build-icons.mjs            uses icon.svg
//   node build-icons.mjs icons/pie.svg
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const SIZES = [16, 32, 48, 128];
const source = process.argv[2] ?? 'icon.svg';
const svg = await readFile(source);

for (const size of SIZES) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`icon${size}.png`);
  console.log(`icon${size}.png from ${source}`);
}

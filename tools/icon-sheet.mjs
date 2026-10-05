// Renders every candidate in icons/ at the sizes Chrome actually draws, on both a
// light and a dark toolbar, because an icon that works at 128 can be mush at 16.
//   node tools/icon-sheet.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'screenshots', 'icon-options.png');

const ROW = 150;
const HEAD = 56;
const LIGHT = { x: 240, fill: '#f1f3f4', text: '#5d6670' };
const DARK = { x: 650, fill: '#35363a', text: '#9aa1a9' };
const STRIP = 390;
const WIDTH = DARK.x + STRIP + 24;

const names = (await readdir(path.join(ROOT, 'icons'))).filter((f) => f.endsWith('.svg')).sort();
const height = HEAD + names.length * ROW;

const labels = names
  .map((name, i) => {
    const y = HEAD + i * ROW;
    return `<text x="24" y="${y + 30}" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="15" font-weight="600" fill="#11161c">${path.basename(name, '.svg')}</text>
      <rect x="${LIGHT.x}" y="${y}" width="${STRIP}" height="${ROW - 16}" rx="12" fill="${LIGHT.fill}"/>
      <rect x="${DARK.x}" y="${y}" width="${STRIP}" height="${ROW - 16}" rx="12" fill="${DARK.fill}"/>`;
  })
  .join('\n');

const header = ['48', '32', '16', '16 at 4x']
  .map((text, i) => {
    const at = [60, 150, 230, 300];
    return `<text x="${LIGHT.x + at[i]}" y="40" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="12" fill="${LIGHT.text}">${text}</text>
      <text x="${DARK.x + at[i]}" y="40" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="12" fill="${LIGHT.text}">${text}</text>`;
  })
  .join('\n');

const base = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}">
    <rect width="${WIDTH}" height="${height}" fill="#ffffff"/>
    <text x="24" y="40" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="12" fill="${LIGHT.text}">name / 96</text>
    ${header}
    ${labels}
  </svg>`,
);

const layers = [];
for (const [i, name] of names.entries()) {
  const svg = await readFile(path.join(ROOT, 'icons', name));
  const render = (size) => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  const y = HEAD + i * ROW;
  const big = await render(96);
  const at48 = await render(48);
  const at32 = await render(32);
  const at16 = await render(16);
  const zoomed = await sharp(at16).resize(64, 64, { kernel: 'nearest' }).png().toBuffer();

  layers.push({ input: big, left: 120, top: y + 10 });
  for (const strip of [LIGHT, DARK]) {
    layers.push({ input: at48, left: strip.x + 50, top: y + 35 });
    layers.push({ input: at32, left: strip.x + 148, top: y + 43 });
    layers.push({ input: at16, left: strip.x + 232, top: y + 51 });
    layers.push({ input: zoomed, left: strip.x + 292, top: y + 27 });
  }
}

await sharp(base).composite(layers).png().toFile(OUT);
console.log(OUT);

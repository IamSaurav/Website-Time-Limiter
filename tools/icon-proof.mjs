// Shows the icon PNGs that actually ship, read back off disk rather than redrawn
// from the SVG, so what is checked is what Chrome loads.
//   node tools/icon-proof.mjs
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'screenshots', 'icon-shipped.png');

const WIDTH = 760;
const HEIGHT = 300;
const STRIP_X = 190;
const STRIP_W = WIDTH - STRIP_X - 20;
const STRIPS = [
  { y: 48, fill: '#f1f3f4', label: 'light toolbar', text: '#5d6670' },
  { y: 176, fill: '#35363a', label: 'dark toolbar', text: '#9aa1a9' },
];

const base = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
    <text x="20" y="28" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="13" font-weight="600" fill="#11161c">What ships, read back off disk: icon128, then 48 / 32 / 16 and 16 magnified</text>
    ${STRIPS.map(
      (strip) =>
        `<rect x="${STRIP_X}" y="${strip.y}" width="${STRIP_W}" height="104" rx="12" fill="${strip.fill}"/>
         <text x="${WIDTH - 36}" y="${strip.y + 94}" text-anchor="end" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="11" fill="${strip.text}">${strip.label}</text>`,
    ).join('\n')}
  </svg>`,
);

const layers = [{ input: path.join(ROOT, 'icon128.png'), left: 24, top: 86 }];
for (const strip of STRIPS) {
  let x = STRIP_X + 34;
  for (const size of [48, 32, 16]) {
    layers.push({ input: path.join(ROOT, `icon${size}.png`), left: x, top: strip.y + 52 - size / 2 });
    x += size + 46;
  }
  const zoomed = await sharp(path.join(ROOT, 'icon16.png'))
    .resize(64, 64, { kernel: 'nearest' })
    .png()
    .toBuffer();
  layers.push({ input: zoomed, left: x + 10, top: strip.y + 20 });
}

await sharp(base).composite(layers).png().toFile(OUT);
console.log(OUT);

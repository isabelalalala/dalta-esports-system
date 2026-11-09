// Builds the game logo variants in public/games from the wordmark files (run: node scripts/make-game-icons.mjs).
//   <id>-icon.webp       : square icon (256x256, transparent)
//   <id>-icon-light.webp : the same icon for light backgrounds, when the logo has white parts (Tekken 8)
//   <id>-light.webp      : wordmark for light backgrounds (white parts recolored to the brand ink),
//                          only for logos whose letters are white (Tekken 8, CODM)
//
// Icons (11.6): a piece of a word is never cut out. A game whose logo contains a complete standalone
// emblem uses that emblem (MLBB's M, Valorant's V, CODM's M badge); the others (Tekken 8, League of Legends)
// use their WHOLE wordmark, scaled down and centered in the square with padding. To use an official square
// emblem instead, replace public/games/<id>-icon.webp (and -icon-light.webp) and delete the entry below.
// Uses sharp (installed with Next.js). The crop boxes are in pixels of the source files; re-check them if
// a wordmark file is replaced.
import sharp from 'sharp';

const DIR = 'public/games';
const ICON = 256;
// Transparent padding around the artwork: ~10% per side (the component adds a little more)
const PAD = 26;
const EMBLEMS = {
  mlbb: { left: 0, top: 0, width: 258, height: 275 },       // the M emblem (left of the words)
  valorant: { left: 180, top: 0, width: 420, height: 335 }, // the V symbol (above the word)
  codm: { left: 786, top: 190, width: 124, height: 116 },   // the M badge (after MOBILE)
  tekken8: null,                                            // whole wordmark
  lol: null,                                                // whole wordmark (it has its own stone plate)
};
const INK = { r: 0x1a, g: 0x14, b: 0x12 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Near-white, low-saturation pixels become ink; colors (red 8, yellow badge) stay
async function darkLetters(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (max > 150 && max - min < 40) {
      data[i] = INK.r; data[i + 1] = INK.g; data[i + 2] = INK.b;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

// Trim empty edges, then center inside a transparent square with padding (never cropped: fit contain)
async function toIcon(input, out) {
  const trimmed = await sharp(input).trim({ threshold: 1 }).toBuffer();
  await sharp(trimmed)
    .resize(ICON - PAD * 2, ICON - PAD * 2, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(out);
  console.log(out);
}

// Light-background wordmarks
for (const id of ['tekken8', 'codm']) {
  await sharp(await darkLetters(`${DIR}/${id}.webp`)).webp({ quality: 92, alphaQuality: 100 }).toFile(`${DIR}/${id}-light.webp`);
  console.log(`${DIR}/${id}-light.webp`);
}

for (const [id, crop] of Object.entries(EMBLEMS)) {
  const src = crop
    ? await sharp(`${DIR}/${id}.webp`).extract(crop).png().toBuffer()
    : await sharp(`${DIR}/${id}.webp`).png().toBuffer();
  await toIcon(src, `${DIR}/${id}-icon.webp`);
}

// Tekken 8's whole wordmark is white: a dark-letter icon for light backgrounds
await toIcon(await darkLetters(`${DIR}/tekken8.webp`), `${DIR}/tekken8-icon-light.webp`);

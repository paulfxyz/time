import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('.github/img', {recursive:true});
const featured = ['matrix','cupertino','spectrum','outrun','nixie','observatory'];
const names = ['Matrix','Cupertino','Spectrum','Outrun','Nixie','Observatory'];
const width = 1500, height = 940, tiles = [];
const heading = `<svg width="${width}" height="185"><rect width="${width}" height="185" fill="#edf0f4"/>
<text x="48" y="55" fill="#66778b" font-family="sans-serif" font-size="16" letter-spacing="4">TIMESCREEN 2</text>
<text x="44" y="119" fill="#1e2b3d" font-family="sans-serif" font-size="52" font-weight="600">Make time look different.</text>
<text x="48" y="154" fill="#526276" font-family="sans-serif" font-size="19">Native for Mac. Open on the web. Yours to make your own.</text></svg>`;
tiles.push({input:Buffer.from(heading),left:0,top:0});
for (let i = 0; i < featured.length; i++) {
  const buffer = await sharp(`qa/screenshots/${featured[i]}-1440.png`).resize(456,285).png().toBuffer();
  const x = 48 + i % 3 * 474, y = 196 + Math.floor(i / 3) * 346;
  tiles.push({input:buffer,left:x,top:y});
  tiles.push({input:Buffer.from(`<svg width="456" height="36"><text x="0" y="25" fill="#35475d" font-family="sans-serif" font-size="17">${names[i]}</text></svg>`),left:x,top:y+285});
  await sharp(`qa/screenshots/${featured[i]}-1440.png`).resize(1200).webp({quality:88}).toFile(`.github/img/${featured[i]}.webp`);
}
tiles.push({input:Buffer.from(`<svg width="${width}" height="48"><text x="48" y="30" fill="#526276" font-family="sans-serif" font-size="17">28 compositions  /  60 paired palettes  /  One living planet</text></svg>`),left:0,top:height-58});
await sharp({create:{width,height,channels:4,background:'#edf0f4'}}).composite(tiles).webp({quality:90}).toFile('.github/img/showcase.webp');
await sharp('qa/desktop-contact-sheet.png').webp({quality:90}).toFile('.github/img/styles-contact-sheet.webp');
await sharp('qa/mobile-contact-sheet.png').webp({quality:88}).toFile('.github/img/styles-mobile.webp');
console.log('Showcase built from actual QA screenshots.');

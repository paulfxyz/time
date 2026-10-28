import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const favicon = await readFile(path.join(root, 'public/favicon.svg'));
for (const [name, size] of [['app-icon-192.png',192], ['app-icon-512.png',512], ['app-icon-maskable.png',512], ['app-icon-1024.png',1024]]) {
  const symbol = await sharp(favicon).resize(size, size).png().toBuffer();
  await sharp({ create: { width:size, height:size, channels:4, background:'#080d13' } })
    .composite([{ input:symbol }]).png().toFile(path.join(root, 'public/assets', name));
}
await build({
  entryPoints:[path.join(root, 'icons-source.js')],
  bundle:true, minify:true, format:'esm', outfile:path.join(root, 'public/icons.js'),
});
let commit = 'source-archive';
try { commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim(); } catch {}
await writeFile(path.join(root, 'public/release.json'), JSON.stringify({
  name:'Time', version:packageJson.version, commit, builtAt:new Date().toISOString(),
  repository:'https://github.com/paulfxyz/timescreen', scenes:28, palettes:60,
}, null, 2) + '\n');
console.log(`Timescreen ${packageJson.version}: static site ready in public/`);

// The embedded conversation preview deliberately lacks persistent storage and
// browser fullscreen. Do not change the production site or native bundle to
// accommodate those restrictions: build a clearly limited preview separately.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('../timescreen-preview');
await mkdir(target, {recursive:true});
await cp('public', target, {recursive:true});
const path = resolve(target, 'app.js');
let app = await readFile(path, 'utf8');
app = 'const previewMemory = new Map();\n' + app;
app = app.replaceAll("localStorage.getItem('timescreen:setup:v2')", "previewMemory.get('setup')")
  .replaceAll("localStorage.setItem('timescreen:setup:v2', serializeState())", "previewMemory.set('setup', serializeState())");
const start = app.indexOf('async function toggleFullscreen()');
const end = app.indexOf('function syncFullscreenControl()', start);
if (start < 0 || end < 0) throw new Error('Preview transform requires review after fullscreen changes.');
app = app.slice(0, start) + `
function nativeFullscreenElement() { return null; }
function isStandalone() { return false; }
async function toggleFullscreen() {
  fallbackFullscreen = !fallbackFullscreen;
  syncFullscreenControl();
  if (fallbackFullscreen) notice('Embedded preview: focus mode only. Use the live site or Mac app for real full screen.');
}
` + app.slice(end);
app = app.replace("'Exit full screen' : 'Enter full screen'", "'Exit focus view' : 'Enter focus view'");
await writeFile(path, app);
const htmlPath = resolve(target, 'index.html');
let html = await readFile(htmlPath, 'utf8');
html = html.replace('<title>Time', '<title>Timescreen preview');
html = html.replace('A native window, menu-bar access, remembered settings and a complete offline copy.',
  'This embedded preview uses temporary settings and focus mode. The live site and Mac app provide the full experience.');
await writeFile(htmlPath, html);
console.log(`Preview-only build: ${target}`);

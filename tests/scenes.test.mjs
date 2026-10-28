import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SCENES, SCENE_CATEGORIES, getScene, sceneMatches, sceneSettings } from '../public/scenes.js';
import { THEMES } from '../public/themes.js';

test('28 distinct scene designs with supported presets and compositions', () => {
  assert.equal(SCENES.length, 28);
  assert.equal(new Set(SCENES.map(s => s.id)).size, 28);
  assert.ok(new Set(SCENES.map(s => s.clock)).size >= 8);
  assert.ok(new Set(SCENES.map(s => s.composition)).size >= 4);
  assert.ok(new Set(SCENES.map(s => s.effect)).size >= 10);
  for (const scene of SCENES) {
    assert.ok(THEMES.some(t => t.id === scene.theme), scene.name);
    assert.ok(SCENE_CATEGORIES.includes(scene.category));
    assert.match(scene.id, /^[a-z0-9-]+$/);
    assert.ok(scene.description.length > 15);
    assert.ok(['dark','light'].includes(scene.mode));
    assert.equal(sceneSettings(scene.id).scene, scene.id);
  }
});
test('style search handles the requested inspirations and categories', () => {
  assert.ok(sceneMatches(getScene('matrix'), 'matrix'));
  assert.ok(sceneMatches(getScene('cupertino'), '  APPLE '));
  assert.ok(sceneMatches(getScene('spectrum'), 'Google'));
  assert.ok(sceneMatches(getScene('nixie'), 'amber', 'Retro'));
  assert.equal(sceneMatches(getScene('nixie'), 'amber', 'Minimal'), false);
  assert.equal(sceneMatches(getScene('nixie'), 'not-a-style'), false);
  assert.equal(getScene('unknown').id, 'observatory');
});
test('every style has a dedicated graphic treatment', () => {
  const css = readFileSync(new URL('../public/scenes.css', import.meta.url), 'utf8');
  for (const scene of SCENES.filter(s => s.id !== 'observatory')) {
    assert.ok(css.includes(`[data-scene="${scene.id}"]`), `${scene.name} needs a scene-specific treatment`);
  }
});
test('offline shell caches scene assets and font licenses are included', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  for (const file of ['scenes.css','scenes.js','ambient.js','assets/jetbrains-mono.ttf','assets/instrument-serif.ttf']) {
    assert.ok(sw.includes(`'./${file}'`));
    assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)));
  }
  for (const file of ['JetBrainsMono-OFL.txt','InstrumentSerif-OFL.txt']) {
    assert.match(readFileSync(new URL(`../public/assets/${file}`, import.meta.url),'utf8'), /SIL OPEN FONT LICENSE/);
  }
});
test('web and native releases declare the same version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const info = readFileSync(new URL('../macos/Resources/Info.plist', import.meta.url),'utf8');
  const native = readFileSync(new URL('../macos/Sources/NativePolicy.swift', import.meta.url),'utf8');
  const html = readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url),'utf8');
  assert.ok(info.includes(`<key>CFBundleShortVersionString</key><string>${pkg.version}</string>`));
  assert.ok(native.includes(`static let version = "${pkg.version}"`));
  assert.ok(html.includes(`name="timescreen-version" content="${pkg.version}"`));
  assert.ok(app.includes(`version:'${pkg.version}'`));
});
test('native bridges are opt-in and browser permissions remain available', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url),'utf8');
  assert.match(app, /window\.timescreenNative\?\.available/);
  assert.match(app, /if \(postNative\('fullscreen'\)\) return/);
  assert.match(app, /navigator\.wakeLock\?\.request/);
  assert.match(app, /!isNative && 'serviceWorker'/);
  const native = readFileSync(new URL('../macos/Sources/main.swift', import.meta.url),'utf8');
  assert.match(native, /message\.frameInfo\.isMainFrame/);
  assert.match(native, /NativePolicy\.trusted\(message\.frameInfo\.request\.url\)/);
});

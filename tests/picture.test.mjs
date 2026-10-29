import test from 'node:test';
import assert from 'node:assert/strict';
import { PICTURE_DEFAULTS, PICTURE_PRESETS, normalizePicture, pictureFilter, matchingPicturePreset } from '../public/picture.js';
import { readFileSync } from 'node:fs';

test('picture settings default safely and enforce recoverable brightness', () => {
  assert.deepEqual(normalizePicture(), PICTURE_DEFAULTS);
  assert.deepEqual(normalizePicture({brightness:-99, contrast:999, saturation:-1, temperature:500}),
    {brightness:15, contrast:140, saturation:0, temperature:50});
  assert.equal(normalizePicture({brightness:'NaN'}).brightness, 100);
  assert.equal(normalizePicture({brightness:Infinity}).brightness, 100);
  assert.equal(normalizePicture({saturation:'0'}).saturation, 0);
});
test('all picture presets are in range and independently selectable', () => {
  for (const [id, preset] of Object.entries(PICTURE_PRESETS)) {
    const normalized = normalizePicture(preset);
    assert.equal(matchingPicturePreset(normalized), id);
    for (const key of Object.keys(PICTURE_DEFAULTS)) assert.equal(normalized[key], preset[key]);
  }
  assert.equal(matchingPicturePreset({...PICTURE_DEFAULTS, brightness:97}), 'custom');
});
test('picture filter contains numeric CSS only', () => {
  assert.equal(pictureFilter({brightness:50,contrast:110,saturation:0}), 'brightness(0.5) contrast(1.1) saturate(0)');
  assert.equal(pictureFilter({brightness:'url(https://evil.example)'}), 'brightness(1) contrast(1) saturate(1)');
});
test('manifest supports home-screen fullscreen, including a standalone fallback', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.display, 'fullscreen');
  assert.ok(manifest.display_override.includes('standalone'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});
test('header preserves the two left controls and fullscreen alongside centered resource links', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const header = html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.equal((header.match(/<button /g)||[]).length, 3);
  assert.ok(header.includes('id="light-button"'));
  assert.ok(header.includes('id="appearance-button"'));
  assert.ok(header.includes('id="fullscreen-button"'));
  assert.equal((header.match(/<a /g)||[]).length, 2);
  assert.ok(header.includes('class="resource-links"'));
  assert.ok(!header.includes('brand') && !header.includes('SOLSTICE'));
});

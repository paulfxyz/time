import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('welcome and header point to official source, releases and installation help', () => {
  const html = read('public/index.html');
  for (const id of ['link-header-github', 'link-header-macos', 'link-welcome-readme', 'link-welcome-macos', 'link-welcome-install']) {
    const anchor = html.match(new RegExp(`<a [^>]*data-testid="${id}"[^>]*>`))?.[0];
    assert.ok(anchor, id);
    assert.match(anchor, /href="https:\/\/github\.com\/paulfxyz\/timescreen/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
  assert.match(html, /aria-labelledby="welcome-title" aria-describedby="welcome-intro"/);
  assert.match(html, /Not Apple-signed or notarized/);
  assert.match(html, /Ad-hoc signed only/);
  assert.match(html, /Never disable Gatekeeper/);
});

test('welcome is separate from clock settings, dismissible and not automatic in the native app', () => {
  const app = read('public/app.js');
  assert.match(app, /if \(!isNative && !hasSeenWelcome\(\)\) openDialog\('welcome-dialog'\)/);
  assert.match(app, /localStorage\.getItem\('timescreen:welcome:v1'\)/);
  assert.match(app, /localStorage\.setItem\('timescreen:welcome:v1', '1'\)/);
  assert.match(app, /'#welcome-dialog'\)\.addEventListener\('close'/);
  assert.match(app, /'#about-button'\)\.addEventListener\('click'/);
  assert.match(read('tools/build-preview.mjs'), /previewMemory\.get\('welcome'\)/);
  assert.match(read('public/sw.js'), /time-2\.1\.0-mobile-2/);
});

test('mobile resources use a footer dialog trigger and progressively disclosed installation help', () => {
  const html = read('public/index.html');
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer, /id="resources-button"/);
  assert.match(footer, /aria-controls="welcome-dialog"/);
  assert.match(html, /<details id="welcome-install"/);
  assert.match(read('public/app.js'), /'#resources-button'\)\.addEventListener\('click'/);
  assert.match(read('public/style.css'), /\.resource-links \{ display: none; \}/);
});

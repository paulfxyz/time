import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('updater pins a public Ed25519 key and requires signed feeds and archives', () => {
  const publicKey = read('macos/Resources/SparklePublicKey.txt').trim();
  assert.equal(Buffer.from(publicKey,'base64').length,32);
  const plist = read('macos/Resources/Info.plist');
  assert.ok(plist.includes(`<key>SUPublicEDKey</key><string>${publicKey}</string>`));
  for (const key of ['SURequireSignedFeed','SUVerifyUpdateBeforeExtraction','SUAllowsAutomaticUpdates']) {
    assert.ok(plist.includes(`<key>${key}</key><true/>`));
  }
  assert.ok(plist.includes('<key>SUSignedFeedFailureExpirationInterval</key><integer>0</integer>'));
  assert.ok(plist.includes('<key>SUSendProfileInfo</key><false/>'));
  assert.ok(plist.includes('<key>SUAutomaticallyUpdate</key><false/>'));
  assert.ok(plist.includes('https://github.com/paulfxyz/timescreen/releases/latest/download/appcast.xml'));
});
test('native settings expose checks, automatic updates, login launch and window memory', () => {
  const source = read('macos/Sources/Settings.swift');
  for (const label of ['Check for Updates','Automatically check for updates','Automatically download and install updates',
    'Launch Timescreen when I log in','Remember window position, size and display','Reset saved window position']) {
    assert.ok(source.includes(label),label);
  }
  assert.ok(source.includes('SMAppService.mainApp.register()'));
  assert.ok(source.includes('SMAppService.mainApp.unregister()'));
  assert.ok(source.includes('requiresApproval'));
});
test('update-signing key is passed to signing tools through stdin, not arguments', () => {
  const script = read('macos/scripts/release-feed.mjs');
  assert.ok(script.includes("['--ed-key-file','-',...args]"));
  assert.ok(script.includes("input:seed+'\\n'"));
  assert.ok(script.includes("sign(['--verify','build/appcast.xml'])"));
  const initializer = read('tools/initialize-update-signing.mjs');
  assert.ok(initializer.includes('A signing key already exists'));
  assert.ok(initializer.includes("input:encodedSeed"));
});
test('window placement does not rely only on a raw desktop coordinate', () => {
  const policy = read('macos/Sources/WindowPlacement.swift');
  assert.ok(policy.includes('CGDisplayCreateUUIDFromDisplayID'));
  assert.ok(policy.includes('original.visible.minX-display.visible.minX'));
  assert.ok(policy.includes('Self.constrained(centered'));
  const app = read('macos/Sources/main.swift');
  assert.ok(app.includes('windowDidMove'));
  assert.ok(app.includes('windowDidResize'));
  assert.ok(app.includes('saveWindowPosition(); self?.prefs.synchronize()'));
});

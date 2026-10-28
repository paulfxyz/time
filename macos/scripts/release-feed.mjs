// Called only for a release build. Signing input goes through stdin, never argv.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, verify } from 'node:crypto';

const pkg = JSON.parse(await readFile('package.json','utf8'));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Stable semantic version required.');
const publicKey = (await readFile('macos/Resources/SparklePublicKey.txt','utf8')).trim();
const seed = (process.env.SPARKLE_PRIVATE_KEY || '').trim();
if (!/^[A-Za-z0-9+/]{43}=$/.test(seed) || Buffer.from(seed,'base64').length !== 32) {
  throw new Error('A valid private update-signing seed is required in the encrypted repository secret.');
}
const privateObject = createPrivateKey({key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(publicKey,'base64').toString('base64url'),
  d:Buffer.from(seed,'base64').toString('base64url')},format:'jwk'});
const derived = createPublicKey(privateObject);
if (Buffer.from(derived.export({format:'jwk'}).x,'base64url').toString('base64') !== publicKey) {
  throw new Error('Signing secret does not match the app’s pinned verification key.');
}
const archive = `build/Timescreen-${version}-macOS-universal.zip`;
const executable = 'build/vendor/sparkle/bin/sign_update';
function sign(args) {
  const run = spawnSync(executable,['--ed-key-file','-',...args],{input:seed+'\n',encoding:'utf8',maxBuffer:1024*1024});
  if (run.status !== 0) throw new Error('Sparkle signing or signature verification failed.');
  return run.stdout.trim();
}
const signature = sign(['-p',archive]);
const archiveBytes = await readFile(archive);
if (!verify(null,archiveBytes,derived,Buffer.from(signature,'base64'))) throw new Error('Independent archive verification failed.');
const buildNumber = spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion','build/Timescreen.app/Contents/Info.plist'],{encoding:'utf8'}).stdout.trim();
if (!/^\d+$/.test(buildNumber)) throw new Error('Invalid native build number.');
const length = (await stat(archive)).size;
const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Timescreen updates</title>
    <link>https://github.com/paulfxyz/timescreen</link>
    <description>Official signed updates for Timescreen on macOS.</description>
    <language>en</language>
    <item>
      <title>Timescreen ${version}</title>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <sparkle:version>${buildNumber}</sparkle:version>
      <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>13.0</sparkle:minimumSystemVersion>
      <description><![CDATA[<p>Native update checks, optional automatic updates, launch at login, and reliable window position, size and display restoration.</p><p><a href="https://github.com/paulfxyz/timescreen/releases/tag/v${version}">Read the full release notes</a></p>]]></description>
      <enclosure url="https://github.com/paulfxyz/timescreen/releases/download/v${version}/Timescreen-${version}-macOS-universal.zip" sparkle:edSignature="${signature}" length="${length}" type="application/octet-stream"/>
    </item>
  </channel>
</rss>
`;
await writeFile('build/appcast.xml',xml);
sign(['build/appcast.xml']);
sign(['--verify','build/appcast.xml']);
sign(['--verify',archive,signature]);
await writeFile('build/update-signature.json',JSON.stringify({version,buildNumber,publicKey,archiveSignature:signature,
  archiveBytes:length,feedSignatureVerified:true,archiveSignatureVerified:true},null,2));
console.log(`Signed and verified Timescreen ${version} update archive and mandatory-signed feed.`);

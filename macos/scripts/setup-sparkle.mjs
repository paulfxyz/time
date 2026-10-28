import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const SPARKLE_VERSION = '2.10.1';
const digest = '1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27';
const root = resolve('build/vendor/sparkle');
await mkdir(root,{recursive:true});
const archive = resolve(root,`Sparkle-${SPARKLE_VERSION}.tar.xz`);
let bytes;
try { bytes = await readFile(archive); } catch {}
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== digest) {
  const response = await fetch(`https://github.com/sparkle-project/Sparkle/releases/download/${SPARKLE_VERSION}/Sparkle-${SPARKLE_VERSION}.tar.xz`,
    {signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`Sparkle download returned ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('Sparkle distribution checksum mismatch.');
  await writeFile(archive,bytes);
}
let extracted = false;
try { await access(resolve(root,'Sparkle.framework/Versions/B/Sparkle')); extracted = true; } catch {}
if (!extracted) {
  const result = spawnSync('tar',['-xf',archive,'-C',root],{stdio:'inherit'});
  if (result.status !== 0) throw new Error('Unable to unpack the verified Sparkle framework.');
}
console.log(`Sparkle ${SPARKLE_VERSION} distribution SHA-256 verified.`);

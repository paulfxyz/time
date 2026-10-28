// Maintainer-only, one-time initialization. No private key is written to disk,
// printed, passed as an argument, or committed. Existing keys are never rotated.
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const repo = 'paulfxyz/timescreen';
const listing = spawnSync('gh', ['secret','list','--repo',repo,'--json','name'], {encoding:'utf8'});
if (listing.status !== 0) throw new Error('Unable to inspect signing-secret metadata.');
if (JSON.parse(listing.stdout).some(item => item.name === 'SPARKLE_PRIVATE_KEY')) {
  throw new Error('A signing key already exists. Do not rotate it: installed apps trust its public key.');
}
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateJWK = privateKey.export({format:'jwk'});
const publicJWK = publicKey.export({format:'jwk'});
const seed = Buffer.from(privateJWK.d, 'base64url');
const encodedSeed = seed.toString('base64');
const saved = spawnSync('gh', ['secret','set','SPARKLE_PRIVATE_KEY','--repo',repo],
  {input:encodedSeed,encoding:'utf8',stdio:['pipe','pipe','pipe']});
seed.fill(0);
if (saved.status !== 0) throw new Error('The update-signing key could not be saved to the encrypted GitHub secret.');
const publicValue = Buffer.from(publicJWK.x,'base64url').toString('base64');
await writeFile('macos/Resources/SparklePublicKey.txt', publicValue+'\n');
console.log('Update-signing key stored as an encrypted repository secret.');
console.log(`Public verification key: ${publicValue}`);
